#!/usr/bin/env node
// Guards against BGA's custom-CSS size limit and reports where the characters go.
//
// BGA's Preferences -> Advanced custom-CSS textarea has maxlength=50000, so the
// limit is in characters (UTF-16 code units, as the browser counts), not bytes.
// dist/style.css is what players paste in, so it must stay under that limit.
const fs = require("fs");
const path = require("path");
const sass = require("sass");
const csso = require("csso");

const HARD_LIMIT = 50000; // textarea maxlength on BGA
const WARN_LIMIT = 45000; // headroom alert
// Version label and update notice + base + shared components + pages; games get the rest.
const GENERAL_UI_BUDGET = 20000;

const root = path.join(__dirname, "..");
const src = path.join(root, "src");
const css = fs.readFileSync(path.join(root, "dist", "style.css"), "utf8");
const total = css.length;

// Size of one partial compiled and minified on its own (approximate: csso can
// merge rules across partials in the real build, so the sum may differ slightly).
function partialSize(file) {
  const out = sass.renderSync({ file, outputStyle: "compressed", includePaths: [src] }).css.toString();
  return csso.minify(out).css.length;
}

function partials(dir) {
  const full = path.join(src, dir);
  if (!fs.existsSync(full)) return [];
  return fs
    .readdirSync(full)
    .filter((f) => f.endsWith(".scss"))
    .map((f) => path.join(dir, f));
}

const groups = {
  general: ["versioning.scss", "base.scss", ...partials("components"), ...partials("pages")].filter((f) =>
    fs.existsSync(path.join(src, f))
  ),
  games: partials("games"),
};

let general = 0;
for (const [group, files] of Object.entries(groups)) {
  const sizes = files.map((f) => [f, partialSize(path.join(src, f))]).sort((a, b) => b[1] - a[1]);
  const sum = sizes.reduce((s, [, n]) => s + n, 0);
  if (group === "general") general = sum;
  if (!sizes.length) continue;
  console.log(`${group} (${sum} chars):`);
  for (const [f, n] of sizes) console.log(`  ${String(n).padStart(6)}  ${f}`);
}

const pct = (n, of) => ((n / of) * 100).toFixed(1);

if (general > GENERAL_UI_BUDGET) {
  console.warn(
    `⚠️  General UI is ${general} chars, over its ${GENERAL_UI_BUDGET}-char budget ` +
      `(${pct(general, GENERAL_UI_BUDGET)}%). It eats into the room left for game fixes.`
  );
}

if (total > HARD_LIMIT) {
  console.error(
    `❌ dist/style.css is ${total} chars, over BGA's ${HARD_LIMIT}-char limit ` +
      `(${pct(total, HARD_LIMIT)}%). BGA will reject it. Reduce the CSS before releasing.`
  );
  process.exit(1);
}

if (total > WARN_LIMIT) {
  console.warn(
    `⚠️  dist/style.css is ${total} chars (${pct(total, HARD_LIMIT)}% of the ${HARD_LIMIT}-char limit). ` +
      `Headroom is getting tight — keep new rules lean.`
  );
} else {
  console.log(`✓ dist/style.css is ${total} chars (${pct(total, HARD_LIMIT)}% of the ${HARD_LIMIT}-char limit).`);
}
