import { execSync } from "child_process";
import { getBrowserInstallCommand, resolveBrowserExecutablePath } from "./prerender-browser.mjs";

const executablePath = resolveBrowserExecutablePath();

if (executablePath) {
  console.log(`[Prerender] Browser ready: ${executablePath}`);
  process.exit(0);
}

const shouldAutoInstall = process.env.PRERENDER_INSTALL_BROWSER === "1";

if (!shouldAutoInstall) {
  console.warn("[Prerender] Browser missing locally; skipping automatic install.");
  console.warn("[Prerender] Run `npx puppeteer browsers install chrome` to enable local prerender validation.");
  process.exit(0);
}

console.log("[Prerender] Browser missing; installing Chrome for prerender...");
execSync(getBrowserInstallCommand(), { stdio: "inherit" });

const installedExecutablePath = resolveBrowserExecutablePath();
if (!installedExecutablePath) {
  throw new Error("Chrome installation finished but the executable is still missing.");
}

console.log(`[Prerender] Browser installed: ${installedExecutablePath}`);
