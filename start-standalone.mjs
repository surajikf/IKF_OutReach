import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const workspaceDir = dirname(fileURLToPath(import.meta.url));
const repoDir = dirname(workspaceDir);
const serverEntrypointCandidates = [
  join(workspaceDir, ".next", "standalone", "server.js"),
  join(workspaceDir, ".next", "standalone", "frontend", "server.js"),
];
const serverEntrypoint = serverEntrypointCandidates.find((candidate) => existsSync(candidate));
const nodeEnv = process.env.NODE_ENV || "production";

if (!serverEntrypoint) {
  const searched = serverEntrypointCandidates.map((entry) => `- ${entry}`).join("\n");
  throw new Error(`Could not find Next standalone server entrypoint. Searched:\n${searched}`);
}

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
  cwd: dirname(serverEntrypoint),
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV: nodeEnv,
    PORT: process.env.PORT || "3000",
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
