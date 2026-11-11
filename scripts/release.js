#!/usr/bin/env node
// Cuts a release in two steps, so everything before the push stays local and undoable:
//
//   npm run release -- <patch|minor|major> [--dry-run]
//     from a clean develop: bump package.json (+ lock), build (aborts over BGA's size limit),
//     commit "Release vX.Y.Z", fast-forward main, tag vX.Y.Z, draft the release notes, stop.
//   npm run release -- --publish <notes-file> [--dry-run]
//     push develop, main and the tag, then create the GitHub Release from the reviewed notes.
//
// --dry-run changes no branch, tag or file in the repo, and pushes or publishes nothing: it still
// runs `git fetch origin` and the checks, prints the commands it would run, and writes the notes draft.
// The notes draft goes to $RELEASE_NOTES_DIR (default: the OS temp directory).
const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  parseArgs,
  nextVersion,
  preflightProblems,
  publishProblems,
  draftNotes,
  countCommits,
} = require("./release-lib");

const root = path.join(__dirname, "..");
// npm runs scripts from the package root; relative paths are resolved from where npm was called.
const fromCaller = process.env.INIT_CWD || process.cwd();

// Read-only git query; returns trimmed stdout, or null when git exits non-zero.
function git(...args) {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch {
    return null;
  }
}

const packageVersion = () => JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version;

const isAncestor = (a, b) => git("merge-base", "--is-ancestor", a, b) !== null;

function makeRunner(dryRun) {
  return (cmd, ...args) => {
    const shown = [cmd, ...args].map((a) => (a.includes(" ") ? `"${a}"` : a)).join(" ");
    console.log(`${dryRun ? "[dry run] " : "$ "}${shown}`);
    if (!dryRun) execFileSync(cmd, args, { cwd: root, stdio: "inherit" });
  };
}

function refuse(problems) {
  if (!problems.length) return;
  console.error(["Refusing to go on:", ...problems.map((p) => `  - ${p}`)].join("\n"));
  process.exit(1);
}

function workspace() {
  return { branch: git("symbolic-ref", "--short", "-q", "HEAD"), clean: git("status", "--porcelain") === "" };
}

function release(level, dryRun) {
  const run = makeRunner(dryRun);
  console.log("Fetching origin to compare develop and main with it…");
  if (git("fetch", "origin") === null) refuse(["git fetch origin failed."]);
  refuse(
    preflightProblems({
      ...workspace(),
      developHasOriginDevelop: isAncestor("origin/develop", "develop"),
      mainHasOriginMain: isAncestor("origin/main", "main"),
      mainIsAncestorOfDevelop: isAncestor("main", "develop"),
    })
  );

  const current = packageVersion();
  const version = nextVersion(current, level);
  const tag = `v${version}`;
  if (git("rev-parse", "-q", "--verify", `refs/tags/${tag}`) !== null) refuse([`${tag} already exists.`]);

  // Read before the release commit exists, so the notes range excludes it.
  const previousTag = git("describe", "--tags", "--abbrev=0", "--match", "v[0-9]*", "HEAD");
  const log = git("log", "--no-merges", "--format=%h %s", previousTag ? `${previousTag}..HEAD` : "HEAD") || "";
  const commits = log
    .split("\n")
    .filter(Boolean)
    .map((line) => ({ hash: line.slice(0, line.indexOf(" ")), subject: line.slice(line.indexOf(" ") + 1) }));

  const before = { develop: git("rev-parse", "develop"), main: git("rev-parse", "main") };
  const undo = [`git tag -d ${tag}`, `git branch -f main ${before.main}`, `git reset --hard ${before.develop}`];
  console.log(`\nReleasing ${tag} (from v${current}).`);
  try {
    run("npm", "version", level, "--no-git-tag-version");
    run("npm", "run", "build");
    run("git", "add", "package.json", "package-lock.json", "dist/style.css");
    run("git", "commit", "-m", `Release ${tag}`);
    // Updates main without checking it out; git refuses anything but a fast-forward.
    run("git", "fetch", ".", "develop:main");
    run("git", "tag", "-a", tag, "-m", tag);
  } catch {
    // Tagging is the last step, so a failure means there is no tag to delete.
    console.error(`\nRelease aborted. Restore the previous state with:\n  ${undo.slice(1).join(" && ")}`);
    process.exit(1);
  }

  const notesDir = path.resolve(fromCaller, process.env.RELEASE_NOTES_DIR || os.tmpdir());
  const notesFile = path.join(notesDir, `bga-dracula-theme-${tag}-notes.md`);
  fs.mkdirSync(notesDir, { recursive: true });
  fs.writeFileSync(notesFile, draftNotes({ version, previousTag, commits }));

  console.log(
    [
      "",
      `${dryRun ? "[dry run] " : ""}${tag} is ready locally; nothing has been pushed.`,
      `Notes draft (${countCommits(commits.length)}${previousTag ? ` since ${previousTag}` : ", no previous tag"}): ${notesFile}`,
      "Rewrite it, then publish with:",
      `  npm run release -- --publish ${notesFile}`,
      "Or undo the release with:",
      `  ${undo.join(" && ")}`,
    ].join("\n")
  );
}

function publish(notesArg, dryRun) {
  const notesFile = path.resolve(fromCaller, notesArg);
  const run = makeRunner(dryRun);
  const version = packageVersion();
  const tag = `v${version}`;
  const head = git("rev-parse", "HEAD");
  refuse(
    publishProblems({
      ...workspace(),
      tag,
      tagAtHead: git("rev-parse", "-q", "--verify", `refs/tags/${tag}^{commit}`) === head,
      mainAtHead: git("rev-parse", "main") === head,
      notes: fs.existsSync(notesFile) ? fs.readFileSync(notesFile, "utf8") : "",
    })
  );
  run("git", "push", "--atomic", "origin", "develop", "main", `refs/tags/${tag}`);
  run("gh", "release", "create", tag, "--verify-tag", "--title", tag, "--notes-file", notesFile);
  console.log(`\n${dryRun ? "[dry run] " : ""}${tag} published.`);
}

let args;
try {
  args = parseArgs(process.argv.slice(2));
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
if (args.mode === "release") release(args.level, args.dryRun);
else publish(args.notesFile, args.dryRun);
