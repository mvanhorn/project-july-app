// Lets local release builds (scripts/build-android-release.js) sign with the
// EAS keystore: when credentials.json (from `eas credentials`) is in the project
// root, Gradle reads it at build time, so no passwords land in generated files.
// It's gitignored and easignored, so EAS cloud builds keep their own signing.
// Also lets the build script pass -PversionCode, keeping app.json (and the
// update fingerprint) unchanged.
const { withAppBuildGradle } = require('expo/config-plugins');

const READ_CREDENTIALS = `
// Local release signing from EAS credentials.json (plugins/withLocalReleaseSigning.js)
def easCredentialsFile = new File(rootDir, "../credentials.json")
def easKeystore = easCredentialsFile.exists() ? new groovy.json.JsonSlurper().parse(easCredentialsFile).android.keystore : null

android {`;

const RELEASE_SIGNING_CONFIG = `
        if (easKeystore) {
            release {
                storeFile new File(rootDir, "../" + easKeystore.keystorePath)
                storePassword easKeystore.keystorePassword
                keyAlias easKeystore.keyAlias
                keyPassword easKeystore.keyPassword
            }
        }
    }
    buildTypes {`;

function replaceOnce(src, pattern, replacement, what) {
  if (!pattern.test(src)) {
    throw new Error(`withLocalReleaseSigning: couldn't find ${what} in app/build.gradle`);
  }
  return src.replace(pattern, replacement);
}

module.exports = function withLocalReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let gradle = cfg.modResults.contents;
    if (gradle.includes('easKeystore')) return cfg;
    gradle = replaceOnce(gradle, /^android \{/m, READ_CREDENTIALS, 'the android block');
    gradle = replaceOnce(gradle, /versionCode (\d+)/, "versionCode findProperty('versionCode')?.toInteger() ?: $1", 'versionCode');
    // Before adding signingConfigs.release, so the first `release {` is the build type.
    gradle = replaceOnce(
      gradle,
      /(release \{[\s\S]*?)signingConfig signingConfigs\.debug/,
      '$1signingConfig easKeystore ? signingConfigs.release : signingConfigs.debug',
      'the release signingConfig'
    );
    gradle = replaceOnce(gradle, /\n    \}\n    buildTypes \{/, RELEASE_SIGNING_CONFIG, 'the end of signingConfigs');
    cfg.modResults.contents = gradle;
    return cfg;
  });
};
