# RUNSHEET — "Ship with AI" live demo

This is the **safe recording/deployment candidate**, branched from historical seed `05cdada`.
The seed remains preserved elsewhere for provenance, not for deployment. This worktree should
be fully fixed and green. Never reset/push main or deploy known-vulnerable code to recreate a beat.

## Before you go live

- Use only the approved rehearsal worktree/repository, not the upstream/live project.
- Run `npm ci && npm test && npm audit --audit-level=high && npm run build` using Node 22.12+
  within the Node 22 line. Expect zero high/critical advisories and nine pages.
- Preview locally at `/ship-with-ai-rehearsal/` and complete the acceptance checks below.
- Inspect the proposed diff before any publication; remote PR creation, settings changes, merges,
  deployments, and recording require separate approval. Local work does none of these.
- Check current [plan availability](https://docs.github.com/en/copilot/get-started/plans).
  Do not promise all public-repository features are free.
- A local build is not a remote CI/deployment result. Verify Pages settings and actual remote
  results separately before claiming the site is published.

## Beat 0 — State what is and is not proven

- Automatic Copilot Code Review: demonstrated independently.
- Issue → cloud agent: unverified. The issue template is only a future starting point.
- Agent Merge: unverified. No fake actor, automatic fix, or merge claim.
- Safe candidate: local fixes and checks, followed by browser acceptance and an approved diff.

**Talking point:** *"We separate demonstrated capabilities from the workflow we still need to validate."*

## Beat 1 — GitHub Copilot Code Review

Show only real review evidence, attributed to its actual actor. Historical findings included
tag-based Actions, `permissions: write-all`, and missing feedback validation. This safe branch
fixes them; do not expect a new review to reproduce every finding or label it as guaranteed.

## Beat 2 — Approved fixes and manual merge

Show the actual local diff: verified SHA pins, least-privilege permissions, storage validation,
current Marked, DOMPurify, and safe text construction. A reviewer must approve the exact diff
before publication. Use a manual merge only when authorized.

`allow_auto_merge` is ordinary GitHub auto-merge permission, not Agent Merge and not an
automatic remediation system. Do not attribute these fixes or a manual merge to an agent run.

## Beat 3 — GitHub Actions (CI/CD)

Show the workflow definition and actual available results:
`npm ci` → `npm test` → `npm audit --audit-level=high` → Astro build/upload.
Only a push to main can enter the deploy job. PR and manual-dispatch runs are nondeploying.
Build has `contents: read`; deploy alone has `pages: write` / `id-token: write`.
The Node input remains 22. Dependencies are installed once with `npm ci`; the explicit
build and Pages artifact-upload steps do not reinstall them. The manifest/lockfile integrity
check stays enabled. See README for the verified upstream SHA origins and nested-action caveat.

**Talking point:** *"The pipeline that builds and ships your code needs the same scrutiny as the
code itself."*

## Beat 4 — AI-assisted security review

The historical `marked@0.3.19` seed had high-severity dependency advisories. This version uses
`marked@18.0.13` plus `dompurify@3.4.15`. **Marked does not sanitize HTML**, even after upgrading.
Sanitization and text-only name/time rendering are separate protections against XSS.

The historical `src/lib/analytics-config.js` was a fake demo placeholder. Its file, import, and
debug logging are removed here. Detection by secret scanning/push protection was not verified;
do not show token-like contents or claim an alert exists without actual evidence.
Dependency review and code scanning are not steps in this workflow.

## Beat 5 — Honest lifecycle summary

The release path is proposed change → review → approved manual merge → tested/audited build
→ Pages deployment on main push, subject to repository settings. Unverified agent steps remain
unverified. Passing tests are evidence of tested behavior, not a guarantee of complete security.

## Payoff

Use the local preview first. Visit the configured
<https://ijhan-biz.github.io/ship-with-ai-rehearsal/> only after an approved deployment has actually
succeeded. Do not present a pre-existing page or local build as a newly completed deployment.

## Browser acceptance checklist (local preview only)

- Visit all nine pages through the header, home links, and Supply Chain → DIY.
  All internal paths and assets must stay under `/ship-with-ai-rehearsal/`; no navigation 404s.
- Use `#feedback-name`, `#feedback-message`, and `#feedback-form`. Submit a named Markdown message,
  then an anonymous message. Check `.feedback-item`, `.meta`, and `time` under `#feedback-list`.
  Newest appears first; formatting and safe links work; reload preserves both entries.
- Name markup is literal text. In message Markdown, script/SVG/image/form elements and event
  attributes must not survive, and `javascript:` links must not be actionable. No external
  images or scripts should load. Do not disable Markdown to pass this check.
- Whitespace-only message: visible, focused `#feedback-error[role="alert"]`; draft remains.
  Exercise lengths beyond 100/5,000 by bypassing HTML `maxlength` to verify the storage boundary.
- Set only the test origin's `ship-with-ai-feedback` entry to corrupt JSON or an invalid record.
  Reload and submit: explicit recovery message, untouched raw storage, unchanged form values.
  Back up/remove only that test entry to recover. Do not clear unrelated browser storage.
- Simulate blocked reads/getters, quota errors, and failed writes. Expect visible errors, no false
  success, unchanged drafts and history. On successful save only, fields clear and
  `#feedback-status[role="status"]` says “Feedback saved in this browser.”
- At 100 records, the next successful save replaces the oldest. A failed save must not evict it.

Native tests cover pure validation/storage and preservation; they do not prove browser rendering,
screen-reader behavior, remote CI, or deployment. Browser acceptance is a separate handoff.
