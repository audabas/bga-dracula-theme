#!/usr/bin/env node
// Writes the update notice's images (docs/adr/0002) to site/, deployed to GitHub Pages by
// .github/workflows/update-images.yml on every published release:
//
//   node scripts/update-images.js            from the repo's v* tags
//   node scripts/update-images.js v1.0.0 v1.1.0   from the given tags (local check)
//
// site/ is rebuilt from scratch: one image per release and language, plus an index page
// redirecting to the repo so the Pages root isn't a 404.
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { noticeImages } = require("./update-images-lib");

const root = path.join(__dirname, "..");
const site = path.join(root, "site");
const REPO_URL = "https://github.com/audabas/bga-dracula-theme";

const INDEX = `<!doctype html>
<meta charset="utf-8">
<title>BGA Dracula theme</title>
<meta http-equiv="refresh" content="0; url=${REPO_URL}">
<link rel="canonical" href="${REPO_URL}">
<p><a href="${REPO_URL}">${REPO_URL}</a></p>
`;

const tags = process.argv.length > 2
  ? process.argv.slice(2)
  : execFileSync("git", ["tag", "--list", "v*"], { cwd: root, encoding: "utf8" }).split("\n").filter(Boolean);

const images = noticeImages(tags);
fs.rmSync(site, { recursive: true, force: true });
fs.mkdirSync(path.join(site, "update"), { recursive: true });
fs.writeFileSync(path.join(site, "index.html"), INDEX);
for (const { path: file, svg } of images) fs.writeFileSync(path.join(site, file), svg);

console.log(`Wrote ${images.length} images to site/update/ for ${images.length / 2} release(s).`);
