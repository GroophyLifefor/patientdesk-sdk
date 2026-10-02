#!/usr/bin/env node
// Static docs generator for patientdesk-sdk.
//
//   node scripts/build-docs.mjs
//
// Reads docs/md/*.md and writes:
//   docs/docs/<slug>.html         one page per source, sidebar + TOC + search
//   docs/docs/search-index.json   client-side search index
//   docs/index.html               landing page
//   docs/llms.txt                 link index for LLMs
//   docs/llms-full.txt            every page as raw markdown
//   docs/sitemap.xml              all pages
//   docs/.nojekyll                disable Jekyll on GitHub Pages
//
// Prose rule: no em dashes and no semicolons in the generated documents. Runs
// offline and has no runtime dependencies beyond the `marked` dev dependency.

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Marked } from "marked";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const mdDir = join(root, "docs", "md");
const outDir = join(root, "docs", "docs");

const SITE_NAME = "patientdesk-sdk";
const SITE_TAGLINE =
  "Unofficial SDK for PatientDesk Turkish voice models: Alania text-to-speech and Duyu speech-to-text.";
const SITE_DESCRIPTION =
  "Unofficial TypeScript SDK for PatientDesk Turkish voice models. Alania text-to-speech, Duyu speech-to-text over REST and WebSocket, and a keyless status helper. Zero runtime dependencies.";
const NPM_URL = "https://www.npmjs.com/package/patientdesk-sdk";
const GITHUB_URL = "https://github.com/GroophyLifefor/patientdesk-sdk";
const BASE_URL = (process.env.DOCS_BASE_URL ?? "https://groophylifefor.github.io/patientdesk-sdk").replace(/\/+$/, "");

const NAV = [
  {
    title: "Getting started",
    items: [{ slug: "getting-started", label: "Getting started" }],
  },
  {
    title: "Guides",
    items: [
      { slug: "text-to-speech", label: "Text to speech" },
      { slug: "speech-to-text", label: "Speech to text" },
      { slug: "streaming", label: "Streaming" },
      { slug: "recipes", label: "Node.js recipes" },
    ],
  },
  {
    title: "Reference",
    items: [
      { slug: "configuration", label: "Configuration" },
      { slug: "errors", label: "Errors" },
      { slug: "health-and-status", label: "Health and status" },
    ],
  },
  {
    title: "Testing",
    items: [
      { slug: "testing", label: "Testing" },
      { slug: "troubleshooting", label: "Troubleshooting" },
    ],
  },
];

const labelOf = new Map();
const sectionOf = new Map();
for (const section of NAV) {
  for (const item of section.items) {
    labelOf.set(item.slug, item.label);
    sectionOf.set(item.slug, section.title);
  }
}

// -------------------------------------------------------------- helpers ----

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stripTags(value) {
  return String(value)
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(value) {
  return stripTags(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

function firstParagraph(markdown) {
  const lines = markdown.split(/\r?\n/);
  const buffer = [];
  let started = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#") || trimmed.startsWith("```")) {
      if (started) break;
      continue;
    }
    if (!trimmed) {
      if (started) break;
      continue;
    }
    started = true;
    buffer.push(trimmed);
  }
  return stripTags(buffer.join(" "));
}

function truncate(value, max) {
  const text = stripTags(value);
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

// ----------------------------------------------------- shell highlighting ----

const SHELL_LANGS = new Set(["sh", "bash", "shell", "console", "powershell", "ps", "zsh"]);

function highlightShellLine(line) {
  const commentAt = line.indexOf("#");
  let code = line;
  let comment = "";
  if (commentAt >= 0) {
    // A '#' inside a quoted string is not a comment, keep it simple and only
    // treat it as one at the start of a word.
    const before = line.slice(0, commentAt);
    if (commentAt === 0 || /\s$/.test(before)) {
      code = line.slice(0, commentAt);
      comment = line.slice(commentAt);
    }
  }

  const parts = code.split(/(\s+)/);
  let wordIndex = 0;
  const rendered = parts
    .map((part) => {
      if (/^\s*$/.test(part) || part === "") return part;
      const escaped = escapeHtml(part);
      let cls;
      if (wordIndex === 0) cls = "sh-cli";
      else if (part.startsWith("-")) cls = "sh-flag";
      else if (wordIndex === 1) cls = "sh-cmd";
      else cls = "sh-arg";
      wordIndex += 1;
      return `<span class="${cls}">${escaped}</span>`;
    })
    .join("");

  const tail = comment ? `<span class="sh-comment">${escapeHtml(comment)}</span>` : "";
  return rendered + tail;
}

function renderShellBlock(text) {
  const lines = text.replace(/\n$/, "").split("\n").map(highlightShellLine);
  return `<pre class="shell-block"><code>${lines.join("\n")}\n</code></pre>\n`;
}

// --------------------------------------------------------------- parsing ----

function parseDoc(slug, markdown) {
  const headings = [];
  const seen = new Map();
  const marked = new Marked();

  marked.use({
    renderer: {
      heading(token) {
        const html = this.parser.parseInline(token.tokens);
        const plain = stripTags(html);
        let id = slugify(plain);
        const count = seen.get(id) ?? 0;
        seen.set(id, count + 1);
        if (count > 0) id = `${id}-${count + 1}`;
        if (token.depth === 2 || token.depth === 3) {
          headings.push({ depth: token.depth, text: plain, id });
        }
        return `<h${token.depth} id="${id}">${html}</h${token.depth}>\n`;
      },
      code(token) {
        const lang = String(token.lang ?? "").trim().split(/\s+/)[0].toLowerCase();
        if (lang === "mermaid") {
          const inner = token.text.replace(/\n$/, "");
          return `<figure class="mermaid-figure">\n<div class="mermaid-viewport"><div class="mermaid">${inner}</div></div>\n</figure>\n`;
        }
        if (SHELL_LANGS.has(lang)) {
          return renderShellBlock(token.text);
        }
        return false;
      },
    },
  });

  let html = marked.parse(markdown);

  // Rewrite local markdown links to the generated HTML pages.
  html = html.replace(/href="([^"]+?)\.md(#[^"]*)?"/g, (match, path, hash = "") => {
    if (/^[a-z]+:/i.test(path) || path.startsWith("//")) return match;
    return `href="${path}.html${hash}"`;
  });

  return { html: html.trim(), headings };
}

// ------------------------------------------------------------ templating ----

function sidebarHtml(active) {
  const sections = NAV.map((section) => {
    const items = section.items
      .map((item) => {
        const on = item.slug === active ? ' class="active"' : "";
        return `          <li><a href="${item.slug}.html"${on}>${item.label}</a></li>`;
      })
      .join("\n");
    return `        <div class="nav-section">
          <p class="nav-section-title">${section.title}</p>
          <ul class="nav-list">
${items}
          </ul>
        </div>`;
  }).join("\n");

  return `    <aside class="sidebar" id="sidebar">
      <div class="sidebar-scroll">
        <div class="search">
          <label class="search-label" for="doc-search">Search docs</label>
          <input id="doc-search" type="search" class="search-input"
            placeholder="Search docs" autocomplete="off" spellcheck="false"
            aria-controls="search-results" aria-expanded="false">
          <ul id="search-results" class="search-results" hidden></ul>
        </div>
${sections}
      </div>
    </aside>`;
}

function tocHtml(headings) {
  const items = headings
    .map((h) => `          <li><a href="#${h.id}">${escapeHtml(h.text)}</a></li>`)
    .join("\n");
  return `        <nav class="toc" aria-label="On this page">
          <p class="toc-title">On this page</p>
          <ul>
${items}
          </ul>
        </nav>`;
}

function pageHtml({ slug, title, html, headings, description }) {
  const label = labelOf.get(slug) ?? title;
  const canonical = `${BASE_URL}/docs/${slug}.html`;
  const toc = tocHtml(headings);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(label)} · ${SITE_NAME} docs</title>
  <meta name="description" content="${escapeHtml(truncate(description, 180))}">
  <link rel="canonical" href="${canonical}">
  <meta property="og:title" content="${escapeHtml(label)} · ${SITE_NAME} docs">
  <meta property="og:description" content="${escapeHtml(truncate(description, 180))}">
  <meta property="og:type" content="article">
  <link rel="stylesheet" href="../assets/site.css">
  <script defer src="https://umami.ordu.dev/script.js" data-website-id="250bd07e-3f44-447c-9e94-b4b012366c75"></script>
</head>
<body class="layout-doc">
  <header class="site-header">
    <div class="site-header-inner">
      <a class="brand site-brand" href="../index.html">${SITE_NAME}</a>
      <nav class="topnav" aria-label="Site">
        <a class="toplink on" href="${slug}.html">Documentation</a>
        <a class="toplink" href="${NPM_URL}">npm</a>
        <a class="toplink" href="${GITHUB_URL}">GitHub</a>
      </nav>
      <button type="button" class="sidebar-toggle" aria-label="Open menu" hidden></button>
    </div>
  </header>
  <div class="layout-body">
${sidebarHtml(slug)}
    <div class="content-column">
      <main class="doc-main">
        <article class="markdown prose">${html}</article>
        <footer class="doc-footer">
          <p>${SITE_NAME} is unofficial and not affiliated with PatientDesk. MIT licensed.</p>
        </footer>
      </main>
${toc}
    </div>
  </div>
  <script src="../assets/docs.js" defer></script>
</body>
</html>
`;
}

const HERO_CODE = `import { PatientDesk } from "patientdesk-sdk";

const pd = new PatientDesk({ apiKey: process.env.PATIENDESK_API_KEY });

// Alania text to speech -> an audio Response
const speech = await pd.speech.create({
  input: "Randevunuz yarın saat 14:05 için oluşturuldu.",
  response_format: "wav",
});

// Duyu speech to text -> the transcript
const { text } = await pd.audio.transcribe({
  audio: await speech.arrayBuffer(),
  audio_format: "wav",
  language: "tr",
});`;

function indexHtml() {
  const rows = NAV.flatMap((section) =>
    section.items.map(
      (item) => `        <a class="index-row" href="docs/${item.slug}.html">
          <span class="index-row-section">${section.title}</span>
          <span class="index-row-label">${item.label}</span>
          <span class="index-row-arrow" aria-hidden="true">&rarr;</span>
        </a>`,
    ),
  ).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${SITE_NAME} — Turkish voice models, one small SDK</title>
  <meta name="description" content="${escapeHtml(SITE_DESCRIPTION)}">
  <link rel="canonical" href="${BASE_URL}/">
  <meta property="og:title" content="${SITE_NAME}">
  <meta property="og:description" content="${escapeHtml(SITE_DESCRIPTION)}">
  <meta property="og:type" content="website">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,600;12..96,700&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500;600;700&family=Karla:wght@400;500;600;700&display=swap">
  <link rel="stylesheet" href="assets/site.css">
  <script defer src="https://umami.ordu.dev/script.js" data-website-id="250bd07e-3f44-447c-9e94-b4b012366c75"></script>
</head>
<body class="layout-home">
  <header class="site-header">
    <div class="site-header-inner">
      <a class="brand site-brand" href="index.html">${SITE_NAME}</a>
      <nav class="topnav" aria-label="Site">
        <a class="toplink on" href="docs/getting-started.html">Docs</a>
        <a class="toplink" href="${NPM_URL}">npm</a>
        <a class="toplink" href="${GITHUB_URL}">GitHub</a>
      </nav>
    </div>
  </header>

  <main>
    <section class="home-section pd-hero">
      <p class="pd-kicker"><span class="pd-dot" aria-hidden="true"></span>Unofficial &middot; all models &middot; one key</p>
      <h1 class="pd-title">Turkish speech.<br><em>One small SDK.</em></h1>
      <p class="pd-lead">
        Alania text to speech and Duyu speech to text, wrapped for TypeScript.
        Zero runtime dependencies, works on Node 18+, Deno, Bun and edge runtimes.
      </p>
      <div class="pd-actions">
        <a class="pd-btn pd-btn-primary" href="docs/getting-started.html">Get started</a>
        <a class="pd-btn" href="docs/speech-to-text.html">Read the docs</a>
      </div>
      <div class="pd-install"><span class="pd-prompt">$</span><code>npm install patientdesk-sdk</code></div>

      <div class="pd-stage">
        <div class="pd-stage-head">
          <span class="pd-stage-dot"></span><span class="pd-stage-dot"></span><span class="pd-stage-dot"></span>
          <span class="pd-stage-title">TypeScript SDK</span>
          <span class="pd-stage-badge">npm install patientdesk-sdk</span>
        </div>
        <pre class="pd-stage-code"><code class="language-ts">${escapeHtml(HERO_CODE)}</code></pre>
      </div>
    </section>

    <section class="home-section pd-metrics">
      <div class="pd-metric">
        <span class="pd-metric-value">0</span>
        <span class="pd-metric-label">runtime dependencies</span>
      </div>
      <div class="pd-metric">
        <span class="pd-metric-value">&le;5k</span>
        <span class="pd-metric-label">characters per Alania call</span>
      </div>
      <div class="pd-metric">
        <span class="pd-metric-value">6</span>
        <span class="pd-metric-label">TTS output formats</span>
      </div>
      <div class="pd-metric">
        <span class="pd-metric-value">57</span>
        <span class="pd-metric-label">offline unit tests</span>
      </div>
    </section>

    <section class="home-section pd-index">
      <div class="pd-index-head">
        <p class="pd-kicker">Guides and reference</p>
        <h2 class="pd-index-title">Everything, documented.</h2>
        <p class="pd-index-lead">Short pages that track the real API surface: inputs,
        outputs, retries, failures and how to tell our bug from PatientDesk's.</p>
      </div>
      <nav class="pd-index-list" aria-label="Documentation">
${rows}
      </nav>
    </section>

    <section class="home-section pd-cta">
      <h2 class="pd-index-title">Start in two lines.</h2>
      <div class="pd-cta-actions">
        <a class="pd-btn pd-btn-primary" href="docs/getting-started.html">Get started</a>
        <a class="pd-btn pd-btn-dark" href="${GITHUB_URL}">GitHub</a>
      </div>
    </section>
  </main>

  <footer class="home-footer">
    <span>Not affiliated with or endorsed by PatientDesk. MIT licensed.</span>
    <nav aria-label="Footer">
      <a href="${GITHUB_URL}">GitHub</a>
      <a href="${NPM_URL}">npm</a>
      <a href="llms.txt">llms.txt</a>
    </nav>
  </footer>
  <script src="assets/docs.js" defer></script>
</body>
</html>
`;
}

// ----------------------------------------------------------------- build ----

function build() {
  if (!existsSync(mdDir)) {
    console.error(`[docs] no markdown directory at ${mdDir}`);
    process.exit(1);
  }
  mkdirSync(outDir, { recursive: true });

  const searchIndex = [];
  const pages = [];
  const missing = [];

  for (const section of NAV) {
    for (const item of section.items) {
      const file = join(mdDir, `${item.slug}.md`);
      if (!existsSync(file)) {
        missing.push(item.slug);
        continue;
      }
      const markdown = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
      const { html, headings } = parseDoc(item.slug, markdown);
      const description = firstParagraph(markdown);

      writeFileSync(
        join(outDir, `${item.slug}.html`),
        pageHtml({ slug: item.slug, title: item.label, html, headings, description }),
      );

      searchIndex.push({
        slug: item.slug,
        label: item.label,
        section: section.title,
        heading: "",
        hash: "",
      });
      for (const heading of headings) {
        searchIndex.push({
          slug: item.slug,
          label: item.label,
          section: section.title,
          heading: heading.text,
          hash: heading.id,
        });
      }

      pages.push({ ...item, section: section.title, markdown, description, headings });
    }
  }

  if (missing.length) {
    console.error(`[docs] missing markdown for: ${missing.join(", ")}`);
    process.exit(1);
  }

  // Search index, loaded by assets/docs.js on focus.
  writeFileSync(join(outDir, "search-index.json"), `${JSON.stringify(searchIndex)}\n`);

  // Landing page and Jekyll opt-out.
  writeFileSync(join(root, "docs", "index.html"), indexHtml());
  writeFileSync(join(root, "docs", ".nojekyll"), "");

  // llms.txt: a compact, sectioned link index.
  const llms = [
    `# ${SITE_NAME}`,
    "",
    `> ${SITE_DESCRIPTION}`,
    "",
  ];
  for (const section of NAV) {
    llms.push(`## ${section.title}`, "");
    for (const item of section.items) {
      llms.push(`- [${item.label}](${BASE_URL}/docs/${item.slug}.md)`);
    }
    llms.push("");
  }
  writeFileSync(join(root, "docs", "llms.txt"), `${llms.join("\n").trimEnd()}\n`);

  // llms-full.txt: every page as raw markdown, citable by source URL.
  const full = [`# ${SITE_NAME}`, "", `> ${SITE_DESCRIPTION}`, "", "---", ""];
  for (const page of pages) {
    full.push(`Source: ${BASE_URL}/docs/${page.slug}.md`, "");
    full.push(page.markdown.trimEnd(), "", "---", "");
  }
  writeFileSync(join(root, "docs", "llms-full.txt"), `${full.join("\n").trimEnd()}\n`);

  // sitemap.xml: the landing page plus every doc page.
  const urls = [`${BASE_URL}/`, ...pages.map((p) => `${BASE_URL}/docs/${p.slug}.html`)];
  const sitemap = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((url) => `  <url><loc>${url}</loc></url>`),
    "</urlset>",
    "",
  ].join("\n");
  writeFileSync(join(root, "docs", "sitemap.xml"), sitemap);

  console.log(`[docs] wrote ${pages.length} pages + index, search index, llms files and sitemap`);
  console.log(`[docs] base URL: ${BASE_URL}`);
}

build();
