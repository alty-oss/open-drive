










import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";


function walkSources(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walkSources(full));
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const css = readFileSync(join(root, "src/styles/theme.css"), "utf8");


function readTokens(selector) {
  const start = css.indexOf(selector);
  if (start === -1) throw new Error(`block not found: ${selector}`);
  const open = css.indexOf("{", start);
  let depth = 0;
  let end = open;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}" && --depth === 0) {
      end = i;
      break;
    }
  }
  const out = {};
  for (const m of css.slice(open, end).matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    out[m[1]] = m[2].trim();
  }
  return out;
}

const light = readTokens(":root {");
const dark = { ...light, ...readTokens('[data-theme="dark"] {') };

const hexOf = (v) => {
  const m = /^#([0-9a-f]{6})$/i.exec(v?.trim() ?? "");
  return m ? m[1].toLowerCase() : null;
};


function resolve(tokens, name, seen = new Set()) {
  if (seen.has(name)) return null;
  seen.add(name);
  const raw = tokens[name];
  if (!raw) return null;
  const direct = hexOf(raw);
  if (direct) return direct;
  const ref = /^var\((--[\w-]+)\)$/.exec(raw);
  if (ref) return resolve(tokens, ref[1], seen);
  return null;
}



const CONTAINERS = ["--app-bg", "--sidebar", "--surface", "--surface-alt"];
const CONTROLS = ["--surface-high", "--surface-highest"];
const BORDERS = ["--border", "--border-subtle"];

const failures = [];

for (const [theme, tokens] of [
  ["light", light],
  ["dark", dark],
]) {
  const hex = (n) => resolve(tokens, n);


  for (const control of CONTROLS) {
    for (const container of CONTAINERS) {
      if (hex(control) && hex(control) === hex(container)) {
        failures.push(
          `[${theme}] control ${control} has the SAME tone as container ${container} (#${hex(control)})`,
        );
      }
    }
  }


  for (const border of BORDERS) {
    for (const surface of [...CONTAINERS, ...CONTROLS]) {
      if (hex(border) && hex(border) === hex(surface)) {
        failures.push(
          `[${theme}] border ${border} has the SAME tone as surface ${surface} (#${hex(border)})`,
        );
      }
    }
  }


  const ladder = [...CONTAINERS, ...CONTROLS, "--canvas-bg"];
  const seen = new Map();
  for (const name of ladder) {
    const h = hex(name);
    if (!h) continue;
    if (seen.has(h)) {
      failures.push(
        `[${theme}] ${name} and ${seen.get(h)} have the same tone (#${h})`,
      );
    } else seen.set(h, name);
  }


  for (const state of ["--state-hover", "--state-press", "--state-selected"]) {
    const raw = tokens[state];
    if (!raw) {
      failures.push(`[${theme}] ${state} does not exist`);
    } else if (hexOf(raw)) {
      failures.push(
        `[${theme}] ${state} is an opaque hex value (${raw}) — must be translucent or collisions return`,
      );
    }
  }
}




const luminance = (hex) => {
  const ch = (v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
};
const contrast = (a, b) => {
  const [la, lb] = [luminance(a), luminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};


const CONTRAST = [
  ["--muted", "--surface-high", 4.5],
  ["--muted", "--surface-highest", 4.5],
  ["--text", "--surface-alt", 4.5],
  ["--accent", "--surface-alt", 4.5],
  ["--accent", "--surface-high", 4.5],
  ["--border", "--surface-high", 3.0],
  ["--border", "--surface-alt", 3.0],
];

for (const [theme, tokens] of [
  ["light", light],
  ["dark", dark],
]) {
  for (const [fg, bg, min] of CONTRAST) {
    const a = resolve(tokens, fg);
    const b = resolve(tokens, bg);
    if (!a || !b) continue;
    const r = contrast(a, b);
    if (r < min) {
      failures.push(
        `[${theme}] contrast ${fg} on ${bg} = ${r.toFixed(2)}:1 (minimum ${min})`,
      );
    }
  }
}


const banned = ["bg-hover", "bg-selected"];
const sources = walkSources(join(root, "src"))
  .map((file) => readFileSync(file, "utf8"))
  .join("\n");
for (const cls of banned) {
  if (new RegExp(`\\b${cls}\\b`).test(sources)) {
    failures.push(`the frontend still uses \`${cls}\` — removed token`);
  }
}








const dividerMisuse = [];
for (const file of walkSources(join(root, "src"))) {
  const src = readFileSync(file, "utf8");
  for (const m of src.matchAll(/border-[rltbxy] border-border\b(?!-)/g)) {
    dividerMisuse.push(`${file.replace(root + "/", "")}: \`${m[0]}\``);
  }
}
for (const hit of dividerMisuse) {
  failures.push(
    `selector uses --border (affordance border) instead of --border-subtle -> ${hit}`,
  );
}

if (failures.length) {
  console.error("✗ tone collisions found:\n");
  for (const f of failures) console.error("  " + f);
  process.exit(1);
}
console.log("✓ tone contract is valid for both themes");
