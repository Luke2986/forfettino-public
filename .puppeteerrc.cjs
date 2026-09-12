/**
 * Puppeteer configuration.
 * Skip Chrome download — the prerender script (scripts/prerender.mjs)
 * gracefully handles missing Chrome by exiting with code 0.
 * This prevents postinstall failures in CI/sandbox environments (e.g. Lovable).
 */
module.exports = {
  skipDownload: true,
};
