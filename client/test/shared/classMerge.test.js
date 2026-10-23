import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import test from "node:test";
import { cn } from "../../src/shared/ui/cn.ts";









const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const css = readFileSync(join(root, "src/styles/theme.css"), "utf8");


function themeScale(prefix) {
  const names = new Set();
  for (const [, name] of css.matchAll(
    new RegExp(`^\\s*--${prefix}-([\\w]+)\\s*:`, "gm"),
  )) {
    if (!name.endsWith("-line") && !/^line/.test(name)) names.add(name);
  }
  return [...names];
}

test("the type scale does not swallow text color", () => {
  const sizes = themeScale("text").filter((n) => /^\d+$/.test(n));
  assert.ok(sizes.length > 0, "no --text-<n> token found in theme.css");

  for (const size of sizes) {
    const merged = cn("text-on-accent", `text-${size}`).split(" ");
    assert.ok(
      merged.includes("text-on-accent"),
      `text-${size} dropped text color — declare it in the font-size group in src/cn.ts`,
    );
    assert.ok(merged.includes(`text-${size}`), `text-${size} foi descartado`);
  }
});

test("elevation scale conflicts with itself and shadow-none", () => {
  const levels = themeScale("shadow").filter((n) => /^e\d+$/.test(n));
  assert.ok(levels.length > 0, "no --shadow-e<n> token found in theme.css");


  assert.equal(cn("shadow-e1", "shadow-e3"), "shadow-e3");
  for (const level of levels) {
    assert.equal(
      cn(`shadow-${level}`, "shadow-none"),
      "shadow-none",
      `shadow-none did not override shadow-${level} — both would survive and CSS order would decide`,
    );
  }
});

test("primary button preserves label color in every state", () => {
  const primary = "bg-accent text-on-accent shadow-e1";

  const idle = cn(primary, "h-11 w-full text-13 font-medium");
  assert.ok(idle.includes("text-on-accent"), "normal state lost its color");

  const off = cn(
    primary,
    "text-13 disabled:shadow-none",
    "disabled:bg-surface-high disabled:text-muted",
  ).split(" ");
  assert.ok(off.includes("text-on-accent"), "disabled state lost its base color");
  assert.ok(off.includes("disabled:text-muted"), "disabled state lost its override");
});
