// Pure helpers for scripts/release.js: no git, no file system, so they can be tested.

const LEVELS = ["patch", "minor", "major"];

const USAGE = [
  "Usage:",
  "  npm run release -- <patch|minor|major> [--dry-run]   bump, build, commit, fast-forward main, tag, draft notes",
  "  npm run release -- --publish <notes-file> [--dry-run] push develop, main and the tag, create the GitHub Release",
].join("\n");

function parseArgs(argv) {
  const args = argv.filter((a) => a !== "--dry-run");
  const dryRun = args.length !== argv.length;
  if (args.length === 1 && LEVELS.includes(args[0])) return { mode: "release", level: args[0], dryRun };
  if (args.length === 2 && args[0] === "--publish" && !args[1].startsWith("-")) {
    return { mode: "publish", notesFile: args[1], dryRun };
  }
  throw new Error(USAGE);
}

// The version `npm version <level>` would produce, for the dry run and the messages.
function nextVersion(version, level) {
  const [major, minor, patch] = version.split(".").map(Number);
  if (level === "major") return `${major + 1}.0.0`;
  if (level === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

const DRAFT_MARKER = "Draft release notes for";

function workspaceProblems({ branch, clean }) {
  const problems = [];
  if (branch !== "develop") problems.push(`Run this from develop (current branch: ${branch || "detached HEAD"}).`);
  if (!clean) problems.push("The working tree has uncommitted changes; commit or stash them first.");
  return problems;
}

// Why a release can't start, given what release.js read from git. Empty means go.
function preflightProblems(facts) {
  const problems = workspaceProblems(facts);
  if (!facts.developHasOriginDevelop) {
    problems.push("develop is behind or has diverged from origin/develop; pull first.");
  }
  if (!facts.mainHasOriginMain) problems.push("main is behind or has diverged from origin/main; update main first.");
  if (!facts.mainIsAncestorOfDevelop) {
    problems.push("main is not an ancestor of develop, so main can't fast-forward to it.");
  }
  return problems;
}

// Why the release prepared by the first step can't be pushed and published. Empty means go.
function publishProblems(facts) {
  const problems = workspaceProblems(facts);
  if (!facts.tagAtHead) problems.push(`${facts.tag} is missing or isn't on HEAD; run the release step first.`);
  if (!facts.mainAtHead) problems.push("main isn't at HEAD; run the release step first.");
  if (!facts.notes.trim()) problems.push("The notes file is empty.");
  else if (facts.notes.includes(DRAFT_MARKER)) {
    problems.push("The notes file is still the draft; rewrite it and delete the commit list and the comment.");
  }
  return problems;
}

const countCommits = (n) => `${n} commit${n === 1 ? "" : "s"}`;

// Draft release notes: the raw commit list plus the headings Claude rewrites it under.
// commits: [{ hash, subject }], newest first, release commit excluded.
function draftNotes({ version, previousTag, commits }) {
  const count = countCommits(commits.length);
  const range = previousTag ? `the ${count} since ${previousTag}` : `all history (${count}): there is no previous tag`;
  return [
    "<!--",
    `${DRAFT_MARKER} v${version}: ${range}, release commit excluded.`,
    "Rewrite them in English for players, grouped under the headings below (drop empty ones),",
    "then delete the commit list and this comment before publishing.",
    "-->",
    "",
    "## New games",
    "",
    "## Pages & components",
    "",
    "## Fixes",
    "",
    "## Commits",
    "",
    ...commits.map((c) => `- ${c.subject} (${c.hash})`),
    "",
  ].join("\n");
}

module.exports = { parseArgs, nextVersion, preflightProblems, publishProblems, draftNotes, countCommits, USAGE };
