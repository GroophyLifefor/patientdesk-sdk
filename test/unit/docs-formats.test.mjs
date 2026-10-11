import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CONTENT_TYPE } from "../../dist/index.js";

// Guards the exact drift this repo was scolded for: a TTS format added to the
// SDK but missing from (or stale in) the README and the docs reference.
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const formats = Object.keys(CONTENT_TYPE).sort();

test("every TtsFormat is listed in each README format comment", () => {
  const readme = readFileSync(join(root, "README.md"), "utf8");
  // Only the Alania comments look like `response_format: "x", // a | b | c`.
  const commentLists = [
    ...readme.matchAll(/response_format: "[a-z0-9]+",\s*\/\/\s*((?:[a-z0-9]+)(?:\s*\|\s*[a-z0-9]+)+)/g),
  ].map((m) => m[1]);
  assert.ok(commentLists.length >= 2, "expected format comments in the quick start and the reference");
  for (const list of commentLists) {
    const listed = list.split("|").map((s) => s.trim()).filter(Boolean).sort();
    assert.deepEqual(listed, formats, `stale format list: ${list}`);
  }
});

test("every TtsFormat is listed in the text-to-speech reference", () => {
  const docs = readFileSync(join(root, "docs", "md", "text-to-speech.md"), "utf8");

  const row = docs.split("\n").find((line) => line.startsWith("| `response_format`"));
  assert.ok(row, "expected the response_format parameter row");
  const listed = [...row.matchAll(/`([a-z0-9]+)`/g)].map((m) => m[1]).sort();
  assert.deepEqual(listed, formats, "the parameter row list must match CONTENT_TYPE");

  for (const format of formats) {
    assert.ok(docs.includes(`| \`${format}\` |`), `the output formats table must document ${format}`);
  }
});
