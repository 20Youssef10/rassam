const { spawn } = require("child_process");
const path = require("path");

const root = path.resolve(__dirname, "..");
const procs = [];

function run(name, cmd, args, cwd) {
  const child = spawn(cmd, args, { cwd, stdio: "inherit", shell: true, env: process.env });
  child.on("exit", (code) => console.log(`[rassam] ${name} exited ${code}`));
  procs.push(child);
}

console.log("[rassam] starting storage, room, and web…");
run("storage", "npm", ["start"], path.join(root, "storage"));
run("room", "npm", ["start"], path.join(root, "collab"));
setTimeout(() => run("web", "npm", ["run", "dev"], root), 1200);

function shutdown() {
  for (const c of procs) {
    try {
      c.kill("SIGTERM");
    } catch {}
  }
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
