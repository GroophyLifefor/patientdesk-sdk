#!/usr/bin/env node
// docwatch — watch PatientDesk's public docs for changes.
//
//   node scripts/docwatch.mjs diff   # read-only: compare and exit 1 on drift
//   node scripts/docwatch.mjs sync   # write snapshots + a drift report
//
// Pages are discovered from sitemap.xml (`/docs/...` and `/en/docs/...`),
// fetched, and reduced to normalized text extracted from <article> inside
// <main id="docs-main">. Snapshots live under upstream-docs/<lang>/docs/.
//
// Zero dependencies; Node 20+ (global fetch).

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");

const USER_AGENT = "patientdesk-sdk-docwatch/1.0 (+https://github.com/GroophyLifefor/patientdesk-sdk)";
const DEFAULT_BASE = "https://speech.patientdesk.ai";
const DEFAULT_OUT = "upstream-docs";
const DEFAULT_REPORT = "drift-report.md";
const DEFAULT_LANGS = ["tr", "en"];
const DOC_PATH = /^\/(en\/)?docs(?:\/|$)/;

// ------------------------------------------------------------------ args ----

function parseArgs(argv) {
  const args = {
    mode: argv[0],
    base: process.env.DOCWATCH_BASE_URL ?? DEFAULT_BASE,
    out: join(repoRoot, process.env.DOCWATCH_OUT ?? DEFAULT_OUT),
    report: null,
    langs: (process.env.DOCWATCH_LANGS ?? DEFAULT_LANGS.join(",")).split(","),
    concurrency: 4,
    maxDiffLines: 200,
  };
  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--base") args.base = argv[++i];
    else if (arg === "--out") args.out = argv[++i];
    else if (arg === "--report") args.report = argv[++i];
    else if (arg === "--langs") args.langs = argv[++i].split(",");
    else if (arg === "--concurrency") args.concurrency = Number(argv[++i]);
    else if (arg === "--max-diff-lines") args.maxDiffLines = Number(argv[++i]);
    else throw new Error(`unknown argument: ${arg}`);
  }
  args.base = args.base.replace(/\/+$/, "");
  args.langs = args.langs.map((l) => l.trim()).filter(Boolean);
  return args;
}

const usage = () => {
  console.error(`usage: node scripts/docwatch.mjs <diff|sync> [options]

  --base URL           docs origin (default ${DEFAULT_BASE})
  --out DIR            snapshot directory (default upstream-docs)
  --report FILE        write the report to FILE (default: ${DEFAULT_REPORT} on sync, stdout on diff)
  --langs LIST         comma-separated langs (default tr,en)
  --concurrency N      parallel fetches (default 4)
  --max-diff-lines N   per-page diff cap in the report (default 200)`);
};

// --------------------------------------------------------------- fetching ----

async function fetchText(url, { attempts = 3, timeoutMs = 30_000, headers = {} } = {}) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error(`timeout after ${timeoutMs} ms`)), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: {
          "user-agent": USER_AGENT,
          accept: "text/html,application/xml,text/plain,*/*",
          ...headers,
        },
        signal: controller.signal,
        redirect: "follow",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.text();
    } catch (err) {
      lastError = err;
      if (attempt + 1 < attempts) await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`could not fetch ${url}: ${lastError?.message ?? lastError}`);
}

export function pageListFromSitemap(xml, base, langs) {
  const pages = [];
  const seen = new Set();
  for (const match of xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) {
    let url;
    try {
      url = new URL(match[1]);
    } catch {
      continue;
    }
    if (url.origin !== new URL(base).origin) continue;
    const path = url.pathname.replace(/\/+$/, "") || "/";
    if (!DOC_PATH.test(path)) continue;
    const lang = path.startsWith("/en/") ? "en" : "tr";
    if (!langs.includes(lang)) continue;
    const key = `${lang}${path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    // The site picks the language from the route, not from headers or geo, so
    // fetch the locale-prefixed URL: /tr/docs/... or /en/docs/...
    const fetchPath = lang === "en" ? path : `/tr${path}`;
    pages.push({ url: `${base}${path}`, fetchUrl: `${base}${fetchPath}`, lang, path });
  }
  pages.sort((a, b) => a.url.localeCompare(b.url));
  return pages;
}

// ------------------------------------------------------------- extraction ----

const NAMED_ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  laquo: "«",
  raquo: "»",
  times: "×",
  middot: "·",
  bull: "•",
  deg: "°",
  euro: "€",
  pound: "£",
  trade: "™",
  copy: "©",
  reg: "®",
};

function decodeEntities(value) {
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (whole, body) => {
    if (body[0] === "#") {
      const code = body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : whole;
    }
    const named = NAMED_ENTITIES[body.toLowerCase()];
    return named ?? whole;
  });
}

/** Reduce a docs page's HTML to stable, line-oriented plain text. */
export function extractArticle(html, url = "page") {
  const main =
    html.match(/<main\b[^>]*id="docs-main"[^>]*>([\s\S]*?)<\/main>/i) ?? html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  if (!main) throw new Error(`no <main> element found in ${url}`);
  // Most pages wrap the content in <article>; the docs landing has no article.
  const article = main[1].match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  let text = article ? article[1] : main[1];
  text = text.replace(/<script\b[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style\b[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<svg\b[\s\S]*?<\/svg>/gi, "");
  text = text.replace(/<(?:button|iframe|nav|aside)\b[\s\S]*?<\/(?:button|iframe|nav|aside)>/gi, " ");
  text = text.replace(/<!--[\s\S]*?-->/g, "");
  // Decorative pieces (heading permalink "#", icons) are aria-hidden.
  text = text.replace(/<span\b[^>]*aria-hidden="true"[^>]*>[\s\S]*?<\/span>/gi, "");
  // Heading permalink anchors (`<a ...>#</a>`) carry no content.
  text = text.replace(/<a\b[^>]*>\s*(?:#|¶|§)\s*<\/a>/gi, "");

  text = text.replace(/<(?:br|hr)\b[^>]*\/?>/gi, "\n");
  text = text.replace(/<h([1-6])\b[^>]*>/gi, (_m, level) => `\n${"#".repeat(Number(level))} `);
  text = text.replace(/<li\b[^>]*>/gi, "\n- ");
  text = text.replace(/<tr\b[^>]*>/gi, "\n");
  text = text.replace(/<\/(?:td|th)\s*>/gi, " | ");
  text = text.replace(/<(?:p|div|ul|ol|pre|table|thead|tbody|blockquote|section|details|summary|dl|figure)\b[^>]*>/gi, "\n");
  text = text.replace(
    /<\/(?:p|div|li|ul|ol|h[1-6]|pre|table|thead|tbody|tr|blockquote|section|details|summary|dl|dt|dd|figure|figcaption)\s*>/gi,
    "\n",
  );
  text = text.replace(/<[^>]+>/g, "");
  text = decodeEntities(text);

  const lines = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+/g, " ").trim();
    if (line) lines.push(line);
  }
  return lines.join("\n") + "\n";
}

// -------------------------------------------------------------------- diff ----

/** Line-level unified diff (LCS). Good enough for docs-sized files. */
export function unifiedDiff(oldText, newText, { context = 2, maxLines = Infinity } = {}) {
  const a = oldText ? oldText.replace(/\n$/, "").split("\n") : [];
  const b = newText ? newText.replace(/\n$/, "").split("\n") : [];
  const n = a.length;
  const m = b.length;
  const changed = countChanges(a, b);
  if (changed.added === 0 && changed.removed === 0) return { text: "", added: 0, removed: 0, truncated: false };

  if (n * m > 4_000_000) {
    const lines = [...a.map((l) => `-${l}`), ...b.map((l) => `+${l}`)];
    return { text: lines.slice(0, maxLines).join("\n"), added: m, removed: n, truncated: lines.length > maxLines };
  }

  // LCS table over lines.
  const width = m + 1;
  const table = new Uint32Array((n + 1) * width);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i * width + j] =
        a[i] === b[j] ? table[(i + 1) * width + j + 1] + 1 : Math.max(table[(i + 1) * width + j], table[i * width + j + 1]);
    }
  }
  const ops = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ type: "eq", line: a[i] });
      i++;
      j++;
    } else if (table[(i + 1) * width + j] >= table[i * width + j + 1]) {
      ops.push({ type: "del", line: a[i] });
      i++;
    } else {
      ops.push({ type: "add", line: b[j] });
      j++;
    }
  }
  while (i < n) ops.push({ type: "del", line: a[i++] });
  while (j < m) ops.push({ type: "add", line: b[j++] });

  // Group into hunks with context.
  const hunks = [];
  let index = 0;
  while (index < ops.length) {
    if (ops[index].type === "eq") {
      index++;
      continue;
    }
    let start = index;
    while (start > 0 && ops[start - 1].type === "eq") start--;
    start = Math.max(start, index - context);
    let end = index;
    while (end < ops.length) {
      if (ops[end].type !== "eq") {
        end++;
        continue;
      }
      let run = 0;
      while (end + run < ops.length && ops[end + run].type === "eq") run++;
      if (run > context * 2 || end + run >= ops.length) break;
      end += run;
    }
    const stop = Math.min(ops.length, end + context);
    hunks.push({ start, ops: ops.slice(start, stop) });
    index = stop;
  }

  const out = [];
  let truncated = false;
  for (const hunk of hunks) {
    const oldStart = a.length ? countBefore(ops, hunk.start, "add") + 1 : 0;
    const newStart = b.length ? countBefore(ops, hunk.start, "del") + 1 : 0;
    const oldCount = hunk.ops.filter((o) => o.type !== "add").length;
    const newCount = hunk.ops.filter((o) => o.type !== "del").length;
    out.push(`@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`);
    for (const op of hunk.ops) {
      if (out.length >= maxLines) {
        truncated = true;
        break;
      }
      out.push(op.type === "eq" ? ` ${op.line}` : op.type === "del" ? `-${op.line}` : `+${op.line}`);
    }
    if (truncated) break;
  }
  return { text: out.join("\n"), added: changed.added, removed: changed.removed, truncated };
}

function countBefore(ops, index, type) {
  let count = 0;
  for (let k = 0; k < index; k++) if (ops[k].type !== type) count++;
  return count;
}

function countChanges(a, b) {
  const set = new Map();
  for (const line of a) set.set(line, (set.get(line) ?? 0) + 1);
  for (const line of b) set.set(line, (set.get(line) ?? 0) - 1);
  let added = 0;
  let removed = 0;
  for (const delta of set.values()) {
    if (delta < 0) added -= delta;
    else removed += delta;
  }
  return { added, removed };
}

// ---------------------------------------------------------------- snapshot ----

export function snapshotPath(out, page) {
  const path = page.path.replace(/^\/en(?=\/docs)/, "");
  const rest = path.replace(/^\/docs\/?/, "");
  const file = rest ? `${rest.replace(/\/+$/, "")}.md` : "index.md";
  return join(out, page.lang, "docs", file.split("/").map(sanitizeSegment).join(sep));
}

function sanitizeSegment(segment) {
  return segment.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

function readSnapshot(out, page) {
  const file = snapshotPath(out, page);
  try {
    return readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

function walkSnapshotPages(out, langs) {
  const files = [];
  for (const lang of langs) {
    const root = join(out, lang, "docs");
    if (!existsSync(root)) continue;
    const stack = [root];
    while (stack.length) {
      const dir = stack.pop();
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) stack.push(full);
        else if (entry.endsWith(".md")) files.push(full);
      }
    }
  }
  return files;
}

// ------------------------------------------------------------------ report ----

export function formatReport({ base, changes, maxDiffLines, generatedAt, maxChars = 60_000 }) {
  const header = [
    `# Doküman değişiklik raporu`,
    ``,
    `- Kaynak: ${base}`,
    `- Zaman: ${generatedAt}`,
    ``,
  ];
  const table = ["| Sayfa | Durum | Değişiklik |", "| --- | --- | --- |"];
  for (const change of changes) {
    const amount = change.status === "added" ? `+${change.diff.added}` : change.status === "removed" ? `−${change.diff.removed}` : `+${change.diff.added} −${change.diff.removed}`;
    table.push(`| ${change.key} | ${change.label} | ${amount} |`);
  }
  const intro = [...header, "## Özet", "", ...table, "", "## Değişiklikler", ""];
  const introChars = intro.reduce((sum, line) => sum + line.length + 1, 0);
  const budget = Math.max(1_000, maxChars - introChars - 400);
  const body = [];
  let used = 0;
  let truncated = false;
  for (const change of changes) {
    const section = [`### ${change.key}`, ``, `[${change.url}](${change.url})`, ``];
    const diff = formatDiff(change, maxDiffLines);
    section.push("```diff", diff.text || "(özet fark üretilemedi)");
    if (diff.truncated) section.push(`… (kısaltıldı; tam fark snapshot commit'inde)`);
    section.push("```", "");
    const sectionChars = section.reduce((sum, line) => sum + line.length + 1, 0);
    if (used + sectionChars > budget) {
      truncated = true;
      break;
    }
    used += sectionChars;
    body.push(...section);
  }
  if (truncated) {
    body.push(`… (rapor boyutu sınırına ulaşıldı. Kalan sayfalar burada listelenmedi; tam rapor workflow artifact'ında.)`, "");
  }
  return [...intro, ...body].join("\n");
}

function formatDiff(change, maxDiffLines) {
  if (change.status === "added") {
    const lines = change.newText.replace(/\n$/, "").split("\n").slice(0, maxDiffLines);
    return { text: lines.map((l) => `+${l}`).join("\n"), truncated: change.newText.split("\n").length > maxDiffLines };
  }
  if (change.status === "removed") {
    const lines = change.oldText.replace(/\n$/, "").split("\n").slice(0, maxDiffLines);
    return { text: lines.map((l) => `-${l}`).join("\n"), truncated: change.oldText.split("\n").length > maxDiffLines };
  }
  return unifiedDiff(change.oldText, change.newText, { maxLines: maxDiffLines });
}

// -------------------------------------------------------------------- main ----

async function collect(args) {
  const sitemap = await fetchText(`${args.base}/sitemap.xml`);
  const pages = pageListFromSitemap(sitemap, args.base, args.langs);
  if (!pages.length) throw new Error(`sitemap listed no docs pages under ${args.base}`);

  const results = new Map();
  let cursor = 0;
  const workers = Array.from({ length: Math.max(1, args.concurrency) }, async () => {
    for (;;) {
      const page = pages[cursor++];
      if (!page) return;
      const html = await fetchText(page.fetchUrl, {
        headers: { "accept-language": page.lang === "tr" ? "tr-TR,tr;q=0.9" : "en-US,en;q=0.9" },
      });
      results.set(page.url, extractArticle(html, page.url));
    }
  });
  await Promise.all(workers);
  return pages.map((page) => ({ ...page, text: results.get(page.url) }));
}

export function pageKey(page) {
  const path = page.path.replace(/^\/en(?=\/docs)/, "");
  return `${page.lang}${path}`;
}

function diffAgainstSnapshots(args, pages) {
  const changes = [];
  const visited = new Set();
  for (const page of pages) {
    const file = snapshotPath(args.out, page);
    visited.add(file);
    const oldText = readSnapshot(args.out, page);
    const key = pageKey(page);
    if (oldText === null) {
      changes.push({ key, url: page.url, status: "added", label: "yeni", oldText: "", newText: page.text, diff: unifiedDiff("", page.text) });
    } else if (oldText !== page.text) {
      changes.push({ key, url: page.url, status: "changed", label: "değişti", oldText, newText: page.text, diff: unifiedDiff(oldText, page.text) });
    }
  }
  for (const file of walkSnapshotPages(args.out, args.langs)) {
    if (visited.has(file)) continue;
    const oldText = readFileSync(file, "utf8");
    const rel = relative(args.out, file).split(sep).join("/").replace(/\.md$/, "");
    const [lang, ...rest] = rel.split("/");
    const sub = rest.slice(1).join("/"); // drop the "docs" segment
    const path = sub && sub !== "index" ? `/docs/${sub}` : "/docs";
    const url = `${args.base}${lang === "en" ? "/en" : ""}${path}`;
    changes.push({ key: `${lang}${path}`, url, status: "removed", label: "silindi", oldText, newText: "", diff: unifiedDiff(oldText, "") });
  }
  changes.sort((a, b) => a.key.localeCompare(b.key));
  return changes;
}

function writeSnapshots(args, pages, { generatedAt }) {
  const manifest = { source: args.base, fetchedAt: generatedAt, pages: {} };
  const written = new Set();
  for (const page of pages) {
    const file = snapshotPath(args.out, page);
    written.add(file);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, page.text);
    const key = pageKey(page);
    manifest.pages[key] = {
      url: page.url,
      sha256: createHash("sha256").update(page.text).digest("hex"),
      bytes: Buffer.byteLength(page.text),
    };
  }
  for (const file of walkSnapshotPages(args.out, args.langs)) {
    if (!written.has(file)) rmSync(file, { force: true });
  }
  writeFileSync(join(args.out, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.mode !== "diff" && args.mode !== "sync") {
    usage();
    process.exit(2);
  }

  const generatedAt = new Date().toISOString();
  const pages = await collect(args);
  const changes = diffAgainstSnapshots(args, pages);

  if (!changes.length) {
    console.log(`[docwatch] ${args.mode}: ${pages.length} pages, no drift`);
    return 0;
  }

  const report = formatReport({ base: args.base, changes, maxDiffLines: args.maxDiffLines, generatedAt });
  const reportPath = args.report ?? (args.mode === "sync" ? join(repoRoot, DEFAULT_REPORT) : null);

  if (args.mode === "sync") {
    writeSnapshots(args, pages, { generatedAt });
    if (reportPath) {
      mkdirSync(dirname(reportPath), { recursive: true });
      writeFileSync(reportPath, report);
    }
    console.log(`[docwatch] sync: ${changes.length}/${pages.length} pages drifted`);
    for (const change of changes) {
      const amount = change.status === "added" ? `+${change.diff.added}` : change.status === "removed" ? `−${change.diff.removed}` : `+${change.diff.added} −${change.diff.removed}`;
      console.log(`  ${change.status.padEnd(7)} ${change.key} (${amount})`);
    }
    if (reportPath) console.log(`[docwatch] report: ${reportPath}`);
    return 0;
  }

  console.log(report);
  if (reportPath) {
    mkdirSync(dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, report);
  }
  console.log(`[docwatch] diff: ${changes.length} page(s) drifted`);
  return 1;
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectRun) {
  main()
    .then((code) => process.exit(code))
    .catch((err) => {
      console.error(`[docwatch] ${err?.message ?? err}`);
      process.exit(2);
    });
}
