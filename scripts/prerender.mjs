import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { resolveBrowserExecutablePath } from './prerender-browser.mjs';
import { getPrerenderRoutes } from './seo-content.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(__dirname, '../dist');
const ORIGIN = 'http://prerender.local';

const ROUTES = getPrerenderRoutes();

function shouldRequirePrerender() {
  return process.env.PRERENDER_REQUIRED === '1';
}

function resolveDistFile(requestPathname) {
  let filePath = path.join(distPath, requestPathname);

  if (!path.extname(filePath)) {
    filePath = path.join(filePath, 'index.html');
  }

  return fs.existsSync(filePath) ? filePath : null;
}

function getMimeType(filePath) {
  const mimeTypes = {
    '.css': 'text/css',
    '.gif': 'image/gif',
    '.html': 'text/html',
    '.ico': 'image/x-icon',
    '.jpeg': 'image/jpeg',
    '.jpg': 'image/jpeg',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.txt': 'text/plain',
    '.webmanifest': 'application/manifest+json',
    '.woff2': 'font/woff2',
    '.xml': 'application/xml',
  };

  return mimeTypes[path.extname(filePath)] || 'application/octet-stream';
}

function sanitizePrerenderedHtml(html) {
  return html
    .replace(/<script async="" src="https:\/\/www\.googletagmanager\.com\/gtm\.js\?id=GTM-KR28SMT2"><\/script>/g, '')
    .replace(/<script async="" src="https:\/\/www\.clarity\.ms\/tag\/vw7wr3xdpg"><\/script>/g, '');
}

async function createIsolatedPage(browser, fallbackIndexHtml) {
  const context =
    typeof browser.createBrowserContext === 'function'
      ? await browser.createBrowserContext()
      : await browser.createIncognitoBrowserContext();

  const page = await context.newPage();

  if (typeof page.setBypassServiceWorker === 'function') {
    await page.setBypassServiceWorker(true);
  }
  if (typeof page.setCacheEnabled === 'function') {
    await page.setCacheEnabled(false);
  }

  await page.setRequestInterception(true);
  page.on('request', async (request) => {
    const requestUrl = request.url();

    if (!requestUrl.startsWith(ORIGIN)) {
      await request.abort();
      return;
    }

    const { pathname } = new URL(requestUrl);
    const filePath = resolveDistFile(pathname);
    const body = filePath ? fs.readFileSync(filePath) : fallbackIndexHtml;

    await request.respond({
      status: 200,
      body,
      headers: {
        'content-type': filePath ? getMimeType(filePath) : 'text/html',
      },
    });
  });

  return { context, page };
}

async function prerender() {
  console.log('[Prerender] Starting...');

  if (!fs.existsSync(distPath)) {
    console.error('[Prerender] Error: dist folder not found. Run vite build first.');
    process.exit(1);
  }

  const fallbackIndexHtml = fs.readFileSync(path.join(distPath, 'index.html'));

  const executablePath = resolveBrowserExecutablePath();
  if (!executablePath) {
    if (shouldRequirePrerender()) {
      throw new Error('Could not determine a Chrome/Chromium executable path for required prerender.');
    }
    console.warn('[Prerender] Skipped: Chrome/Chromium executable not found.');
    console.warn('[Prerender] Build will continue without pre-rendering.');
    process.exit(0);
  }

  console.log(`[Prerender] Virtual origin ${ORIGIN}`);
  console.log(`[Prerender] ${ROUTES.length} route(s) queued.`);

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      executablePath,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  } catch (err) {
    if (!shouldRequirePrerender() && (err.code === 'ENOENT' || err.message?.includes('Failed to launch'))) {
      console.warn(`[Prerender] Skipped: Browser launch failed - ${err.message}`);
      console.warn('[Prerender] Build will continue without pre-rendering.');
      process.exit(0);
    }
    throw err;
  }

  try {
    for (const route of ROUTES) {
      const url = `${ORIGIN}${route.path}`;
      console.log(`[Prerender] Rendering ${route.path}...`);

      const { context, page } = await createIsolatedPage(browser, fallbackIndexHtml);

      page.on('console', (msg) => {
        if (msg.type() === 'error' || msg.type() === 'warning') {
          const text = msg.text();
          if (text.includes('hydrat') || text.includes('mismatch') || text.includes('did not match')) {
            console.warn(`[Prerender] ⚠️ React warning on ${route.path}: ${text.substring(0, 200)}`);
          }
        }
      });

      try {
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

        try {
          await page.waitForSelector(route.waitFor, { timeout: 10000 });
        } catch {
          console.warn(`[Prerender] Warning: selector "${route.waitFor}" not found for ${route.path}, saving anyway`);
        }

        const html = sanitizePrerenderedHtml(await page.content());
        const outputPath = path.join(distPath, route.output);
        const outputDir = path.dirname(outputPath);

        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        fs.writeFileSync(outputPath, html);
        console.log(`[Prerender] Saved ${route.output}`);
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }

  console.log(`[Prerender] Done! ${ROUTES.length} pages pre-rendered.`);
}

prerender().catch((err) => {
  console.error('[Prerender] Error:', err.message);
  if (shouldRequirePrerender()) {
    console.error('[Prerender] FATAL: Prerender is required in this environment.');
    process.exit(1);
  }
  console.warn('[Prerender] Build will continue without pre-rendering.');
  process.exit(0);
});
