import fs from "fs";
import puppeteer from "puppeteer";

const COMMON_BROWSER_PATHS = [
  "/bin/chromium",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
  "/opt/google/chrome/chrome",
];

function getPuppeteerExecutablePath() {
  try {
    return puppeteer.executablePath();
  } catch {
    return "";
  }
}

export function resolveBrowserExecutablePath() {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    getPuppeteerExecutablePath(),
    ...COMMON_BROWSER_PATHS,
  ].filter(Boolean);

  return candidates.find((candidate) => fs.existsSync(candidate)) || "";
}

export function getBrowserInstallCommand() {
  return "npx puppeteer browsers install chrome";
}