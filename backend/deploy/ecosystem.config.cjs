const path = require("path");

const repoRoot = path.resolve(__dirname, "..", "..");

module.exports = {
  apps: [
    {
      name: "ikf-frontend",
      cwd: path.join(repoRoot, "frontend"),
      script: "npm",
      args: "run start",
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "ikf-backend",
      cwd: path.join(repoRoot, "backend"),
      script: "npm",
      args: "run start",
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "ikf-worker",
      cwd: path.join(repoRoot, "backend"),
      script: "npm",
      args: "run worker",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};

