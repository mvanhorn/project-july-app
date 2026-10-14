// The runtime version (fingerprint policy) decides which builds an EAS Update
// reaches. eas.json and .easignore only hold build/submit settings here, so
// editing them shouldn't cut existing builds off from updates. If you ever add
// native build env vars to eas.json, remove its ignore and rebuild.
//
// The whole app config is hashed for each platform, so an iOS-only setting would
// also cut Android builds off. ios.config.usesNonExemptEncryption is the App Store
// export compliance answer (ITSAppUsesNonExemptEncryption), not native code, so
// it's left out of the hash.
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
  ignorePaths: ['eas.json', '.easignore'],
  fileHookTransform: (source, chunk) =>
    source.type === 'contents' && source.id === 'expoConfig' && typeof chunk === 'string'
      ? withoutExportCompliance(chunk)
      : chunk,
};

module.exports = config;
