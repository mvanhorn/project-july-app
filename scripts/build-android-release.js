// Builds a signed release AAB for Google Play on this machine, without using
// an EAS build. Needs credentials.json from `eas credentials` (see
// plugins/withLocalReleaseSigning.js), a JDK 17+ and the Android SDK.
//
//   npm run build:android:local                    # next versionCode after EAS's
//   npm run build:android:local -- --version-code 7
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.resolve(__dirname, '..');
const run = (cmd, opts = {}) => execSync(cmd, { cwd: root, stdio: 'inherit', ...opts });

if (!fs.existsSync(path.join(root, 'credentials.json'))) {
  console.error('credentials.json is missing. Run `eas credentials -p android` and download it first.');
  process.exit(1);
}

if (!process.env.ANDROID_HOME) {
  const sdk = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'Library'), 'Android', 'Sdk');
  if (fs.existsSync(sdk)) process.env.ANDROID_HOME = sdk;
}

// EAS keeps the versionCode (appVersionSource: remote), so continue from it.
const flag = process.argv.indexOf('--version-code');
let versionCode;
if (flag !== -1) {
  versionCode = Number(process.argv[flag + 1]);
} else {
  const out = execSync('npx eas-cli@latest build:version:get -p android --json', { cwd: root, encoding: 'utf8' });
  versionCode = Number(JSON.parse(out).versionCode) + 1;
}
if (!Number.isInteger(versionCode) || versionCode < 1) {
  console.error(`Invalid versionCode: ${versionCode}`);
  process.exit(1);
}
console.log(`\nBuilding versionCode ${versionCode}\n`);

// Prebuild rewrites the android/ios scripts in package.json; keep ours.
const pkgPath = path.join(root, 'package.json');
const pkg = fs.readFileSync(pkgPath);
try {
  run('npx expo prebuild -p android --clean --no-install');
} finally {
  fs.writeFileSync(pkgPath, pkg);
}

const androidDir = path.join(root, 'android');
const gradlew = path.join(androidDir, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');
// The default 512 MB metaspace runs out during release lint.
const jvmArgs = '-Xmx4g -XX:MaxMetaspaceSize=1g';
run(`"${gradlew}" bundleRelease -PversionCode=${versionCode} "-Dorg.gradle.jvmargs=${jvmArgs}"`, { cwd: androidDir });

const outDir = path.join(root, 'dist');
fs.mkdirSync(outDir, { recursive: true });
const aab = path.join(outDir, `project-july-${versionCode}.aab`);
fs.copyFileSync(path.join(root, 'android/app/build/outputs/bundle/release/app-release.aab'), aab);

console.log(`\nBuilt ${path.relative(root, aab)}`);
console.log(`Keep EAS in step so its next build doesn't reuse this number:`);
console.log(`  npx eas-cli@latest build:version:set -p android   (enter ${versionCode})`);
