#!/usr/bin/env node
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverTs = path.join(__dirname, "server.ts");
const localTsx = path.join(__dirname, "node_modules", ".bin", "tsx");

console.log("[Sadtyar Bot] Starting server via tsx runner...");

const cmd = fs.existsSync(localTsx) ? localTsx : "npx";
const args = fs.existsSync(localTsx) ? [serverTs] : ["tsx", serverTs];

const child = spawn(cmd, args, {
  stdio: "inherit",
  env: process.env
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code || 0);
  }
});

