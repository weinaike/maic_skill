# maic_skill — OpenMAIC Course Authoring Skill (maic-course)

[中文](README.zh-CN.md) | **English**

Author [MAIC courses](https://github.com/weinaike/OpenMAIC) offline in Claude Code with
the `maic-course` skill. Courses live as git-friendly source projects — outlines and
narration in Markdown that humans edit, canvas JSON that agents generate — and compile
into a `.maic.zip` that imports straight into the OpenMAIC platform player.

Four functional modules (outline / content generation / voice / editing) plus a
translation module, all wired into one compile → validate → review → package pipeline.

## Design highlights

- **Course as a source project**: the parts humans are good at (outline, narration
  Markdown) and the parts agents are good at (coordinate-level canvas JSON) live in
  layered coexistence inside one git-friendly directory. Build artifacts are always
  compiled output and can be rebuilt at any time.
- **Deterministic compilation**: action ids are minted from content hashes ⇒ an
  unchanged source yields a byte-stable manifest. The golden test proves
  unpack→compile is deep-equal to the platform's native export.
- **Three validation gates**: L1 DSL contract (vendored `@openmaic/dsl`) → L2 document
  lint (audioRef/elementId/media cross-references, HTML allowlist, geometry bounds) →
  L3 platform import simulation (replicates `use-import-classroom` acceptance
  semantics item by item). Errors refuse to package.
- **Review system (required for automation)**: outline / content / spec / translation
  reviews by an isolated reviewer; findings land in `build/review/` with a bounded
  auto-fix loop (≤2 rounds; unresolved blockers escalate to the human).
- **Interactive scenes**: a full contract for `interactive` scenes
  (`references/interactive-spec.md`) — self-contained HTML pages driven by `widget_*`
  timeline actions over postMessage, 16:9 viewport aligned with slides, sandbox
  constraints, and the video-export freeze semantics.
- **Pluggable TTS**: Doubao first (aligned with the platform `generateDoubaoTTS`
  contract — one key works on both sides), configured via `MAIC_TTS_*` env vars;
  narration↔audio cached by hash in `voice.lock.yaml`, so editing one sentence
  re-synthesizes exactly one sentence.

## Repository layout

```
maic-course/     the skill itself (self-contained; symlink as a whole into
                  ~/.claude/skills/ or a project's .claude/skills/)
  SKILL.md       entry point + routing + hard rules
  references/    contract docs: scene-source-spec / maic-format / dsl-cheatsheet /
                  layout-patterns / interactive-spec / review-checklists / workflow-*
  scripts/       setup / init / unpack / outline / generate / compile / check /
                  preview / tts / edit / translate / review / build (zero-dep node ≥ 20)
  agents/        registered sub-agent types (scene-generator / read-only reviewer /
                  fixer / translator)
  templates/     new-course skeleton
  vendor/dsl/    @openmaic/dsl dist copy (synced by setup, gitignored)
courses/         local course projects (e.g. 03-mcp, 03-mcp-en)
test/            integration suite (12 checks incl. golden round-trip)
install.sh       one-command installer
```

## Installation

```bash
./install.sh                   # one command into the current project:
                               # skill symlink + agent registration + DSL vendor + env check
./install.sh /path/to/OpenMAIC # into a specific project
./install.sh --user            # personal level: ~/.claude (available in any directory)
```

Manual equivalent (or when you only want the skill without the agents):

```bash
node maic-course/scripts/setup.mjs          # vendor the DSL dist + env check
                                           # (requires zip/unzip/ffprobe)
# DSL source priority: --repo / dslRepoPath in config.json (local OpenMAIC checkout) →
# auto-fetch @openmaic/dsl from npm (a dependency-free standalone package — no checkout needed)
# as a personal skill (available everywhere):
ln -s "$(pwd)/maic-course" ~/.claude/skills/maic-course
# or as a project skill (sessions inside that repo only):
ln -s "$(pwd)/maic-course" /path/to/OpenMAIC/.claude/skills/maic-course
# sub-agent registration (restricted tool-face types):
mkdir -p /path/to/OpenMAIC/.claude/agents
for f in maic-course/agents/*.md; do ln -sfn "$(pwd)/$f" /path/to/OpenMAIC/.claude/agents/; done
```

Note: agent types load at session start — restart Claude Code after installing.

## Usage

```bash
# tests (12 integration checks: skill self-check + course from scratch + golden round-trip)
node test/all.mjs

# start a new course from scratch (or just talk to Claude Code — see SKILL.md routing)
node maic-course/scripts/init.mjs courses/my-course --name "Course title" --audience "audience"
# … outline workflow (interview/brief) → generate → voice → build

# unpack a platform-exported course and keep editing it
node maic-course/scripts/unpack.mjs ~/Desktop/00.Agent*.maic.zip courses/00-agent-intro

# validate / package
node maic-course/scripts/check.mjs courses/00-agent-intro
node maic-course/scripts/build.mjs courses/00-agent-intro
# → courses/00-agent-intro/build/00.Agent-系列课程介绍.maic.zip
# platform → course list → import → pick the zip

# outline (reverse-engineer skeleton from unpacked scenes → enrich → review)
node maic-course/scripts/outline.mjs sync courses/00-agent-intro
node maic-course/scripts/outline.mjs lint courses/00-agent-intro
```

Inside a Claude Code session, just talk to it ("generate the outline" / "voice this
page" / "make page 3 two-column") — the skill routes via SKILL.md.

## Milestones

| M | Scope | Status |
|---|-------|--------|
| M1 | Skeleton + compile/3-gate validation/packaging + golden test | ✅ done (`node test/golden-roundtrip.mjs`, all three pass) |
| M2 | Review framework + outline module (outline review loop) | ✅ done (findings gate wired into build; outline lint/sync) |
| M3 | Generate module (content+spec review, fix loop, layout recipes, preview) | ✅ done (layout-patterns calibrated coordinates; scaffold/normalize; offline preview stage) |
| M4 | Voice module (Doubao adapter + env + doctor + hash cache) | ✅ done (verified with real Doubao synthesis; sentence-level re-synthesis; dead-audio prune) |
| M5 | Edit module + full-course final review | ✅ done (edit.mjs six ops + cascade status board; final review in workflow-edit) |
| M6 | `--auto` full-auto + new-course scaffolding + integration tests + install | ✅ done (workflow-auto pipeline; init.mjs; `test/all.mjs` 12 checks; installed into OpenMAIC `.claude/skills/`) |

## Known facts (learned the hard way)

- The platform repo's `packages/@openmaic/dsl/dist` can lag behind its source (it did
  during development); run `pnpm --filter @openmaic/dsl build` before `setup.mjs`.
  Currently vendored `DSL_VERSION = 0.3.0`.
- Platform-exported zips use store (no compression); this skill matches the habit
  with `zip -X -0`.
- Real courses (00.Agent) contain decorative bleed shapes (intentional out-of-bounds)
  and orphan media files — check reports warnings (not errors) for both, matching the
  platform's own behavior.
- The platform importer hangs media on canvas element ids by `media/<file-stem>`;
  a stem mismatch just orphans the media, it doesn't break the import.
- **Symlink install pitfall** (fixed): node resolves an ESM `import.meta.url` to the
  real path while `process.argv[1]` keeps the symlink path, so a naive is-main check
  silently fails under `.claude/skills/` symlinks — all scripts route through
  `lib/main.mjs` realpath comparison.
- Doubao TTS arkcli key auto-resolution requires an active profile in
  `~/.arkcli/config.yaml`; secrets always read `MAIC_TTS_API_KEY` first.
