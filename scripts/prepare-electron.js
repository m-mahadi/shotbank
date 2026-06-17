/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");

const root = process.cwd();
const standaloneRoot = path.join(root, ".next", "standalone");

function copyIfExists(from, to) {
  if (!fs.existsSync(from)) return;
  fs.rmSync(to, { recursive: true, force: true });
  fs.cpSync(from, to, { recursive: true });
}

if (!fs.existsSync(standaloneRoot)) {
  throw new Error("Missing .next/standalone. Run `npm run build` first.");
}

copyIfExists(path.join(root, ".next", "static"), path.join(standaloneRoot, ".next", "static"));
copyIfExists(path.join(root, "public"), path.join(standaloneRoot, "public"));
