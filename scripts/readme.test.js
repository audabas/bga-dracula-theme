const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
const screenshotUrl = /https:\/\/raw\.githubusercontent\.com\/audabas\/bga-dracula-theme\/main\/screenshots\/([\w-]+\.webp)/g;

test("the README no longer says the theme is a work in progress", () => {
  assert.doesNotMatch(readme, /work in progress/i);
});

test("the README tells how to update and that the notice contacts GitHub", () => {
  assert.match(readme, /## Updating/);
  assert.match(readme, /GitHub Pages/);
});

test("the README shows the 5 screenshots from the main branch", () => {
  const names = [...readme.matchAll(screenshotUrl)].map((m) => m[1]);
  assert.equal(new Set(names).size, 5, names.join(", "));
  for (const name of names) {
    assert.ok(fs.existsSync(path.join(root, "screenshots", name)), `screenshots/${name} is missing`);
  }
});
