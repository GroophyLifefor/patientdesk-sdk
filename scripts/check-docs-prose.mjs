import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dir = "docs/md";
let issues = 0;
for (const file of readdirSync(dir)) {
  const lines = readFileSync(join(dir, file), "utf8").split(/\r?\n/);
  let inFence = false;
  let inTable = false;
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("```")) {
      inFence = !inFence;
      return;
    }
    if (inFence) return;
    inTable = trimmed.startsWith("|");
    if (inTable) return; // code cells may hold any separator
    if (line.includes("\u2014")) {
      console.log(`EM DASH  ${file}:${index + 1}  ${trimmed}`);
      issues++;
    }
    if (line.includes(";")) {
      console.log(`SEMICOLON ${file}:${index + 1}  ${trimmed}`);
      issues++;
    }
  });
}
console.log(issues === 0 ? "clean: no em dashes or semicolons in prose" : `${issues} issue(s)`);
