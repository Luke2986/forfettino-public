#!/usr/bin/env node
/**
 * verify-schema.mjs — Epic 79.6
 *
 * Valida lo schema @graph JSON-LD + badge "Ultimo aggiornamento/Dati aggiornati"
 * visibili nel DOM per le pagine blog + landing prerenderizzate.
 *
 * Parte A — Blog (dist/blog/<slug>/index.html, 13 articoli):
 *   A1. Esiste almeno 1 blocco <script type="application/ld+json"> con top-level @graph (array)
 *   A2. @graph contiene 1 e 1 solo nodo @type=Article
 *   A3. @graph contiene almeno 1 nodo BreadcrumbList, Person (name "Luca Versilia"),
 *       Organization (@id https://forfettino.it/#organization)
 *   A4. Article ha: headline, description, datePublished, dateModified, author, publisher,
 *       mainEntityOfPage, inLanguage === "it-IT", wordCount (number > 500),
 *       image (https://forfettino.it/...)
 *   A5. Article.author e publisher sono oggetti { "@id": ... } che matchano Person/Organization del @graph
 *
 * Parte B — Landing (dist/index.html):
 *   B1. Esiste blocco <script> con top-level @graph
 *   B2. @graph contiene WebPage, FAQPage, SoftwareApplication, Person, Organization, BreadcrumbList
 *   B3. WebPage.inLanguage === "it-IT"
 *   B4. Esiste ANCHE il blocco statico Organization in index.html (con stesso @id)
 *
 * Parte C — Badge visibili nel DOM:
 *   C1. Ogni blog dist HTML contiene "Ultimo aggiornamento:" + <time datetime="YYYY-MM-DD">
 *   C2. Il time.datetime del badge === Article.dateModified (consistency)
 *   C3. dist/index.html contiene "Dati aggiornati a" + <time>
 *
 * Parte D — Cross-reference integrity:
 *   D1. Per ogni pagina con @graph: ogni @id referenziato (author, publisher, founder)
 *       deve risolvere a un nodo con quell'@id presente nello stesso @graph o nel blocco
 *       statico di index.html
 *
 * Parte E — Person & Organization sanity:
 *   E1. Person.name === "Luca Versilia" (esatto)
 *   E2. Person.sameAs e' array, ogni URL https
 *   E3. Organization.logo.url punta a file esistente in public/
 *   E4. Organization.logo.width / height sono numeri
 *
 * Parte F — Citation non vuote (no regression):
 *   F1. Almeno 10 dei 13 blog: Article.citation array non vuoto con CreativeWork
 *   F2. Landing WebPage.citation array >= 6 elementi
 *
 * Exit code 1 su qualsiasi violazione. Messaggi diagnostici nel formato:
 *   [verify-schema] <scope>:<check> FAIL — <message>
 *
 * Usage: npm run build && node scripts/verify-schema.mjs
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { JSDOM } from 'jsdom';

const DIST_DIR = join(process.cwd(), 'dist');
const DIST_BLOG = join(DIST_DIR, 'blog');
const DIST_INDEX = join(DIST_DIR, 'index.html');
const PUBLIC_DIR = join(process.cwd(), 'public');

const errors = [];

function fail(scope, check, message) {
  errors.push(`[verify-schema] ${scope}:${check} FAIL \u2014 ${message}`);
}

function parseJsonLdBlocks(html) {
  const dom = new JSDOM(html);
  const scripts = dom.window.document.querySelectorAll('script[type="application/ld+json"]');
  const blocks = [];
  scripts.forEach((s, idx) => {
    try {
      blocks.push(JSON.parse(s.textContent || ''));
    } catch (e) {
      errors.push(`[verify-schema] jsonld:parse FAIL \u2014 script #${idx}: ${e.message}`);
    }
  });
  return { dom, blocks };
}

function findGraphBlock(blocks) {
  return blocks.find((b) => b && Array.isArray(b['@graph']));
}

function findNode(graph, typeName) {
  return graph.find((n) => n && n['@type'] === typeName);
}

function findNodes(graph, typeName) {
  return graph.filter((n) => n && n['@type'] === typeName);
}

function resolveIdRef(ref, graph, extraGraphs = []) {
  if (!ref || typeof ref !== 'object' || !ref['@id']) return null;
  const targetId = ref['@id'];
  const all = [...graph, ...extraGraphs];
  return all.find((n) => n && n['@id'] === targetId) || null;
}

// ---------------------------------------------------------------------------
// Parte A — Blog
// ---------------------------------------------------------------------------

function validateBlog(slug, htmlPath, staticOrgNode) {
  const scope = `blog:${slug}`;
  const html = readFileSync(htmlPath, 'utf8');
  const { blocks } = parseJsonLdBlocks(html);

  // A1
  const graphBlock = findGraphBlock(blocks);
  if (!graphBlock) {
    fail(scope, 'A1', 'nessun blocco JSON-LD con top-level @graph array trovato');
    return { citationCount: 0 };
  }
  const graph = graphBlock['@graph'];

  // A2
  const articles = findNodes(graph, 'Article');
  if (articles.length !== 1) {
    fail(scope, 'A2', `atteso 1 nodo Article, trovati ${articles.length}`);
  }
  const article = articles[0];

  // A3
  const breadcrumb = findNode(graph, 'BreadcrumbList');
  if (!breadcrumb) fail(scope, 'A3', 'nodo BreadcrumbList mancante');

  const person = findNode(graph, 'Person');
  if (!person) {
    fail(scope, 'A3', 'nodo Person mancante');
  } else if (person.name !== 'Luca Versilia') {
    fail(scope, 'A3', `Person.name atteso "Luca Versilia", trovato "${person.name}"`);
  }

  const org = findNode(graph, 'Organization');
  if (!org) {
    fail(scope, 'A3', 'nodo Organization mancante');
  } else if (org['@id'] !== 'https://forfettino.it/#organization') {
    fail(scope, 'A3', `Organization.@id atteso https://forfettino.it/#organization, trovato ${org['@id']}`);
  }

  // A4 — Article fields
  let citationCount = 0;
  if (article) {
    const required = ['headline', 'description', 'datePublished', 'dateModified', 'author', 'publisher', 'mainEntityOfPage', 'image'];
    for (const field of required) {
      if (article[field] === undefined || article[field] === '' || article[field] === null) {
        fail(scope, 'A4', `Article.${field} mancante o vuoto`);
      }
    }
    if (article.inLanguage !== 'it-IT') {
      fail(scope, 'A4', `Article.inLanguage atteso "it-IT", trovato "${article.inLanguage}"`);
    }
    if (typeof article.wordCount !== 'number' || article.wordCount <= 500) {
      fail(scope, 'A4', `Article.wordCount atteso number > 500, trovato ${article.wordCount}`);
    }
    if (typeof article.image !== 'string' || !article.image.startsWith('https://forfettino.it/')) {
      fail(scope, 'A4', `Article.image deve iniziare con https://forfettino.it/, trovato ${article.image}`);
    }

    // A5 — author/publisher must be @id refs matching Person/Organization in graph
    if (typeof article.author !== 'object' || !article.author['@id']) {
      fail(scope, 'A5', 'Article.author deve essere un riferimento { "@id": ... }');
    } else if (person && article.author['@id'] !== person['@id']) {
      fail(scope, 'A5', `Article.author.@id (${article.author['@id']}) non matcha Person.@id (${person['@id']})`);
    }
    if (typeof article.publisher !== 'object' || !article.publisher['@id']) {
      fail(scope, 'A5', 'Article.publisher deve essere un riferimento { "@id": ... }');
    } else if (org && article.publisher['@id'] !== org['@id']) {
      fail(scope, 'A5', `Article.publisher.@id non matcha Organization.@id`);
    }

    // F1 — citation non vuoto
    if (Array.isArray(article.citation) && article.citation.length > 0) {
      citationCount = article.citation.length;
      const allCreativeWork = article.citation.every((c) => c['@type'] === 'CreativeWork' && typeof c.name === 'string' && c.name.length > 0);
      if (!allCreativeWork) {
        fail(scope, 'F1', 'Article.citation contiene elementi senza @type=CreativeWork o name vuoto');
      }
    }
  }

  // Parte C — badge visibile nel DOM
  const C_marker = 'Ultimo aggiornamento:';
  if (!html.includes(C_marker)) {
    fail(scope, 'C1', 'badge "Ultimo aggiornamento:" non presente nell\'HTML prerenderizzato');
  }
  const timeMatch = html.match(/<time[^>]*datetime="(\d{4}-\d{2}-\d{2})"[^>]*>/);
  if (!timeMatch) {
    fail(scope, 'C1', '<time datetime="YYYY-MM-DD"> non trovato nell\'HTML prerenderizzato');
  } else if (article && article.dateModified) {
    const iso = article.dateModified.slice(0, 10);
    if (timeMatch[1] !== iso) {
      fail(scope, 'C2', `time.datetime (${timeMatch[1]}) !== Article.dateModified (${iso})`);
    }
  }

  // D1 — cross reference integrity
  const extraGraph = staticOrgNode ? [staticOrgNode] : [];
  if (article && article.author) {
    if (!resolveIdRef(article.author, graph, extraGraph)) {
      fail(scope, 'D1', `Article.author.@id ${article.author['@id']} non risolve a nessun nodo`);
    }
  }
  if (article && article.publisher) {
    if (!resolveIdRef(article.publisher, graph, extraGraph)) {
      fail(scope, 'D1', `Article.publisher.@id ${article.publisher['@id']} non risolve`);
    }
  }
  if (org && org.founder && org.founder['@id']) {
    if (!resolveIdRef(org.founder, graph, extraGraph)) {
      fail(scope, 'D1', `Organization.founder.@id ${org.founder['@id']} non risolve`);
    }
  }

  // E — Person/Organization sanity
  if (person) {
    if (person.name !== 'Luca Versilia') fail(scope, 'E1', `Person.name != Luca Versilia`);
    if (!Array.isArray(person.sameAs)) {
      fail(scope, 'E2', 'Person.sameAs non e\' array');
    } else {
      person.sameAs.forEach((u) => {
        if (typeof u !== 'string' || !u.startsWith('https://')) {
          fail(scope, 'E2', `Person.sameAs contiene URL non-https: ${u}`);
        }
      });
    }
  }
  if (org && org.logo && typeof org.logo === 'object') {
    if (typeof org.logo.width !== 'number' || typeof org.logo.height !== 'number') {
      fail(scope, 'E4', 'Organization.logo.width/height devono essere numeri');
    }
    if (typeof org.logo.url === 'string') {
      const logoFilename = org.logo.url.replace('https://forfettino.it/', '');
      const logoPath = join(PUBLIC_DIR, logoFilename);
      if (!existsSync(logoPath)) {
        fail(scope, 'E3', `Organization.logo.url punta a ${logoFilename} ma il file non esiste in public/`);
      }
    }
  }

  return { citationCount };
}

// ---------------------------------------------------------------------------
// Parte B — Landing
// ---------------------------------------------------------------------------

function validateLanding() {
  const scope = 'landing';
  if (!existsSync(DIST_INDEX)) {
    fail(scope, 'file', `${DIST_INDEX} non trovato — eseguire npm run build prima`);
    return { staticOrg: null, landingCitationCount: 0 };
  }
  const html = readFileSync(DIST_INDEX, 'utf8');
  const { blocks } = parseJsonLdBlocks(html);

  // B4 — static Organization block (presente in index.html, stesso @id)
  const staticOrg = blocks.find(
    (b) => b && b['@type'] === 'Organization' && b['@id'] === 'https://forfettino.it/#organization'
  );
  if (!staticOrg) {
    fail(scope, 'B4', 'blocco Organization statico di index.html mancante o senza @id corretto');
  }

  // B1 + B2
  const graphBlock = findGraphBlock(blocks);
  if (!graphBlock) {
    fail(scope, 'B1', 'nessun blocco @graph trovato nella landing');
    return { staticOrg, landingCitationCount: 0 };
  }
  const graph = graphBlock['@graph'];

  const expectedTypes = ['WebPage', 'FAQPage', 'SoftwareApplication', 'Person', 'Organization', 'BreadcrumbList'];
  for (const t of expectedTypes) {
    if (!findNode(graph, t)) {
      fail(scope, 'B2', `nodo ${t} mancante nel @graph landing`);
    }
  }

  const webPage = findNode(graph, 'WebPage');
  if (webPage && webPage.inLanguage !== 'it-IT') {
    fail(scope, 'B3', `WebPage.inLanguage atteso "it-IT", trovato "${webPage.inLanguage}"`);
  }

  // F2 — WebPage.citation >= 6
  let landingCitationCount = 0;
  if (webPage && Array.isArray(webPage.citation)) {
    landingCitationCount = webPage.citation.length;
    if (landingCitationCount < 6) {
      fail(scope, 'F2', `WebPage.citation ha ${landingCitationCount} elementi, atteso >= 6`);
    }
  } else {
    fail(scope, 'F2', 'WebPage.citation mancante o non array');
  }

  // Parte C — badge visibile landing
  if (!html.includes('Dati aggiornati a')) {
    fail(scope, 'C3', 'badge "Dati aggiornati a" non presente in dist/index.html');
  }

  // D1 — cross-reference on landing graph (author, publisher, founder)
  const person = findNode(graph, 'Person');
  const org = findNode(graph, 'Organization');
  const refsToCheck = [];
  if (webPage) refsToCheck.push(['WebPage.author', webPage.author], ['WebPage.publisher', webPage.publisher]);
  const software = findNode(graph, 'SoftwareApplication');
  if (software) refsToCheck.push(['SoftwareApplication.author', software.author]);
  if (org && org.founder) refsToCheck.push(['Organization.founder', org.founder]);

  for (const [label, ref] of refsToCheck) {
    if (ref && ref['@id']) {
      if (!resolveIdRef(ref, graph, staticOrg ? [staticOrg] : [])) {
        fail(scope, 'D1', `${label}.@id ${ref['@id']} non risolve`);
      }
    }
  }

  // E — Person/Organization sanity
  if (person) {
    if (person.name !== 'Luca Versilia') fail(scope, 'E1', 'Person.name != Luca Versilia');
    if (!Array.isArray(person.sameAs)) fail(scope, 'E2', 'Person.sameAs non array');
  }

  return { staticOrg, landingCitationCount };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  if (!existsSync(DIST_DIR)) {
    console.error('[verify-schema] dist/ non trovato. Eseguire npm run build prima.');
    process.exit(1);
  }

  // Landing first (extract static Org for blog cross-ref)
  const { staticOrg } = validateLanding();

  // Blog
  if (!existsSync(DIST_BLOG)) {
    fail('blog', 'dir', 'dist/blog/ non trovata');
  } else {
    const slugs = readdirSync(DIST_BLOG).filter((name) => {
      const p = join(DIST_BLOG, name, 'index.html');
      return existsSync(p);
    });
    if (slugs.length < 13) {
      fail('blog', 'count', `attesi 13 slug blog, trovati ${slugs.length}`);
    }
    let blogsWithCitation = 0;
    for (const slug of slugs) {
      const htmlPath = join(DIST_BLOG, slug, 'index.html');
      const { citationCount } = validateBlog(slug, htmlPath, staticOrg);
      if (citationCount > 0) blogsWithCitation++;
    }
    // F1 — almeno 10 blog con citation non vuoto
    if (blogsWithCitation < 10) {
      fail('blog', 'F1', `solo ${blogsWithCitation}/${slugs.length} blog con Article.citation popolato (atteso >= 10)`);
    }
  }

  if (errors.length > 0) {
    console.error(`[verify-schema] ${errors.length} errori trovati:\n`);
    errors.forEach((e) => console.error(e));
    process.exit(1);
  }
  console.log('[verify-schema] OK — schema @graph, badge visibili e cross-reference validati.');
}

main();
