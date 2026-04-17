import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const workspaceDir = dirname(fileURLToPath(import.meta.url));
const repoDir = dirname(workspaceDir);
const serverEntrypoint = join(workspaceDir, ".next", "standalone", "backend", "server.js");
const nodeEnv = process.env.NODE_ENV || "production";

for (const envFile of [
  join(workspaceDir, `.env.${nodeEnv}.local`),
  join(workspaceDir, ".env.local"),
  join(workspaceDir, `.env.${nodeEnv}`),
  join(workspaceDir, ".env"),
  join(repoDir, `.env.${nodeEnv}.local`),
  join(repoDir, ".env.local"),
  join(repoDir, `.env.${nodeEnv}`),
  join(repoDir, ".env"),
]) {
  if (existsSync(envFile)) {
    process.loadEnvFile(envFile);
  }
}

const child = spawn(process.execPath, [serverEntrypoint], {
  cwd: workspaceDir,
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV: nodeEnv,
    PORT: process.env.PORT || "3001",
    HOSTNAME: process.env.HOSTNAME || "0.0.0.0",
  },
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
