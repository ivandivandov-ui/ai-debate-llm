const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const rootDir = path.resolve(__dirname, "..");
const frontendDir = path.join(rootDir, "frontend");
const envPath = path.join(rootDir, ".env");

function readEnvValue(key, fallback) {
  if (!fs.existsSync(envPath)) return fallback;
  const lines = fs.readFileSync(envPath, "utf-8").split(/\r?\n/);
  const line = lines.find((entry) => entry.startsWith(`${key}=`));
  if (!line) return fallback;
  return line.slice(key.length + 1).trim() || fallback;
}

const backendHost = readEnvValue("HOST", "localhost");
const backendPort = readEnvValue("PORT", "3000");

function startProcess(name, cwd, scriptPath, args = []) {
  const child = spawn(process.execPath, [scriptPath, ...args], {
    cwd,
    stdio: "inherit",
    env: process.env,
  });

  child.on("exit", (code, signal) => {
    const detail = signal ? `signal ${signal}` : `code ${code}`;
    console.log(`[${name}] exited with ${detail}`);
  });

  return child;
}

const backend = startProcess(
  "backend",
  rootDir,
  path.join(rootDir, "node_modules", "ts-node", "dist", "bin.js"),
  ["src/api/rest/server.ts"]
);

const frontend = startProcess(
  "frontend",
  frontendDir,
  path.join(frontendDir, "node_modules", "vite", "bin", "vite.js")
);

console.log("Synthesis Debate System is starting...");
console.log(`Backend:  http://${backendHost}:${backendPort}`);
console.log("Frontend: http://localhost:5173");

function shutdown() {
  backend.kill();
  frontend.kill();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
