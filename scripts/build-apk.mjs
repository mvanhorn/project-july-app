// Build an installable Android APK on this machine, without EAS: npm run build:apk
//
// On Windows the native (C++) build breaks in a deep folder: object paths pass
// CMake's 250-character limit and ninja fails ("build.ninja still dirty"). A drive
// letter (subst) or junction doesn't help, since Node resolves them back to the
// real path. So when this checkout's path is long, the build runs in a git
// worktree at a short path (C:\pj-july by default), moved to this commit first.
//
// Needs Java 17 and the Android SDK (platform 36, build-tools 36.0.0, NDK
// 27.1.12297006, CMake 3.22.1); see README, "Build an APK on this machine".
//
// Options:
//   --abi=arm64-v8a      CPU architectures, comma separated (default arm64-v8a;
//                        --abi=all for every phone, about 4x the build time)
//   --dir=C:\path        where to build on Windows (default C:\pj-july)
//
// The APK lands in dist/project-july-<commit>.apk. Only committed code is built.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const win = process.platform === 'win32';
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));

function fail(message) {
  console.error(`\nbuild-apk: ${message}`);
  process.exit(1);
}

const quote = (a) => (/[\s"]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a);

/** Run a command, streaming its output. Returns stdout with `capture`, else the exit status. */
function run(cmd, cmdArgs, opts = {}) {
  const options = {
    cwd: opts.cwd,
    env: { ...process.env, ...opts.env },
    stdio: opts.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    encoding: 'utf8',
  };
  // .cmd and .bat files need a shell on Windows; give it one quoted command line.
  const r = win
    ? spawnSync([cmd, ...cmdArgs].map(quote).join(' '), { ...options, shell: true })
    : spawnSync(cmd, cmdArgs, options);
  if (r.status !== 0 && !opts.allowFail) fail(`${cmd} ${cmdArgs.join(' ')} failed${r.stderr ? `:\n${r.stderr}` : ''}`);
  return opts.capture ? (r.stdout ?? '').trim() : r.status;
}

const git = (cwd, ...a) => run('git', ['-C', cwd, ...a], { capture: true });

// --- What to build ----------------------------------------------------------------

const root = git(process.cwd(), 'rev-parse', '--show-toplevel').replace(/\//g, win ? '\\' : '/');
const commit = git(root, 'rev-parse', 'HEAD');
const short = commit.slice(0, 7);
if (git(root, 'status', '--porcelain', '--untracked-files=no')) {
  console.warn(`build-apk: this checkout has uncommitted changes. The APK is built from ${short}, without them.`);
}

// --- Java 17 and the Android SDK --------------------------------------------------

function findJava() {
  const ok = (home) => home && existsSync(join(home, 'bin', win ? 'java.exe' : 'java'));
  if (ok(process.env.JAVA_HOME)) return process.env.JAVA_HOME;
  if (!win) return null;
  const roots = ['C:\\Program Files\\Java', 'C:\\Program Files\\Microsoft', 'C:\\Program Files\\Eclipse Adoptium', 'C:\\Program Files\\Zulu'];
  for (const r of roots) {
    if (!existsSync(r)) continue;
    const jdk = readdirSync(r).filter((d) => /^(jdk|zulu)-?17/i.test(d)).sort().pop();
    if (jdk && ok(join(r, jdk))) return join(r, jdk);
  }
  const studio = 'C:\\Program Files\\Android\\Android Studio\\jbr';
  return ok(studio) ? studio : null;
}

const javaHome = findJava();
if (!javaHome) fail('Java 17 not found. Install it (for example `winget install --id Microsoft.OpenJDK.17 --scope user`) or set JAVA_HOME.');

const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || (win ? join(process.env.LOCALAPPDATA ?? '', 'Android', 'Sdk') : join(process.env.HOME ?? '', 'Android', 'Sdk'));
const needed = ['platforms/android-36', 'build-tools/36.0.0', 'ndk/27.1.12297006', 'cmake/3.22.1'];
const missing = needed.filter((p) => !existsSync(join(sdk, ...p.split('/'))));
if (missing.length) {
  fail(`the Android SDK at ${sdk} is missing ${missing.join(', ')}. See README, "Build an APK on this machine".`);
}

// --- Where to build -----------------------------------------------------------------

// Short enough that react-native-worklets' object files stay under CMake's limit.
const longPath = win && root.length > 40;
const dir = longPath ? (args.dir ?? 'C:\\pj-july') : root;
if (longPath) {
  if (!existsSync(dir)) {
    console.log(`build-apk: creating a worktree at ${dir} (this checkout's path is too long for the native build)`);
    run('git', ['-C', root, 'worktree', 'add', '--detach', dir, commit]);
  } else {
    const common = (p) => git(p, 'rev-parse', '--path-format=absolute', '--git-common-dir').toLowerCase();
    if (common(dir) !== common(root)) fail(`${dir} exists but isn't a worktree of this repository. Pass --dir=<another folder>.`);
    if (git(dir, 'status', '--porcelain', '--untracked-files=no')) fail(`${dir} has uncommitted changes. Commit or discard them there first.`);
    run('git', ['-C', dir, 'checkout', '--quiet', '--detach', commit]);
  }
}

// --- Packages, native project, build ------------------------------------------------

// By full path: Windows may not search the current folder for commands
// (NoDefaultCurrentDirectoryInExePath).
const gradlew = join(dir, 'android', win ? 'gradlew.bat' : 'gradlew');
const gradleEnv = { JAVA_HOME: javaHome, ANDROID_HOME: sdk, PATH: `${join(javaHome, 'bin')}${win ? ';' : ':'}${process.env.PATH}` };
// A Gradle daemon from an earlier build keeps files in node_modules open, and
// npm ci then can't delete them (EBUSY).
const stopGradle = () => {
  if (existsSync(gradlew)) {
    run(gradlew, ['--stop', '--quiet'], { cwd: join(dir, 'android'), env: gradleEnv, allowFail: true });
  }
};

const lockHash = createHash('sha256').update(readFileSync(join(dir, 'package-lock.json'))).digest('hex');
const marker = join(dir, 'node_modules', '.build-apk-lock');
if (!existsSync(marker) || readFileSync(marker, 'utf8') !== lockHash) {
  console.log('build-apk: installing packages');
  stopGradle();
  run(win ? 'npm.cmd' : 'npm', ['ci', '--no-audit', '--no-fund'], { cwd: dir });
  writeFileSync(marker, lockHash);
}

console.log('build-apk: generating the Android project');
run(win ? 'npx.cmd' : 'npx', ['expo', 'prebuild', '--platform', 'android'], { cwd: dir, env: { CI: '1' } });
writeFileSync(join(dir, 'android', 'local.properties'), `sdk.dir=${sdk.replace(/\\/g, '/')}\n`);

const abi = args.abi === 'all' ? 'armeabi-v7a,arm64-v8a,x86,x86_64' : (args.abi ?? 'arm64-v8a');
console.log(`build-apk: building ${short} for ${abi} with Java at ${javaHome}`);
const status = run(gradlew, ['assembleRelease', `-PreactNativeArchitectures=${abi}`, '--console=plain'], { cwd: join(dir, 'android'), env: gradleEnv, allowFail: true });
// Leave nothing holding files open for the next install, whether or not it built.
stopGradle();
if (status !== 0) fail('the Gradle build failed; see its output above.');

// --- The APK --------------------------------------------------------------------------

const built = join(dir, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
if (!existsSync(built)) fail(`the build finished but ${built} is missing.`);
mkdirSync(join(root, 'dist'), { recursive: true });
const out = join(root, 'dist', `project-july-${short}.apk`);
copyFileSync(built, out);
console.log(`\nbuild-apk: ${out}`);
console.log('Install it on a phone that has no other build of the app (signing keys differ), or uninstall that first.');
