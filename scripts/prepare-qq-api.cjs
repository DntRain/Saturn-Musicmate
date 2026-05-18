const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const serviceDir = path.join(repoRoot, "src-tauri", "resources", "qq-music-api");

execFileSync(
  "npm",
  [
    "install",
    "--prefix",
    serviceDir,
    "--omit=dev",
    "--no-audit",
    "--no-fund",
    "--loglevel=error",
    "--no-bin-links",
  ],
  { stdio: "inherit" },
);

const accidentalSelf = path.join(serviceDir, "node_modules", "musicmate");
if (fs.existsSync(accidentalSelf)) {
  const real = fs.realpathSync(accidentalSelf);
  if (real === repoRoot) {
    fs.rmSync(accidentalSelf, { recursive: true, force: true });
    console.log(`Removed recursive self-link ${path.relative(repoRoot, accidentalSelf)}`);
  }
}
