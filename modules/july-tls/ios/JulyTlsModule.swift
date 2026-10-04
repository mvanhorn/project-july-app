import ExpoModulesCore

public class JulyTlsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("JulyTls")

    OnCreate { JulyTrust.install() }

    // A host's own trust rule: its home CA (PEM), or no checks at all. The phone's
    // normal trust still applies first; a rule only rescues a certificate it refuses.
    Function("setTrust") { (host: String, caPem: String?, insecure: Bool) throws in
      try JulyTrust.set(host: host, caPem: caPem, insecure: insecure)
    }

    Function("clearTrust") { (host: String) in JulyTrust.clear(host: host) }
  }
}
