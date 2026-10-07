package expo.modules.julytls

import com.facebook.react.modules.network.CustomClientBuilder
import com.facebook.react.modules.network.NetworkingModule
import com.facebook.react.modules.websocket.WebSocketModule
import java.io.ByteArrayInputStream
import java.net.Socket
import java.security.KeyStore
import java.security.cert.CertificateException
import java.security.cert.CertificateFactory
import java.security.cert.X509Certificate
import java.util.concurrent.ConcurrentHashMap
import javax.net.ssl.HostnameVerifier
import javax.net.ssl.HttpsURLConnection
import javax.net.ssl.SSLContext
import javax.net.ssl.SSLEngine
import javax.net.ssl.SSLSocket
import javax.net.ssl.TrustManagerFactory
import javax.net.ssl.X509ExtendedTrustManager
import javax.net.ssl.X509TrustManager

/**
 * Per-host certificate trust for React Native's fetch and WebSocket (both OkHttp).
 *
 * The phone's own trust (system CAs, plus user CAs through network_security_config)
 * is always tried first. Only when it refuses a certificate does a host's rule apply:
 * - a home CA: the chain must lead to that CA (hostname not checked, since the home
 *   certificate is often made for oven.local and reached by IP);
 * - insecure: anything is accepted. Opt in only; the app says what that means.
 */
object JulyTrust {
  private class Rule(val ca: X509Certificate?, val insecure: Boolean)

  private val rules = ConcurrentHashMap<String, Rule>()

  private val system: X509TrustManager by lazy { trustManager(null) }

  private fun trustManager(store: KeyStore?): X509TrustManager {
    val tmf = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm())
    tmf.init(store)
    return tmf.trustManagers.filterIsInstance<X509TrustManager>().first()
  }

  private fun parse(pem: String): X509Certificate {
    val cf = CertificateFactory.getInstance("X.509")
    return cf.generateCertificate(ByteArrayInputStream(pem.trim().toByteArray())) as X509Certificate
  }

  private fun bare(host: String) = host.trim().lowercase().removePrefix("[").substringBefore("]").let {
    // "192.168.1.5:443" -> "192.168.1.5" (IPv6 literals keep their colons).
    if (it.count { c -> c == ':' } == 1) it.substringBefore(':') else it
  }

  fun set(host: String, caPem: String?, insecure: Boolean) {
    val ca = caPem?.takeIf { it.isNotBlank() }?.let { parse(it) }
    rules[bare(host)] = Rule(ca, insecure)
  }

  fun clear(host: String) {
    rules.remove(bare(host))
  }

  private fun rescue(chain: Array<X509Certificate>, authType: String, host: String?, refused: CertificateException) {
    val rule = host?.let { rules[bare(it)] } ?: throw refused
    if (rule.insecure) return
    val ca = rule.ca ?: throw refused
    val store = KeyStore.getInstance(KeyStore.getDefaultType()).apply {
      load(null, null)
      setCertificateEntry("home-ca", ca)
    }
    trustManager(store).checkServerTrusted(chain, authType)
  }

  private val trust = object : X509ExtendedTrustManager() {
    private fun systemCheck(check: () -> Unit, chain: Array<X509Certificate>, authType: String, host: String?) {
      try {
        check()
      } catch (e: CertificateException) {
        rescue(chain, authType, host, e)
      }
    }

    override fun checkServerTrusted(chain: Array<X509Certificate>, authType: String, socket: Socket?) {
      val host = (socket as? SSLSocket)?.handshakeSession?.peerHost
      val sys = system
      systemCheck({
        if (sys is X509ExtendedTrustManager) sys.checkServerTrusted(chain, authType, socket) else sys.checkServerTrusted(chain, authType)
      }, chain, authType, host)
    }

    override fun checkServerTrusted(chain: Array<X509Certificate>, authType: String, engine: SSLEngine?) {
      val sys = system
      systemCheck({
        if (sys is X509ExtendedTrustManager) sys.checkServerTrusted(chain, authType, engine) else sys.checkServerTrusted(chain, authType)
      }, chain, authType, engine?.peerHost)
    }

    override fun checkServerTrusted(chain: Array<X509Certificate>, authType: String) {
      system.checkServerTrusted(chain, authType)
    }

    override fun checkClientTrusted(chain: Array<X509Certificate>, authType: String, socket: Socket?) = system.checkClientTrusted(chain, authType)
    override fun checkClientTrusted(chain: Array<X509Certificate>, authType: String, engine: SSLEngine?) = system.checkClientTrusted(chain, authType)
    override fun checkClientTrusted(chain: Array<X509Certificate>, authType: String) = system.checkClientTrusted(chain, authType)
    override fun getAcceptedIssuers(): Array<X509Certificate> = system.acceptedIssuers
  }

  private val socketFactory by lazy {
    SSLContext.getInstance("TLS").apply { init(null, arrayOf(trust), null) }.socketFactory
  }

  // Hosts with a rule skip the name check (see above); everything else keeps it.
  private val hostnames = HostnameVerifier { host, session ->
    HttpsURLConnection.getDefaultHostnameVerifier().verify(host, session) || rules.containsKey(bare(host))
  }

  fun install() {
    // Applied to every request and socket; it only changes anything once a host has a rule.
    val builder = CustomClientBuilder { b ->
      if (rules.isNotEmpty()) b.sslSocketFactory(socketFactory, trust).hostnameVerifier(hostnames)
    }
    NetworkingModule.setCustomClientBuilder(builder)
    WebSocketModule.setCustomClientBuilder(builder)
  }
}
