#!/usr/bin/env node
/**
 * Local CI — replaces GitHub Actions when the account cannot run workflows.
 * Run: node scripts/local-ci.cjs
 */
const { spawnSync } = require("child_process");
const path = require("path");

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
run("npm", ["ci"]);
run("npm", ["run", "typecheck"]);
run("npm", ["run", "build"]);
run("node", ["--check", "storage/server.js"]);
run("node", ["--check", "collab/server.js"]);
run("npm", ["--prefix", "collab", "install"]);
run("node", ["--check", "collab/server.js"]);
console.log("\n✓ Local CI passed — ready to push / publish images");
