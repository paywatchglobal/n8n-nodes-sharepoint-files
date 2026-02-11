---
name: release
description: Create a new tagged GitHub release using gh CLI with auto-generated release notes
disable-model-invocation: true
allowed-tools: Bash(gh *), Bash(git *)
argument-hint: [branch-name]
---

# Release Command

Create a new tagged GitHub release with auto-generated release notes summarizing changes since the last release.

## Instructions

### Step 1: Determine the release tag

1. Get today's date in `YYYYMMDD` format (use the system date).
2. Fetch the most recent release tag using:
   ```bash
   gh release list --limit 10 --json tagName,publishedAt,isDraft --order desc
   ```
3. Determine the next release number:
   - If the most recent release tag starts with `v<today's date>`, extract the `.NN` suffix and increment it by 1 (e.g., `v20260211.03` → `v20260211.04`).
   - If no release exists for today, the new tag is `v<today's date>.01`.
   - Always zero-pad the number to 2 digits (`.01`, `.02`, ... `.09`, `.10`, `.11`, etc.).

### Step 2: Determine the target branch

- **Default**: Use `main`.
- If the user provides `$ARGUMENTS`, use that as the target branch name instead.
- Verify the branch exists using `git branch -a | grep <branch>`.

### Step 3: Identify the previous release

1. Get the tag of the most recent **published** (non-draft) release:
   ```bash
   gh release list --limit 1 --json tagName --exclude-drafts -q '.[0].tagName'
   ```
2. If no previous release exists, use the first commit of the repo as the base.

### Step 4: Gather changes

1. Get the commit log between the previous release tag and the target branch HEAD:
   ```bash
   git log <previous-tag>..origin/<target-branch> --oneline --no-merges
   ```
2. Get the full diff summary (files changed) between the previous release and target branch:
   ```bash
   git diff <previous-tag>..origin/<target-branch> --stat
   ```
3. Read the actual diff to understand the changes in detail:
   ```bash
   git diff <previous-tag>..origin/<target-branch>
   ```
   If the diff is very large, focus on the most significant files from the stat output.

### Step 5: Write release notes

Create release notes in this format:

```markdown
## Summary

<2-5 sentences describing the key changes in this release, written for a human audience. Focus on what changed and why it matters, not implementation details.>

## Changes

<For each commit, write a clear one-line description. Group by type if there are many commits.>

- **feat**: <description> (<short-hash>)
- **fix**: <description> (<short-hash>)
- **refactor**: <description> (<short-hash>)
- ...

## Commits

<full-hash> <commit message>
<full-hash> <commit message>
...
```

### Step 6: Create the release title

The title should include the tag name followed by a colon and a short, descriptive phrase summarizing the release. For example:
- "v20260211.01: Add audit logging and telemetry improvements"
- "v20260204.02: Fix transaction listing and provider error handling"

### Step 7: Show the user what will be created

Before creating the release, display:
- **Tag**: the new tag name
- **Target branch**: the branch being released
- **Title**: the release title
- **Notes**: the full release notes
- **Previous release**: the tag being compared against

Ask the user to confirm before proceeding.

### Step 8: Create the draft release

Once confirmed, create the draft release:
```bash
gh release create <tag> --target <branch> --title "<title>" --notes "<notes>" --draft
```

Tell the user the release has been created as a **draft** and provide the URL so they can review and publish it.

## CRITICAL RULES

- **ALWAYS** create releases as **drafts** — never publish directly
- **NEVER** add `Co-Authored-By` or any AI attribution to release notes
- **NEVER** fabricate or guess changes — only include commits that actually exist in the log
- If `gh` CLI is not authenticated or the repo has no remote, inform the user and stop
- Always fetch latest remote state with `git fetch` before comparing
