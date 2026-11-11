// Pure helpers for scripts/update-images.js: no git, no file system, so they can be tested.

const REPO = "github.com/audabas/bga-dracula-theme";

// Two lines, so each fits a phone's width: the banner is clipped to the viewport around its center.
const MESSAGES = {
  fr: (version) => [`Thème Dracula : la ${version} est disponible sur`, REPO],
  en: (version) => [`Dracula theme: ${version} is available on`, REPO],
};

// Latest release: nothing to show, and a 0×0 image takes no room (a 1×1 one adds a pixel).
const EMPTY = '<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0"/>\n';

const escapeXml = (text) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// The update notice's CSS (src/versioning.scss) shows the image at its intrinsic size, centered and
// clipped to the viewport: it is wider than any screen, with the text at its horizontal center.
// Colors: $purple background, $bg text. Generic font: an image can't load web fonts.
function bannerSvg(lines) {
  const lineHeight = 18;
  const height = lines.length * lineHeight + 12;
  const top = (height - (lines.length - 1) * lineHeight) / 2;
  const texts = lines.map(
    (line, i) => `  <text x="5000" y="${top + i * lineHeight}">${escapeXml(line)}</text>`
  );
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="10000" height="${height}">`,
    '  <rect width="100%" height="100%" fill="#bd93f9"/>',
    '  <g fill="#282a36" font-family="sans-serif" font-size="14" font-weight="bold" text-anchor="middle" dominant-baseline="central">',
    ...texts.map((t) => `  ${t}`),
    "  </g>",
    "</svg>",
    "",
  ].join("\n");
}

const parse = (tag) => tag.slice(1).split(".").map(Number);

function compareTags(a, b) {
  const [pa, pb] = [parse(a), parse(b)];
  return pa[0] - pb[0] || pa[1] - pb[1] || pa[2] - pb[2];
}

// Every file of the update notice for the released tags (in any order): one image per tag and
// language, at the permanent path update/v<version>-<fr|en>.svg (ADR 0002).
// Tags that aren't releases (pre-releases, typos) are ignored.
function noticeImages(tags) {
  const releases = tags.filter((tag) => /^v\d+\.\d+\.\d+$/.test(tag));
  const latest = [...releases].sort(compareTags).at(-1);
  return releases.flatMap((tag) =>
    Object.entries(MESSAGES).map(([lang, message]) => ({
      path: `update/${tag}-${lang}.svg`,
      svg: tag === latest ? EMPTY : bannerSvg(message(latest)),
    }))
  );
}

module.exports = { noticeImages, bannerSvg };
