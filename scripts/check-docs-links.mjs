import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dir = "docs/docs";
let broken = 0;
for (const file of readdirSync(dir)) {
  if (!file.endsWith(".html")) continue;
  const html = readFileSync(join(dir, file), "utf8");
  const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
  const refs = [...html.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]);
  const bad = refs.filter((r) => !ids.has(r));
  if (bad.length) {
    console.log(`BROKEN ${file}: ${bad.join(", ")}`);
    broken += bad.length;
  }
  // Every internal .html link must point at a generated page.
  const pages = new Set(readdirSync(dir).filter((f) => f.endsWith(".html")).map((f) => f));
  for (const m of html.matchAll(/href="(?!#|https?:|\.\.\/)([^"#]+\.html)/g)) {
    if (!pages.has(m[1])) {
      console.log(`MISSING PAGE ${file} -> ${m[1]}`);
      broken++;
    }
  }
}
console.log(broken === 0 ? "anchors and internal links ok" : `${broken} problem(s)`);
