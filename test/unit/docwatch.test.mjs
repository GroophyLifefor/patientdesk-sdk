import test from "node:test";
import assert from "node:assert/strict";
import {
  extractArticle,
  pageKey,
  pageListFromSitemap,
  snapshotPath,
  unifiedDiff,
} from "../../scripts/docwatch.mjs";

// A trimmed-down docs page that exercises every extraction rule: nav/aside and
// button chrome, heading permalink anchors, entities, lists, tables and code.
const PAGE = `<!doctype html><html><body>
<nav>Site chrome</nav>
<main id="docs-main">
  <aside>Sidebar TOC</aside>
  <article>
    <h2 id="body"><a href="#body" class="x">İstek gövdesi<span aria-hidden="true" class="y">#</span></a></h2>
    <p>Alanlar <code>&amp;</code> diğerleri.</p>
    <ul><li>Bir</li><li>İki</li></ul>
    <table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>
    <pre><code>{"a": 1}</code></pre>
    <button type="button">Kopyala</button>
    <script>var x = 1;</script>
  </article>
</main>
<footer>Footer chrome</footer>
</body></html>`;

test("extractArticle normalizes a docs page to stable text", () => {
  const text = extractArticle(PAGE, "test");
  assert.equal(
    text,
    [
      "## İstek gövdesi",
      "Alanlar & diğerleri.",
      "- Bir",
      "- İki",
      "A | B |",
      "1 | 2 |",
      '{"a": 1}',
      "",
    ].join("\n"),
  );
});

test("extractArticle falls back to <main> when there is no <article>", () => {
  const html = '<main id="docs-main"><div>Landing <b>içerik</b>.</div></main>';
  assert.equal(extractArticle(html, "test"), "Landing içerik.\n");
});

test("extractArticle fails loudly when there is no <main>", () => {
  assert.throws(() => extractArticle("<html><body>no main</body></html>", "broken"), /no <main> element/);
});

test("pageListFromSitemap keeps only docs pages for the requested languages", () => {
  const xml = `<urlset>
    <url><loc>https://speech.patientdesk.ai/docs</loc></url>
    <url><loc>https://speech.patientdesk.ai/docs/alania/</loc></url>
    <url><loc>https://speech.patientdesk.ai/en/docs/alania</loc></url>
    <url><loc>https://speech.patientdesk.ai/en/docs</loc></url>
    <url><loc>https://speech.patientdesk.ai/pricing</loc></url>
    <url><loc>https://other.example.com/docs</loc></url>
    <url><loc>not-a-url</loc></url>
  </urlset>`;
  const pages = pageListFromSitemap(xml, "https://speech.patientdesk.ai", ["tr", "en"]);
  assert.deepEqual(
    pages.map((p) => p.url),
    [
      "https://speech.patientdesk.ai/docs",
      "https://speech.patientdesk.ai/docs/alania",
      "https://speech.patientdesk.ai/en/docs",
      "https://speech.patientdesk.ai/en/docs/alania",
    ],
  );
  assert.equal(pageListFromSitemap(xml, "https://speech.patientdesk.ai", ["en"]).length, 2);
  // The language is chosen by the route, so TR pages are fetched locale-prefixed.
  assert.equal(pages[0].fetchUrl, "https://speech.patientdesk.ai/tr/docs");
  assert.equal(pages[2].fetchUrl, "https://speech.patientdesk.ai/en/docs");
});

test("snapshotPath maps URLs to the per-language snapshot tree", () => {
  const out = "/snap";
  assert.equal(snapshotPath(out, { lang: "tr", path: "/docs" }), "/snap/tr/docs/index.md");
  assert.equal(snapshotPath(out, { lang: "tr", path: "/docs/alania/parameters" }), "/snap/tr/docs/alania/parameters.md");
  assert.equal(snapshotPath(out, { lang: "en", path: "/en/docs" }), "/snap/en/docs/index.md");
  assert.equal(snapshotPath(out, { lang: "en", path: "/en/docs/stt/streaming" }), "/snap/en/docs/stt/streaming.md");
});

test("pageKey drops the /en prefix so both languages share the docs path", () => {
  assert.equal(pageKey({ lang: "tr", path: "/docs/alania" }), "tr/docs/alania");
  assert.equal(pageKey({ lang: "en", path: "/en/docs/alania" }), "en/docs/alania");
});

test("unifiedDiff reports an added file", () => {
  const diff = unifiedDiff("", "satır 1\nsatır 2\n");
  assert.equal(diff.added, 2);
  assert.equal(diff.removed, 0);
  assert.match(diff.text, /^@@ -0,0 \+1,2 @@/);
  assert.match(diff.text, /\+satır 1/);
});

test("unifiedDiff reports removed lines", () => {
  const diff = unifiedDiff("a\nb\nc\n", "a\nc\n");
  assert.equal(diff.added, 0);
  assert.equal(diff.removed, 1);
  assert.match(diff.text, /-b/);
});

test("unifiedDiff produces a context hunk around a change", () => {
  const oldText = "a\nb\nc\nd\ne\n";
  const newText = "a\nb\nX\nd\ne\n";
  const diff = unifiedDiff(oldText, newText);
  assert.equal(diff.added, 1);
  assert.equal(diff.removed, 1);
  assert.match(diff.text, /@@ -1,5 \+1,5 @@/);
  assert.match(diff.text, / b/);
  assert.match(diff.text, /-c/);
  assert.match(diff.text, /\+X/);
  assert.match(diff.text, / d/);
});

test("unifiedDiff is empty for identical text and honours the line cap", () => {
  const same = unifiedDiff("aynı\n", "aynı\n");
  assert.equal(same.text, "");
  assert.equal(same.truncated, false);

  const many = Array.from({ length: 20 }, (_, i) => `satır ${i}`).join("\n") + "\n";
  const capped = unifiedDiff("", many, { maxLines: 5 });
  assert.equal(capped.truncated, true);
  assert.equal(capped.text.split("\n").length, 5);
});
