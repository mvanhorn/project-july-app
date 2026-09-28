// Dev-only Node preload. Some drives (like P:\ on the maintainer's machine)
// refuse to load native .node binaries, which breaks Metro's CSS transform
// (lightningcss) and ESLint's resolver. This loads each binary from a copy in
// the OS temp dir instead. Use it only if you see "Access is denied" or
// "Cannot find native binding":
//   set NODE_OPTIONS=--require ./scripts/dev/native-from-c.cjs
const Module = require('module');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmp = path.resolve(os.tmpdir());
const load = Module._extensions['.node'];
Module._extensions['.node'] = function (module, filename) {
  if (path.parse(filename).root.toLowerCase() !== path.parse(tmp).root.toLowerCase()) {
    const st = fs.statSync(filename);
    const copy = path.join(tmp, 'july-native', `${st.size}-${path.basename(filename)}`);
    if (!fs.existsSync(copy)) {
      fs.mkdirSync(path.dirname(copy), { recursive: true });
      fs.copyFileSync(filename, copy);
    }
    return load.call(this, module, copy);
  }
  return load.call(this, module, filename);
};
