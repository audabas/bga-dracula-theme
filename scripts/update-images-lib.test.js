const test = require("node:test");
const assert = require("node:assert/strict");
const { noticeImages, bannerSvg, EMPTY, LANGUAGES } = require("./update-images-lib");

test("the empty image takes no room", () => {
  assert.match(EMPTY, /width="0" height="0"/);
});

test("images come in French and English", () => {
  assert.deepEqual(LANGUAGES, ["fr", "en"]);
});

test("the latest release gets an empty image in both languages", () => {
  assert.deepEqual(noticeImages(["v1.0.0"]), [
    { path: "update/v1.0.0-fr.svg", svg: EMPTY },
    { path: "update/v1.0.0-en.svg", svg: EMPTY },
  ]);
});

// What the player reads: the text nodes, entities decoded, whitespace collapsed.
const readText = (svg) =>
  svg
    .replace(/<[^>]*>/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

const byPath = (tags) => Object.fromEntries(noticeImages(tags).map((i) => [i.path, i.svg]));

test("older releases name the latest one, in SemVer order rather than string order", () => {
  const images = byPath(["v1.10.0", "v1.2.0", "v1.9.3"]);
  assert.equal(
    readText(images["update/v1.2.0-fr.svg"]),
    "Thème Dracula : la v1.10.0 est disponible sur github.com/audabas/bga-dracula-theme"
  );
  assert.equal(
    readText(images["update/v1.9.3-en.svg"]),
    "Dracula theme: v1.10.0 is available on github.com/audabas/bga-dracula-theme"
  );
  assert.equal(images["update/v1.10.0-fr.svg"], EMPTY);
  assert.equal(images["update/v1.10.0-en.svg"], EMPTY);
});

test("banner text is escaped for XML", () => {
  const svg = bannerSvg(['Tom & Jerry <3 "quotes"']);
  assert.match(svg, /Tom &amp; Jerry &lt;3 &quot;quotes&quot;/);
  assert.equal(readText(svg), 'Tom & Jerry <3 "quotes"');
});

test("tags other than vMAJOR.MINOR.PATCH releases are ignored", () => {
  const paths = noticeImages(["v1.0.0", "v2.0.0-rc.1", "v3", "vnext", "1.5.0"]).map((i) => i.path);
  assert.deepEqual(paths, ["update/v1.0.0-fr.svg", "update/v1.0.0-en.svg"]);
});

test("no release, no image", () => {
  assert.deepEqual(noticeImages([]), []);
});
