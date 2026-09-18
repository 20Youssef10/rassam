#!/usr/bin/env node
/**
 * Local CI — replaces GitHub Actions when the account cannot run workflows.
 * Run: node scripts/local-ci.cjs
 */
const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const root = path.resolve(__dirname, "..");

function run(cmd, args, cwd = root) {
  console.log(`\n▸ ${cmd} ${args.join(" ")}  (in ${cwd})`);
  const res = spawnSync(cmd, args, { cwd, stdio: "inherit", shell: true });
  if (res.status !== 0) {
    console.error(`✗ failed: ${cmd} ${args.join(" ")}`);
    process.exit(res.status || 1);
  }
  console.log("✓ ok");
}

console.log("Rassam local CI");
const hasModules = fs.existsSync(path.join(root, "node_modules", "vite"));
if (hasModules) {
  console.log("node_modules present — skip npm ci (Windows EPERM on locked binaries)");
} else {
  run("npm", ["ci"]);
}
run("npm", ["run", "typecheck"]);
run("npm", ["run", "build"]);
run("node", ["--check", path.join(root, "storage", "server.js")]);
run("node", ["--check", path.join(root, "collab", "server.js")]);
console.log("\n✓ Local CI passed");
console.log("Next (manual GHCR): bash scripts/publish-ghcr.sh v0.1.0");
console.log("Contributor cleanup: git push --force origin main && git push --force origin v0.1.0");
