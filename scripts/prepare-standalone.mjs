import { cpSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const standaloneRoot = join(root, ".next", "standalone");
const standaloneNextDir = join(standaloneRoot, ".next");

if (!existsSync(standaloneRoot)) {
  console.warn("[prepare-standalone] .next/standalone not found; skipping.");
  process.exit(0);
}

mkdirSync(standaloneNextDir, { recursive: true });

const staticSrc = join(root, ".next", "static");
const staticDest = join(standaloneNextDir, "static");
if (existsSync(staticSrc)) {
  cpSync(staticSrc, staticDest, { recursive: true });
  console.log("[prepare-standalone] copied .next/static -> .next/standalone/.next/static");
} else {
  console.warn("[prepare-standalone] .next/static not found.");
}

const publicSrc = join(root, "public");
const publicDest = join(standaloneRoot, "public");
if (existsSync(publicSrc)) {
  cpSync(publicSrc, publicDest, { recursive: true });
  console.log("[prepare-standalone] copied public -> .next/standalone/public");
}

