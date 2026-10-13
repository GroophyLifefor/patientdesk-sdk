import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Guards the voice-list drift: the union in src/types.ts, the README comment
// and the text-to-speech reference must agree on the current built-in voices.
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function sourceVoices() {
  const source = readFileSync(join(root, "src", "types.ts"), "utf8");
  const union = source.match(/export type AlaniaVoice =([\s\S]*?);/);
  assert.ok(union, "expected the AlaniaVoice union in src/types.ts");
  return [...union[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

test("the AlaniaVoice union keeps the retired voices out", () => {
  const voices = sourceVoices();
  for (const retired of ["alania2-m2", "alania2-f2"]) {
    assert.ok(!voices.includes(retired), `${retired} was retired (400 unknown_voice)`);
  }
});

test("the union and the text-to-speech reference list the same built-ins", () => {
  const docs = readFileSync(join(root, "docs", "md", "text-to-speech.md"), "utf8");
  const documented = [...docs.matchAll(/^\| `(alania|alania2-[a-z0-9-]+|antalia-mini)`/gm)].map((m) => m[1]);
  assert.deepEqual([...sourceVoices()].sort(), [...documented].sort());
});

test("the README voice comment lists every built-in alania2 voice", () => {
  const readme = readFileSync(join(root, "README.md"), "utf8");
  const comment = readme.match(/voice: "alania2-f1",\s*\/\/\s*([^\n]+)/);
  assert.ok(comment, "expected the voice comment in the README");
  const list = comment[1].split(",")[0].trim();
  const expanded = list
    .split("/")
    .map((part, index) => (index === 0 ? part : `alania2-${part}`))
    .sort();
  const expected = sourceVoices()
    .filter((voice) => voice.startsWith("alania2-"))
    .sort();
  assert.deepEqual(expanded, expected);
});
