const test = require("node:test");
const assert = require("node:assert/strict");
const { parseArgs, preflightProblems, publishProblems, draftNotes, nextVersion } = require("./release-lib");

const released = {
  tag: "v1.2.4",
  branch: "develop",
  clean: true,
  tagAtHead: true,
  mainAtHead: true,
  notes: "## Fixes\n\n- Yahtzee's score multipliers are readable again.\n",
};

test("a tagged release with rewritten notes can be published", () => {
  assert.deepEqual(publishProblems(released), []);
});

test("publishing refuses anything but the release prepared by the first step", () => {
  const cases = [
    [{ branch: "main" }, /develop/],
    [{ clean: false }, /uncommitted/i],
    [{ tagAtHead: false }, /v1\.2\.4/],
    [{ mainAtHead: false }, /main/],
    [{ notes: "  \n" }, /empty/i],
    [{ notes: draftNotes({ version: "1.2.4", previousTag: "v1.2.3", commits: [] }) }, /draft/i],
  ];
  for (const [override, message] of cases) {
    const problems = publishProblems({ ...released, ...override });
    assert.equal(problems.length, 1, JSON.stringify(override));
    assert.match(problems[0], message);
  }
});

test("the next version follows SemVer", () => {
  assert.equal(nextVersion("0.1.0", "patch"), "0.1.1");
  assert.equal(nextVersion("0.1.9", "minor"), "0.2.0");
  assert.equal(nextVersion("0.1.0", "major"), "1.0.0");
  assert.equal(nextVersion("1.4.2", "major"), "2.0.0");
});

const commits = [
  { hash: "30d15ce", subject: "Show near-black player colors light in game pages" },
  { hash: "3b7b01c", subject: "Brighten Yahtzee's score multipliers" },
];

test("the notes draft lists the commits since the previous tag, for rewriting by kind", () => {
  const draft = draftNotes({ version: "1.2.4", previousTag: "v1.2.3", commits });
  assert.match(draft, /v1\.2\.4/);
  assert.match(draft, /since v1\.2\.3/);
  assert.match(draft, /New games/);
  assert.match(draft, /Pages & components/);
  assert.match(draft, /Fixes/);
  assert.match(draft, /^- Show near-black player colors light in game pages \(30d15ce\)$/m);
  assert.match(draft, /^- Brighten Yahtzee's score multipliers \(3b7b01c\)$/m);
});

test("without a previous tag the draft covers all history and says so", () => {
  const draft = draftNotes({ version: "1.0.0", previousTag: null, commits });
  assert.match(draft, /no previous tag/i);
  assert.match(draft, /all history/i);
  assert.match(draft, /\(3b7b01c\)/);
});

test("a single commit is counted in the singular", () => {
  const draft = draftNotes({ version: "1.2.4", previousTag: "v1.2.3", commits: commits.slice(0, 1) });
  assert.match(draft, /the 1 commit since v1\.2\.3/);
});

const ready = {
  branch: "develop",
  clean: true,
  developHasOriginDevelop: true,
  mainHasOriginMain: true,
  mainIsAncestorOfDevelop: true,
};

test("a clean, up-to-date develop that main can fast-forward to is ready", () => {
  assert.deepEqual(preflightProblems(ready), []);
});

test("each unmet condition is reported", () => {
  const cases = [
    [{ branch: "main" }, /develop/],
    [{ branch: null }, /develop/],
    [{ clean: false }, /uncommitted/i],
    [{ developHasOriginDevelop: false }, /origin\/develop/],
    [{ mainHasOriginMain: false }, /origin\/main/],
    [{ mainIsAncestorOfDevelop: false }, /fast-forward/],
  ];
  for (const [override, message] of cases) {
    const problems = preflightProblems({ ...ready, ...override });
    assert.equal(problems.length, 1, JSON.stringify(override));
    assert.match(problems[0], message);
  }
});

test("a release level starts a release", () => {
  assert.deepEqual(parseArgs(["patch"]), { mode: "release", level: "patch", dryRun: false });
  assert.deepEqual(parseArgs(["major", "--dry-run"]), { mode: "release", level: "major", dryRun: true });
});

test("--publish takes the reviewed notes file", () => {
  assert.deepEqual(parseArgs(["--publish", "/tmp/notes.md"]), {
    mode: "publish",
    notesFile: "/tmp/notes.md",
    dryRun: false,
  });
  assert.deepEqual(parseArgs(["--dry-run", "--publish", "n.md"]), { mode: "publish", notesFile: "n.md", dryRun: true });
});

test("anything else is a usage error", () => {
  const bad = [[], ["prerelease"], ["1.2.3"], ["--publish"], ["patch", "minor"], ["patch", "--publish", "n.md"], ["--force"]];
  for (const argv of bad) {
    assert.throws(() => parseArgs(argv), /Usage/, JSON.stringify(argv));
  }
});
