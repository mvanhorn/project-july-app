package expo.modules.julytls

import android.app.Application
import android.content.Context
import expo.modules.core.interfaces.ApplicationLifecycleListener
import expo.modules.core.interfaces.Package

/**
 * Installs the trust hooks as the app starts, before any module builds an HTTP
 * client: expo/fetch builds its own once, when its module is created.
 */
class JulyTlsPackage : Package {
  override fun createApplicationLifecycleListeners(context: Context): List<ApplicationLifecycleListener> =
    listOf(object : ApplicationLifecycleListener {
      override fun onCreate(application: Application) = JulyTrust.install(application)
    })
}
