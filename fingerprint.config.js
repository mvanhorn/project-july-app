// The runtime version (fingerprint policy) decides which builds an EAS Update
// reaches. eas.json and .easignore only hold build/submit settings here, so
// editing them shouldn't cut existing builds off from updates. If you ever add
// native build env vars to eas.json, remove its ignore and rebuild.
/** @type {import('expo/fingerprint').Config} */
const config = {
  ignorePaths: ['eas.json', '.easignore'],
};

module.exports = config;
