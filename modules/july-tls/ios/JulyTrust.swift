import Foundation
import ObjectiveC
import Security

struct InvalidCertificate: Error, CustomStringConvertible {
  var description: String { "That isn't a certificate in PEM form (-----BEGIN CERTIFICATE-----)." }
}

/// Per-host certificate trust for React Native's fetch (RCTHTTPRequestHandler's
/// NSURLSession) and WebSocket (SocketRocket's SRSecurityPolicy).
///
/// The phone's own trust is always tried first. Only when it refuses a certificate
/// does a host's rule apply:
/// - a home CA: the chain must lead to that CA (hostname not checked, since the home
///   certificate is often made for oven.local and reached by IP);
/// - insecure: anything is accepted. Opt in only; the app says what that means.
enum JulyTrust {
  private struct Rule {
    let ca: SecCertificate?
    let insecure: Bool
  }

  private static var rules: [String: Rule] = [:]
  private static let lock = NSLock()
  private static var installed = false

  private static func bare(_ host: String) -> String {
    var h = host.trimmingCharacters(in: .whitespaces).lowercased()
    if h.hasPrefix("[") { h = String(h.dropFirst().prefix { $0 != "]" }) }
    // "192.168.1.5:443" -> "192.168.1.5" (IPv6 literals keep their colons).
    if h.filter({ $0 == ":" }).count == 1, let i = h.firstIndex(of: ":") { h = String(h[..<i]) }
    return h
  }

  static func set(host: String, caPem: String?, insecure: Bool) throws {
    var ca: SecCertificate?
    if let pem = caPem, !pem.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
      let body = pem
        .components(separatedBy: .newlines)
        .filter { !$0.hasPrefix("-----") }
        .joined()
      guard let der = Data(base64Encoded: body, options: .ignoreUnknownCharacters),
            let cert = SecCertificateCreateWithData(nil, der as CFData) else { throw InvalidCertificate() }
      ca = cert
    }
    lock.lock(); defer { lock.unlock() }
    rules[bare(host)] = Rule(ca: ca, insecure: insecure)
  }

  static func clear(host: String) {
    lock.lock(); defer { lock.unlock() }
    rules.removeValue(forKey: bare(host))
  }

  private static func rule(for host: String?) -> Rule? {
    guard let host else { return nil }
    lock.lock(); defer { lock.unlock() }
    return rules[bare(host)]
  }

  /// Whether a host's rule accepts a certificate the system refused.
  static func rescues(_ trust: SecTrust, host: String?) -> Bool {
    guard let rule = rule(for: host) else { return false }
    if rule.insecure { return true }
    guard let ca = rule.ca else { return false }
    SecTrustSetPolicies(trust, SecPolicyCreateBasicX509())
    SecTrustSetAnchorCertificates(trust, [ca] as CFArray)
    SecTrustSetAnchorCertificatesOnly(trust, true)
    return SecTrustEvaluateWithError(trust, nil)
  }

  static func install() {
    lock.lock(); defer { lock.unlock() }
    if installed { return }
    installed = true
    installFetch()
    installWebSocket()
  }

  // fetch: RCTHTTPRequestHandler is its NSURLSession's delegate and has no
  // authentication-challenge method, so one is added. Unknown hosts get the default.
  private static func installFetch() {
    guard let cls = NSClassFromString("RCTHTTPRequestHandler") else { return }
    let sel = NSSelectorFromString("URLSession:didReceiveChallenge:completionHandler:")
    typealias Completion = @convention(block) (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
    let block: @convention(block) (AnyObject, URLSession, URLAuthenticationChallenge, Completion) -> Void = { _, _, challenge, completion in
      let space = challenge.protectionSpace
      guard space.authenticationMethod == NSURLAuthenticationMethodServerTrust, let trust = space.serverTrust,
            rule(for: space.host) != nil else {
        completion(.performDefaultHandling, nil)
        return
      }
      if SecTrustEvaluateWithError(trust, nil) || rescues(trust, host: space.host) {
        completion(.useCredential, URLCredential(trust: trust))
      } else {
        completion(.cancelAuthenticationChallenge, nil)
      }
    }
    // If a later React Native adds its own, leave it be rather than replace it.
    class_addMethod(cls, sel, imp_implementationWithBlock(block), "v@:@@@?")
  }

  private static var anyRules: Bool {
    lock.lock(); defer { lock.unlock() }
    return !rules.isEmpty
  }

  // WebSocket: SocketRocket (0.7) leaves the check to the stream
  // (kCFStreamSSLValidatesCertificateChain), and its policy's own check just says
  // yes. Once any host has a rule, the stream's check is turned off and the policy
  // does it instead: the system's check for the host, then the host's rule.
  private static func installWebSocket() {
    guard let cls = NSClassFromString("SRSecurityPolicy") else { return }

    let validates = NSSelectorFromString("certificateChainValidationEnabled")
    let evaluate = NSSelectorFromString("evaluateServerTrust:forDomain:")
    guard let validatesMethod = class_getInstanceMethod(cls, validates),
          let evaluateMethod = class_getInstanceMethod(cls, evaluate) else { return }

    typealias Validates = @convention(c) (AnyObject, Selector) -> Bool
    let originalValidates = unsafeBitCast(method_getImplementation(validatesMethod), to: Validates.self)
    let validatesBlock: @convention(block) (AnyObject) -> Bool = { this in
      anyRules ? false : originalValidates(this, validates)
    }

    typealias Evaluate = @convention(c) (AnyObject, Selector, SecTrust, NSString?) -> Bool
    let originalEvaluate = unsafeBitCast(method_getImplementation(evaluateMethod), to: Evaluate.self)
    let evaluateBlock: @convention(block) (AnyObject, SecTrust, NSString?) -> Bool = { this, trust, domain in
      // The policy's own answer (a pinning subclass may say no) always counts.
      guard originalEvaluate(this, evaluate, trust, domain) else { return false }
      // A policy made without chain checks keeps that. Otherwise check here, whether
      // or not the stream did (rules can change between the two).
      guard originalValidates(this, validates) else { return true }
      SecTrustSetPolicies(trust, SecPolicyCreateSSL(true, domain as CFString?))
      return SecTrustEvaluateWithError(trust, nil) || rescues(trust, host: domain as String?)
    }

    method_setImplementation(validatesMethod, imp_implementationWithBlock(validatesBlock))
    method_setImplementation(evaluateMethod, imp_implementationWithBlock(evaluateBlock))
  }
}
