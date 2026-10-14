// The runtime version (fingerprint policy) decides which builds an EAS Update
// reaches. eas.json and .easignore only hold build/submit settings here, so
// editing them shouldn't cut existing builds off from updates. If you ever add
// native build env vars to eas.json, remove its ignore and rebuild.
//
// The whole app config is hashed for each platform, so an iOS-only setting would
// also cut Android builds off. ios.config.usesNonExemptEncryption is the App Store
// export compliance answer (ITSAppUsesNonExemptEncryption), not native code, so
// it's left out of the hash.
//
// @react-native-masked-view/masked-view's build.gradle rewrites its own
// AndroidManifest.xml (drops package="…") whenever Gradle configures it, so a
// local Android build changes that file in node_modules. EAS hashes a fresh
// install, so the file is left out: otherwise a PC that has built Android
// computes a different runtime version than EAS and the build is refused.
const MASKED_VIEW_MANIFEST = 'node_modules/@react-native-masked-view/masked-view/android/src/main/AndroidManifest.xml';

function withoutExportCompliance(json) {
  const expoConfig = JSON.parse(json);
  const iosConfig = expoConfig.ios?.config;
  if (!iosConfig || !('usesNonExemptEncryption' in iosConfig)) return json;
  delete iosConfig.usesNonExemptEncryption;
  if (Object.keys(iosConfig).length === 0) delete expoConfig.ios.config;
  return JSON.stringify(expoConfig);
}

/** @type {import('expo/fingerprint').Config} */
const config = {
  ignorePaths: ['eas.json', '.easignore', MASKED_VIEW_MANIFEST],
  fileHookTransform: (source, chunk) =>
    source.type === 'contents' && source.id === 'expoConfig' && typeof chunk === 'string'
      ? withoutExportCompliance(chunk)
      : chunk,
};

module.exports = config;
