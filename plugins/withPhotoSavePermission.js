// Saving a camera picture to Photos (src/components/savePhoto.ts) asks
// expo-media-library for write-only access. Android 10+ saves through MediaStore
// with no permission, so storage write is only needed up to Android 9: cap it
// there (expo-media-library declares it up to 32). Its read permissions are
// blocked in app.json, since the app never reads the photo library.
const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

const WRITE = 'android.permission.WRITE_EXTERNAL_STORAGE';

module.exports = function withPhotoSavePermission(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    AndroidConfig.Manifest.ensureToolsAvailable(cfg.modResults);
    manifest['uses-permission'] = (manifest['uses-permission'] || []).filter((p) => p.$['android:name'] !== WRITE);
    manifest['uses-permission'].push({
      $: { 'android:name': WRITE, 'android:maxSdkVersion': '28', 'tools:replace': 'android:maxSdkVersion' },
    });
    return cfg;
  });
};
