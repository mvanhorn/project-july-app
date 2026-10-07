// Windows only (EAS builds on Linux are untouched): native C++ builds pass
// Windows' 260-character path limit, and ninja then fails with "build.ninja
// still dirty after 100 tries" or "Filename longer than 260 characters".
//  - CMake 3.31.6 ships ninja 1.12, which handles long paths once they're
//    enabled in Windows (LongPathsEnabled). The SDK's default 3.22.1 can't.
//    Install it with: sdkmanager "cmake/3.31.6"
//  - Libraries build under the shorter android/.cxx/<lib> rather than
//    node_modules/<lib>/android/.cxx (expo-modules-core is nested two levels deep).
const { withDangerousMod, withProjectBuildGradle } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const CMAKE_VERSION = '3.31.6';

const SHORT_CXX_PATHS = `
// Short CMake staging paths on Windows (plugins/withWindowsNativeBuild.js)
if (System.getProperty('os.name').toLowerCase().contains('windows')) {
  subprojects { p ->
    p.plugins.withId('com.android.library') {
      p.android.externalNativeBuild.cmake.buildStagingDirectory = new File(rootDir, ".cxx/\${p.name}")
    }
  }
}
`;

function findCmakeDir() {
  const sdk = process.env.ANDROID_HOME || path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk');
  const dir = path.join(sdk, 'cmake', CMAKE_VERSION);
  return fs.existsSync(dir) ? dir : null;
}

module.exports = function withWindowsNativeBuild(config) {
  if (process.platform !== 'win32') return config;

  config = withProjectBuildGradle(config, (cfg) => {
    if (!cfg.modResults.contents.includes('withWindowsNativeBuild')) {
      cfg.modResults.contents += SHORT_CXX_PATHS;
    }
    return cfg;
  });

  // cmake.dir in local.properties picks the CMake for every module.
  return withDangerousMod(config, ['android', async (cfg) => {
    const cmakeDir = findCmakeDir();
    if (!cmakeDir) {
      console.warn(`withWindowsNativeBuild: CMake ${CMAKE_VERSION} isn't installed; run sdkmanager "cmake/${CMAKE_VERSION}"`);
      return cfg;
    }
    const file = path.join(cfg.modRequest.platformProjectRoot, 'local.properties');
    const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    const lines = existing.split(/\r?\n/).filter((l) => l && !l.startsWith('cmake.dir='));
    lines.push(`cmake.dir=${cmakeDir.replace(/\\/g, '/')}`);
    fs.writeFileSync(file, lines.join('\n') + '\n');
    return cfg;
  }]);
};
