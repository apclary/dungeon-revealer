"use strict";

const path = require("path");
const fs = require("fs-extra");

const pkgRoot = path.resolve(__dirname, "..");

const base = "node_modules/monaco-editor/min";

const monacoFiles = [
  "vs/editor/editor.main.js",
  "vs/editor/editor.main.nls.js",
  "vs/editor/editor.main.css",
  "vs/editor/editor.main.js",
  "vs/basic-languages/markdown/markdown.js",
  "vs/basic-languages/css/css.js",
  "vs/loader.js",
  "vs/base/worker/workerMain.js",
];

for (const file of monacoFiles) {
  const fullPath = path.join(pkgRoot, base, file);
  const outPath = path.join(pkgRoot, "public", "monaco-editor", file);
  fs.mkdirpSync(path.dirname(outPath));
  fs.copyFileSync(fullPath, outPath);
}
