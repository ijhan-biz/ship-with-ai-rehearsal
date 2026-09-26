# Ship with AI

Companion site + live demo repo for **AI Genius — Season 5, Episode 3: "Ship with AI: Review,
Secure, and Deploy with Confidence."**

## Safe rehearsal version

This worktree is the fixed recording/deployment candidate, not the intentionally vulnerable demo.
The nine-page Astro site explains review, supply-chain security, and deployment without claiming
an unobserved end-to-end agent run.

- Rehearsal repository: <https://github.com/ijhan-biz/ship-with-ai-rehearsal>
- Configured Pages target: <https://ijhan-biz.github.io/ship-with-ai-rehearsal/>
  (configuration is not proof of a live deployment).
- Attribution: [original upstream project](https://github.com/anothergeorgecoldham/ship-with-ai),
  source baseline `7561fed570ac4e3840960d18ffcc18febdac4464`.
- Historical seed baseline: `05cdada`, preserved separately. It contained `marked@0.3.19`,
  unsafe rendering, missing validation, broad workflow permissions, tag-based Actions, and a
  demo-only fake analytics configuration. The fake configuration/import/debug logging are
  removed here. No credential contents need to be shown.
- Expected result here: passing tests, no high/critical audit findings, and a nine-page build.
  Do not reset main or redeploy the historical vulnerable baseline for a demonstration.

Automatic Copilot Code Review was demonstrated independently. **Issue → cloud agent and
Agent Merge remain unverified.** Ordinary `allow_auto_merge` does not enable an agent to fix
review comments. This rehearsal plans a **manual, explicitly approved merge**, not an invented
automated fix/merge. Publication and that merge have not happened yet.
See [`RUNSHEET.md`](./RUNSHEET.md) for the recording checks.

## Availability and release prerequisites

Features and pricing vary by plan, repository visibility, and organization policy. Consult
[Copilot plans](https://docs.github.com/en/copilot/get-started/plans) and
[GitHub security documentation](https://docs.github.com/en/code-security); public does not mean
every feature is free. Automatic review needs an eligible account and configured rules.

Publication, only after approval, requires Pages Source **GitHub Actions** and a permitted
`github-pages` environment. Branch rules determine whether CI checks are mandatory before
merge. Dependency review, code scanning, and secret scanning require their own configuration;
this workflow does not implement or prove them. No remote settings are changed by local setup.

## Run it locally

```bash
git clone https://github.com/ijhan-biz/ship-with-ai-rehearsal.git
cd ship-with-ai-rehearsal
# Node 22.12+ within the Node 22 line, matching CI.
npm ci
npm test
npm audit --audit-level=high
npm run build
npm run dev
```

Until this diff is approved and published, the remote may not contain the safe changes; use the
reviewed local worktree for acceptance. Open
`http://localhost:4321/ship-with-ai-rehearsal/` (adjust to Astro's printed port).
`npm run build` writes `dist/`; `npm run preview` serves the same base path locally.
No backend, external scripts, or analytics service is used.

## Feedback safety and storage policy

`marked@18.0.13` parses Markdown; it **does not sanitize HTML**. `dompurify@3.4.15` sanitizes
the result with an allowlist of text formatting, lists, tables, code, and links. Images,
scripts, SVG, forms, event handlers, styles, and unsafe URL schemes are excluded. Name and time
are constructed as text, never interpolated into HTML.

Input must be text. Name and message are trimmed; a blank name is Anonymous, but a blank message
is rejected. Limits after trimming: 100 name characters and 5,000 message characters (JavaScript
string length). Only the newest 100 submissions are retained; the oldest is replaced only on a
successful save. Feedback stays in this browser, is not sent to the presenter, and is not synced.

Records must have exactly `name`, `message`, and a valid canonical UTC `submittedAt` timestamp.
Existing valid records remain readable. Malformed JSON, invalid records/dates, or an oversized
legacy history block writes with an accessible error; they are **not** silently discarded.
If recovery is needed, first export/back up the `ship-with-ai-feedback` localStorage entry using
browser developer tools, then remove **only that entry** and reload. This is a deliberate,
user-controlled reset. Read/unavailable/quota/write failures are shown visibly; form values
and existing storage remain intact on failure. The form resets only after a successful save.

## Structure

```
src/
  pages/            content pages (home, pipeline, one per capability, secure-supply-chain, DIY)
  components/
    FeedbackWidget.astro   the one interactive feature — questions/feedback, client-side only
  lib/                validated browser-storage logic
test/                 native node:test / assert coverage (no test dependency)
astro.config.mjs      static output, `site`/`base` set for GitHub Pages project-page hosting
.github/
  workflows/deploy.yml     install → tests → security gate → build/upload → deploy to Pages
  dependabot.yml           npm + GitHub Actions version updates
  ISSUE_TEMPLATE/feature-request.md   optional future feature request template
```

## Deploying

After explicit approval, a push to `main` can deploy. PRs targeting `main` and
`workflow_dispatch` run checks/build/upload **without deploying**, including dispatch on main.
The deployment guard remains `github.ref == 'refs/heads/main' && github.event_name == 'push'`.

The audit gate fails on high/critical advisories with no ignore or continue-on-error. Native
tests run before the Astro build. Default token permission is `contents: read`; only deploy
receives `pages: write` and `id-token: write`, as required by upstream deploy-pages documentation.
The Node version input is 22 (Astro requires at least 22.12).

Direct Action pins were resolved on 2026-09-26 with read-only
`gh api repos/<owner>/<repo>/commits/<tag>` against upstream:

| Action / upstream tag | Verified commit |
|---|---|
| `actions/checkout` / `v4` | `11d5960a326750d5838078e36cf38b85af677262` |
| `actions/setup-node` / `v4` | `49933ea5288caeca8642d1e84afbd3f7d6820020` |
| `actions/upload-pages-artifact` / `v3` | `56afc609e74202658d3ffba0e8f6dda462b719fa` |
| `actions/deploy-pages` / `v4` | `d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e` |

Dependencies are installed once with `npm ci`, then tested, audited, and built directly.
The previous Astro composite ran a second `npm install`, which rewrote optional-platform
metadata in the lockfile on the Linux runner and failed the integrity check in run
`36238441226`. Explicit build and artifact-upload steps avoid that mutating reinstall.
The post-build manifest/lockfile check remains enabled, before artifact upload.
The pinned Pages uploader internally references `actions/upload-artifact@v4`; a direct pin
does not recursively pin nested Actions. Checkout does not persist repository credentials.
No vendored action or additional agent automation is introduced here.

## Local validation — 2026-09-26

- Baseline: Node 26.0.0 build passed (nine pages); audit failed with one high-severity `marked`
  dependency finding, as expected. No test/lint/typecheck script existed at baseline.
- Safe candidate: actual **Node 22.23.2** with npm 11.12.1, provisioned with `npm exec --package=node@22.23.2`,
  ran `npm ci && npm test && npm audit --audit-level=high && npm run build` successfully.
  **34 native tests passed; zero audit vulnerabilities; nine pages built.**
  A local Astro-style `npm install` left the manifest/lock unchanged, but the remote Linux
  run subsequently demonstrated platform-specific lockfile rewriting; CI now avoids that step.
- Resolved dependencies: Marked 18.0.13, DOMPurify 3.4.15, Astro 7.3.3, direct js-yaml 5.4.2,
  nested js-yaml 4.3.2, sharp 0.35.4, svgo 4.1.0, devalue 5.9.4. Only Marked and the new sanitizer
  dependency tree changed in this candidate.
- Static output check: all nine pages and 92 internal links/assets use the rehearsal base and
  resolve to built files. Workflow YAML parsing verified the direct pins, job permissions,
  Node inputs, test/audit steps, and deploy guard.
- Local browser acceptance passed: all nine navigation targets returned 200, Markdown and
  anonymous feedback persisted across reloads, name markup remained literal, unsafe HTML/URL
  content was removed, and corrupt/unavailable/full storage produced visible errors while
  preserving drafts and existing records. No application errors or missing assets occurred.
- The fixed light palette now explicitly uses a light color scheme: an OS dark preference no
  longer creates dark text on a dark canvas. The 390px mobile viewport has no horizontal overflow.
- These local results do not establish remote CI, Pages deployment, actual scanning alerts,
  or unverified agent behavior. No external linter/typechecker was added.
