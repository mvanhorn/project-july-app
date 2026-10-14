package expo.modules.julytls

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class JulyTlsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("JulyTls")

    OnCreate { JulyTrust.install(appContext.reactContext?.applicationContext) }

    // A host's own trust rule: its home CA (PEM), or no checks at all. The phone's
    // normal trust still applies first; a rule only rescues a certificate it refuses.
    Function("setTrust") { host: String, caPem: String?, insecure: Boolean ->
      JulyTrust.set(host, caPem, insecure)
    }

    Function("clearTrust") { host: String -> JulyTrust.clear(host) }
  }
}
