# CodeSync: College Mega-Project Improvement Plan

Prepared: 10 October 2026  
Status: roadmap in progress; only the implementation batch below has been completed.

## Implementation progress — batch 1

Completed locally on 10 October 2026:

- Restored dependencies with a successful lockfile install (`npm ci`).
- Replaced the editor's single active-file debounce with file-bound queues; added
  cleanup on deletion/room exit and guards against disconnected socket buffering.
- Made save responses preserve newer local edits and moved dirty-state tracking
  into the store. Same-file saves are serialized; content saves no longer submit
  stale path metadata. Save failures leave the editor usable for retry.
- Made rename metadata-only, with current text used for collaborator updates.
- Guarded relevant file/workspace operations against late responses after reset
  or navigation so old requests cannot repopulate a new workspace.
- Added Vitest, React Testing Library, jsdom, `npm test`, and a GitHub Actions
  test/build workflow. Added manual editor smoke steps to `README.md`.

Actual verification:

| Check | Result |
| --- | --- |
| `npm ci --no-audit --no-fund` | Passed after adding the test dependencies; 446 packages installed. |
| `npm test` | Passed: 28 tests across queue, store, and Room component suites. |
| `npm run lint` | Passed existing checks only: server entry-point syntax and client development build. |
| `npm run build` | Passed production build. |
| bcrypt native dependency smoke check | Passed with a synthetic value; no accounts were accessed. |

Integration tests exposed the false Saved indicator and stale rename-content cache
before their fixes. Additional tests exposed stale room-load/create responses before
the lifecycle guards were completed. All these tests now pass. Build warnings remain
for a roughly 508 KB JavaScript chunk and outdated Browserslist data.

Limits: component tests use mocked API/socket/Monaco/media boundaries. No live
MongoDB, Docker execution, OAuth, two-browser smoke test, or remote CI run was
performed. Node 26.8.1/npm 11.19.0 were used locally; CI is configured for Node 22
but has not run here. This does not complete CS-01/CS-02 in full, introduce autosave,
fix offline recovery, or solve simultaneous multi-user editing. Existing full-file
remote replacement still needs the planned collaboration redesign.

**Next bounded batch:** CS-03 — validate canonical room/project/file ownership and
action-specific permissions in socket mutations, with backend regression tests.
Then finish project-scoped client hydration and proceed to the collaboration spike.

### Startup hotfix — fresh MongoDB collection

- Fixed `ensureCodeFileIndexes` in `server/src/models/CodeFile.model.js` to treat
  only MongoDB code 26 / `NamespaceNotFound` during index listing as an empty
  index set. Existing index creation then initializes the missing collection.
- Added seven backend regression tests with Node's built-in runner, and included
  backend tests in the root `npm test` command. No new dependencies were needed.
- Added `server/checks/mongo-startup.check.js` for an explicit isolated local
  MongoDB check, using a unique disposable database rather than application data.
- Verified against a temporary MongoDB 7 container: reproduced the original
  missing-namespace error, initialized the collection/indexes, and repeated the
  initializer while preserving a synthetic legacy file and backfilling its path.
  The test database was removed and the temporary container stopped afterward.
- Verification: `npm test` passed all 35 tests (7 backend + 28 frontend), and the
  changed model passed `node --check`. No application database was reset.
- The local `http://localhost:5000/health` endpoint subsequently returned
  `{"success":true,"message":"CodeSync API is healthy"}`.

### Gemini repository assistant — current batch

- Added an authenticated `POST /api/ai/generate` route using the configured
  `GEMINI_BASE_URL` and `GEMINI_MODEL` without making Gemini required for startup.
- Added server-side repository context assembly: active-file prioritization,
  project/room/file authorization, secret-file exclusion, common-token redaction,
  per-file/total context limits, bounded responses, timeout, JSON-only output
  instructions, and per-user AI rate limiting.
- Added a CodeSync AI panel to the room collaboration area. It supports generate,
  explain, fix, and review intents; context visibility; warnings; copy; safe
  active-file-only apply; and local dirty-state review before normal Save.
- Added 7 server AI tests and 4 client AI-panel tests plus a Room apply-flow test.
  The complete current suite passed with 14 server tests and 33 client tests.
- No API key was written to the repository. The key supplied in chat should be
  rotated; configure the replacement only in the ignored `server/.env` file.

Remaining AI work: live provider verification with the rotated key, a user study
of generated suggestions, and a future diff/patch application flow. The current
Apply action intentionally replaces the active file locally only; it does not
automatically persist or silently push AI-generated code.

### Workspace premium UI pass — current batch

- Refined the room shell using the supplied workspace screenshot as the reference:
  stronger toolbar/editor/panel hierarchy, quieter restrained glow, aligned tabs,
  visible focus states, clearer disabled states, and responsive rules for smaller
  laptop widths.
- Added a compact header status cluster for Live/Offline and Saved/Unsaved/Saving
  state so connection and persistence are visible without relying only on the
  bottom status bar.
- Reduced the empty People panel height from 35% to 25% of the collaboration rail,
  added a collaborator count, and added a purposeful waiting state instead of a
  large empty black region.
- Added Explorer file count and New file/New folder tooltips, plus compact empty
  and inactive states. The CodeSync AI panel and collaboration tabs now share the
  same premium tab/focus treatment.
- Verification after this pass: `npm test` passed 15 server and 33 client tests;
  `npm run lint`, `npm run build`, and `git diff --check` passed. Build still has
  the known Browserslist and bundle-size warnings.

Next UI slices: improve the dashboard's resume/recent-activity hierarchy, add a
command palette and keyboard shortcut hints, then add intentional micro-motion and
loading skeletons. Keep the workspace shell stable while each slice is tested.

### IDE panel behavior pass — current batch

- Made the terminal panel behave like an IDE panel instead of a fixed-height block:
  the resize handle owns its vertical size, the terminal supports collapse/expand,
  and maximize/restore calls the resizable panel API when available.
- Removed the fixed `flex-basis: 280px !important` rule that prevented the terminal
  from honoring collapse/drag behavior.
- Added `collapsible`/`collapsedSize` semantics to the terminal panel and clearer
  toolbar state (`aria-expanded`, `aria-pressed`, and contextual open/collapse titles).
- Preserved the existing close, run, clear, history, package, and output actions.
- Added focused RunButton and ExecutionPanel accessibility regression tests. Current verification:
  `npm test` passed 15 server and 35 client tests; `npm run lint`, `npm run build`,
  and `git diff --check` passed. Build warnings remain the known Browserslist and
  bundle-size warnings.

### GitHub OAuth configuration fix

- The active server environment currently has neither `GITHUB_CLIENT_ID` nor
  `GITHUB_CLIENT_SECRET` configured; the reported 500 was therefore expected.
- Missing OAuth credentials now return configuration status 503 and redirect the
  browser OAuth start flow to the existing readable GitHub callback error page,
  instead of rendering a raw stack trace.
- Added a regression test and documented the required GitHub OAuth setup/restart.

### Cross-feature audit and hardening — current batch

- Ran the full automated checks again: 17 backend tests and 36 frontend tests pass;
  `npm run lint`, `npm run build`, and `git diff --check` pass.
- Verified the running API health endpoint, protected-route rejection without a session,
  unknown-route handling, and the isolated fresh-MongoDB startup/index/backfill check.
- Hardened Socket.IO code mutations so the server resolves the file by its canonical room
  scope, ignores client-spoofed filename/path/language/project metadata, requires file-management
  permission for metadata/deletion mutations, and ignores older live versions.
- Prevented same-path files in different projects from evicting one another in the client store;
  room code-sync handling now ignores events for a different active project.
- Corrected initial chat history loading to return the newest 200 messages in chronological
  display order rather than the oldest 200.
- Added regression coverage for canonical code-mutation intent and cross-project same-path merges.

This is a hardening pass, not proof that every feature is perfect. Remaining evidence gaps include
two-browser concurrent editing/reconnect tests, live Docker hostile-program/container-cleanup tests,
live GitHub OAuth and push/pull tests, screen sharing on restrictive networks, live Gemini-provider
verification, and a human usability study. See `RESEARCH_PAPER_PLAN.md` for the evaluation protocol
and publication plan.

The assessment below describes the original inspected baseline; use this progress
section to distinguish completed fixes from remaining roadmap work.

## 1. Recommended direction

Build **a dependable collaborative coding workspace for student teams and guided lab sessions**. The main story should be: create a room, invite teammates, edit together without unintended data loss, run code safely, recover earlier work, and publish reviewed changes.

Do not try to replace VS Code, GitHub, Zoom, and a learning-management system at once. A smaller, coherent product with demonstrated engineering depth will be more convincing than a larger collection of partially reliable features.

Recommended evaluation strengths:

1. Real-time collaboration that handles concurrent edits and reconnection.
2. Server-enforced room permissions and bounded code execution.
3. Durable project state, recoverable checkpoints, and safe GitHub synchronization.
4. A polished workflow that first-time users can complete unaided.
5. Measured results, automated tests, deployment, and clear design explanations.

Planning assumption: 3-4 students, approximately 10-15 hours each per week, over 10 weeks. This is a reference schedule, not an estimate validated against the team's experience. Re-estimate after Week 1, confirm the college rubric, and preserve approximately 20% of capacity for integration and unexpected problems.

## 2. What already exists

Source inspection found implementations for:

- React/Vite/Tailwind UI, Zustand stores, and a Monaco editor.
- Express/MongoDB services, JWT cookie authentication, validation, and HTTP rate limits.
- Rooms, projects, path-based files, owner/editor/viewer roles, and permission settings.
- Socket.IO code synchronization, cursors, and presence.
- Text chat, search, voice-note uploads, and WebRTC screen sharing.
- Docker-based execution for JavaScript, Python, C, and C++, plus package-installation flows.
- GitHub OAuth, encrypted token handling, repository selection, pull, change listing, and push.
- Room analytics and a dashboard.

Preserve this stack and useful existing work. No wholesale rewrite or microservice migration is proposed.

### Inspection and verification limits

This is a source-based assessment, not a full security audit or browser usability test. The risks below require regression tests and runtime reproduction; implemented does not mean verified.

Commands run from the repository root:

| Check | Actual result |
| --- | --- |
| `node --version` | v26.8.1 |
| `npm --version` | 11.19.0 |
| `npm run lint` | Server entry-point syntax check passed; client step failed because `vite` was unavailable. |
| `npm run build` | Failed because `vite` was unavailable. No bundle was verified. |

No automated test files or test scripts were found in the inspected repository. The current client `lint` script is a Vite build; the server `lint` script only checks `src/server.js`. Neither is a complete lint/test pipeline. Dependencies were not installed, private environment files were not read, and Docker, MongoDB, GitHub OAuth, and live browser behavior were not exercised.

## 3. Highest-impact findings from the current code

P0 means a data-integrity, access-control, or execution-safety release blocker. P1 means required product quality for the final submission. P2 means an enhancement to implement only after the core passes.

| Priority | Source evidence | Improvement and reason |
| --- | --- | --- |
| P0 | `server/src/sockets/code.socket.js`; `client/src/store/room.store.js` | Whole-file text replacement without conflict resolution or stale-version rejection can overwrite concurrent edits. Introduce a tested collaboration protocol. |
| P0 | `client/src/pages/Room.jsx`, `queueCodeChange` | A delayed patch is associated with the active file when the timer fires, rather than being permanently bound to the edited file. Add a rapid-file-switch regression test and per-file handling. |
| P0 | `Room.jsx`, `handleSave`; `room.store.js`, `saveFile` | Save responses replace local content and clear the dirty flag without checking for edits made while the request was in flight. Preserve newer local edits and acknowledge specific revisions. |
| P0 | `socket.server.js`; `room.socket.js`; `file.service.js` | Live content lives in process memory while REST saves update MongoDB separately. Acknowledged live sync is not durable saving; reconnect, restart, and stale-cache behavior need one consistent design. |
| P0 | `server/src/sockets/code.socket.js` | The code event checks room membership/edit permission but trusts file/project metadata without looking up the file's actual scope. Validate canonical room-project-file relationships and separate metadata/deletion permissions. |
| P0 | `room.socket.js`, `hydrateFilesForJoin`; `room.store.js`, `applyRemoteFiles` | Room-wide hydration includes every project's files; the client merges by path without project qualification. Prevent files with the same path in different projects from colliding. |
| P0 | `server/src/services/execute.service.js`; `sandboxPackage.service.js` | Timeouts kill the Docker CLI process but do not explicitly identify and force-remove its container. Verify actual container termination; bound concurrency, mounts, privileges, and package-install network access. |
| P1 | `server/src/controllers/room.controller.js` | Role/settings updates return to the requester but do not broadcast a room update. Other clients can show stale controls; changes and revocations must propagate and remain server-enforced. |
| P1 | `server/src/services/githubSync.service.js` | Pull overwrites stored files; push uses per-file commits against the latest remote SHA. Add persisted base revisions, conflict checks, preview, recovery, and consistent live-state updates. |
| P1 | `server/src/services/chat.service.js`, `listRoomMessages` | Ascending order with a 200-message limit returns the oldest messages, not the newest page. Implement recent-history loading and pagination. |
| P1 | `client/src/pages/Dashboard.jsx`; `components/analytics/RoomAnalyticsModal.jsx` | Active-room count duplicates total rooms; recently opened is derived from list order; cached modal state is not keyed by room. Use accurately defined metrics and per-room query state. |
| P1 | `Room.jsx`; `components/common/Modal.jsx`; `App.jsx` | A 1,487-line room page mixes many concerns; dialogs lack focus-management semantics; routes are eagerly imported. Refactor carefully and verify accessibility/performance. |
| P1 | `client/src/hooks/useScreenShare.js`; `docker-compose.yml` | Screen sharing has STUN but no TURN configuration; Compose starts only MongoDB. Test restrictive networks and provide a reproducible full demo environment. |

These findings justify improving reliability before adding another major feature.

## 4. Scope boundaries

### Must ship

- Reliable authenticated create/join/resume flow.
- Concurrent editing, presence, durable autosave, and reconnect handling.
- Correct file/project isolation and a documented role/action matrix.
- Safe, bounded execution with clear output and failure states.
- Consistent editor layout and keyboard-accessible core workflows.
- Recent chat history and accurate analytics.
- Previewed, conflict-aware GitHub operations on a designated demo repository.
- Named checkpoints with diff and controlled restore.
- Automated regression coverage, reproducible deployment, and evaluation evidence.

### Retain and harden; do not expand unnecessarily

Voice notes, screen sharing, package installation, and existing analytics. If one cannot meet its security/reliability gate before the deadline, explicitly disable or label its scope rather than advertise it as complete. Arbitrary package installation should remain disabled on a public deployment until its separate safety review passes.

### Defer

AI code generation/chat, full video conferencing, a general-purpose terminal, arbitrary long-running servers, 20+ execution languages, public room discovery, billing, Kubernetes, full assignment grading, and a complete rewrite in another stack. An AI feature is not necessary to make the project technically strong.

## 5. Architecture and implementation decisions

### A. Collaboration and durability — P0

**Recommended:** evaluate Yjs with a maintained Monaco binding in a short technical spike. Yjs is a CRDT: a data structure designed to merge concurrent edits. Use an authenticated provider; do not expose an unauthenticated collaboration endpoint or assume Socket.IO alone resolves conflicts.

1. Reproduce simultaneous typing, rapid file switching, and typing-during-save against the current implementation.
2. Define document identity using room, project, and immutable file ID. A file rename must not create a different text document.
3. Bind each file's editor model and pending updates to its identity; dispose listeners and models correctly.
4. Validate document membership and permission at subscription and mutation time, including role revocation.
5. Persist accepted updates and compact them into versioned snapshots. Define separate visible states for local changes, live synchronization, and durable saving.
6. Rehydrate from durable state after restart; merge reconnecting clients through the collaboration protocol instead of replacing the document.
7. Keep cursor awareness transient. Use collaboration-relative positions so cursors remain meaningful when text changes.
8. Make restore and GitHub import controlled, authorized document changes. Do not maintain competing REST whole-text writes and CRDT text writes.
9. Migrate current text files once, with an idempotent migration and backup. Avoid seeding the same CRDT document twice on concurrent joins.

If the spike cannot produce a dependable integration, use server revisions plus explicit conflict handling or a single-writer lease as a reduced-scope fallback. Clearly label that limitation; it is not equivalent to unrestricted simultaneous editing.

**Acceptance:** scripted same-file edits converge across 2-5 clients; independent changes are retained; Unicode, undo, paste, rapid switching, reconnect, and delayed acknowledgments are covered. Anything shown as durably saved survives an immediate backend restart. Unsaved offline work is never silently discarded.

### B. Permissions and account lifecycle — P0/P1

- Write one action matrix for owner/editor/viewer across read, edit, rename, delete, execute, chat, share, restore, and GitHub operations.
- Centralize backend checks; the UI reflects permission, but never provides the security boundary.
- Validate file/project/room IDs server-side, and rate-limit/size-limit socket events as well as HTTP routes.
- Separate text editing from file management so an editor cannot spoof a deletion or rename event.
- Broadcast role/settings changes; handle removal, logout/session expiry, and ownership transfer on active sockets.
- Define whether ownership is singular or multiple. Existing `room.owner` and member roles must have consistent semantics.
- Add expiring/revocable invite links, a configurable default join role, member removal, and leave-room behavior when core checks pass.
- Review cookie, CSRF, Origin, CORS, and WebSocket handshake protections for the actual deployment. CORS is not a substitute for authorization or CSRF protection.
- Add profile/password-change flows; add password recovery with single-use expiring tokens if persistent public accounts are in scope. Verification email requires an approved email service, not hardcoded credentials.
- Make room/project deletion clean up execution records, dependency records, voice assets, and live state; use transactions or retryable cleanup jobs as appropriate.

**Acceptance:** direct API/socket attempts cannot bypass the role matrix or cross into another room/project; demotion updates other clients without a refresh; destructive actions cannot leave an ownerless room or silently lose data.

### C. Execution and dependency safety — P0

Keep Docker execution; never execute submitted source code directly on the host.

- Track each run with a job/container ID, enforce a server-side deadline, and explicitly remove its container on completion, timeout, cancellation, or disconnect policy.
- Add per-user and global concurrency/queue bounds in addition to the existing request limiter.
- Use non-root execution where supported, dropped capabilities, `no-new-privileges`, no network for code runs, bounded writable scratch space, and read-only input mounts where practical.
- Separate compile, startup, and program-runtime budgets; do not present container startup time as pure program runtime.
- Pre-pull and pin tested runtime images; surface readiness before a user clicks Run.
- Treat package installation as a separate network-enabled risk boundary. Prefer a small pinned allowlist/prebuilt dependency set for the college demo. Package-name validation alone does not make package code safe.
- Do not reinstall unpinned dependencies on every execution. Cache vetted dependencies by exact version/lock hash, with storage and eviction limits.
- Never expose the Docker daemon or its socket to the browser or user containers. For public multi-user use, isolate the runner from application credentials and the main database host.
- Keep stdout/stderr private to the initiating user; log metadata rather than source code, input, or secrets.

**Acceptance:** success, compiler error, runtime error, infinite loop, excessive output, and memory/process exhaustion have bounded behavior; no container remains after a timeout; a busy runner does not make the editor/API unresponsive. Test hostile workloads only in an isolated test environment.

### D. UI/UX and frontend maintainability — P1

Polish the existing product rather than replacing all screens for visual novelty.

| Surface | Recommended improvement |
| --- | --- |
| Landing | One clear student-team use case, a truthful product preview, and direct create/join calls to action. Remove unsupported claims. |
| Authentication | Clear field errors, password visibility, session-expired recovery, and a return to the originally requested room. |
| Dashboard | Resume last visited room, meaningful activity timestamps, accurate statistics, clear owned/joined sections, and useful empty states. |
| Workspace | Stable file explorer, file tabs, editor, collapsible output, and one contextual collaboration sidebar. Give the editor most of the space. |
| Status bar | Distinguish connecting, online, reconnecting, unsaved, saving, saved, and failed. Explain disabled actions. |
| Files/projects | Explicit project selection, correct path scoping, rename/delete feedback, per-file editor state, and safe unsaved-change handling. |
| Room settings | Separate member permissions from personal layout/editor preferences. Make destructive actions visually distinct. |
| GitHub | Show repository, branch, base revision, selected changes, conflict warnings, and confirmation before modifying remote state. |
| Analytics | Key data by room, refresh correctly, define metrics, and show useful activity rather than vanity counts. |

Implementation work:

- Extract `Room.jsx` into focused workspace layout, collaboration, file actions, execution, and permission modules after characterization tests exist.
- Use selective Zustand subscriptions; avoid re-rendering the entire room for every keystroke.
- Use shared visual tokens for color, spacing, typography, focus, and states. Respect existing theme support.
- Standardize errors, loading skeletons, toasts, confirmations, and retry actions.
- Add modal focus trapping/restoration, Escape behavior, dialog names, keyboard navigation, and reduced-motion handling.
- Add lazy route/panel loading where measurements justify it. Bundle Monaco assets/workers locally for a predictable restricted-network demo.
- Prioritize 1366x768 and 1920x1080 laptop layouts. Make dashboard/chat usable on phones, but do not promise a desktop IDE experience on a small touchscreen.

**Acceptance:** a new student can create a room, invite a peer, find a file, edit, run, and resume without coaching; keyboard-only core flows work; main actions remain reachable at common laptop sizes and 200% zoom.

### E. GitHub and recoverability — P1

- Store last-synced commit/blob references per repository/file, not only timestamps.
- Compare local, base, and remote state. Stop or ask for explicit resolution when both sides changed.
- Preview pull before it overwrites local work; create a recoverable checkpoint and coordinate with active editors.
- Feed imported text through the collaboration document lifecycle and invalidate/update relevant caches. Rejoining must not resurrect a stale pre-pull document.
- Extend existing change listing into a content diff; handle additions, renames, and deletions deliberately.
- Prefer one reviewed multi-file commit using Git tree/commit APIs, with non-forced reference updates and detection of a moved remote branch. A branch move must trigger re-evaluation, not an automatic overwrite.
- Exclude sensitive files such as environment files, private keys, credentials, and generated/dependency folders by default; display skipped files and limits clearly.
- Handle rate limits, revoked OAuth access, protected branches, partial failures, and cancellation without misleading success messages.
- Test with a dedicated repository; never use a teammate's important repository as a disposable fixture.

**Acceptance:** a changed remote file is not silently overwritten; selected changes map to the expected commit; pull failure is recoverable; all collaborators and a newly joined client see the same post-sync state.

### F. Communication and honest analytics — P1

- Load the most recent chat page, paginate backward, and deduplicate messages across fetch and socket delivery.
- Preserve code blocks/snippets with safe rendering; give sent, failed, and retry states clear meaning.
- Keep voice uploads authenticated with format/size/duration validation, retention, and cleanup. Use persistent object storage or a documented persistent volume for deployment.
- Add TURN configuration with short-lived credentials if screen sharing must work across restrictive networks. Test HTTPS, denied permissions, browser stop-sharing, and reconnect behavior.
- Bound supported screen-share viewer counts; peer-to-peer fan-out is not unlimited conferencing.
- Define active rooms, last visited, saves, runs, and session activity explicitly. Do not label file-save counts or keystrokes as contribution quality.
- Reset analytics on room changes and handle out-of-order requests. Do not infer learning outcomes from code volume.

**Acceptance:** after more than 200 messages, reopening shows recent messages and older history remains reachable; switching analytics rooms never shows another room's data; unavailable media features fail gracefully without disrupting editing.

### G. Signature feature: checkpoints and session review — P1/P2

Recommended differentiator: **a coding session that produces a recoverable, explainable record of work**.

Minimum P1 slice:

1. Create a named project checkpoint.
2. Compare current files with that checkpoint.
3. Owner restores it as a new revision after confirmation and a pre-restore checkpoint.
4. Connected editors are notified and resynchronize safely.

Optional P2 extension: start/end a lab session, record milestones, and export a concise Markdown session summary containing goal, participants, checkpoints, run-result metadata, and GitHub commit links. Start with deterministic summaries, not AI.

Proposed data additions, only as needed: versioned collaboration snapshots/updates, checkpoint records, activity events, invite records, and GitHub base references. Add indexes, retention, access controls, and explicit migrations alongside the features.

**Acceptance:** a team can demonstrate a meaningful change, inspect its diff, safely restore an earlier state, and explain who performed important actions. A session summary must not expose private messages, code, or secrets by default.

## 6. Delivery roadmap

Deployment feasibility and automated tests start in Week 1; they are not postponed until the end. The phases below have overlapping team work, but integration gates must be completed in order.

| Window | Main work | Exit gate |
| --- | --- | --- |
| Week 1 | Reproducible local setup, runtime pinning, baseline demo, test harness, lint/CI, role matrix, schema/event contracts, Yjs spike, deployment/runner feasibility. | Two users can exercise the existing flow; baseline failures are recorded; proposed collaboration approach is proven in a small integration. |
| Weeks 2-3 | Concurrent editing, correct file scoping, durable saving, reconnect/restart recovery. Backend teammate hardens socket authorization and runner cleanup in parallel. | P0 collaboration and access regression scenarios pass. No untracked run containers remain after timeouts. |
| Weeks 4-5 | Workspace refactor and polished UX, live permission updates, recent chat pagination, analytics correctness, basic account/member lifecycle. | Complete create/join/edit/run/save/resume path passes browser tests across three roles. |
| Week 6 | Conflict-aware GitHub operations and named checkpoints/diff/restore. | No silent overwrite in tested sync scenarios; recovery demonstrated from a checkpoint. |
| Week 7 | Media reliability and optional session-review extension, only if core gates passed. | Feature scope frozen; deferred capabilities clearly hidden or documented. |
| Week 8 | Deployment hardening, database/asset backup and restore, performance/load checks, accessibility and network testing. | Repeatable release and recovery procedure; performance report on stated hardware. |
| Weeks 9-10 | Student usability study, defect fixes, documentation, viva preparation, demo rehearsals, and contingency time. | Submission acceptance checklist passes; no new major features. |

### Suggested ownership

- **Frontend lead:** workspace layout, editor integration, accessibility, state boundaries, browser tests.
- **Backend/realtime lead:** authorization, collaboration persistence, reconnect semantics, database migrations.
- **Execution/integrations lead:** runner, package policy, GitHub synchronization, deployment.
- **Quality/product lead:** acceptance scenarios, CI, regression automation, checkpoints/session reporting, report/demo evidence.

For three people, share the fourth role. Testing and documentation remain each feature owner's responsibility, not work delegated entirely to one teammate.

Agree socket/API contracts before parallel changes. Assign one integrator for the shared collaboration lifecycle so independent work does not create competing sources of truth. Use short feature branches, focused pull requests, and a weekly working demonstration.

### If the deadline is shorter

Cut features, not safety gates. Prioritize one project per room with that restriction explicitly enforced, correct concurrent editing, durable saving, role enforcement, bounded execution, and a polished demo. Defer session summaries, expanded account flows, additional media work, arbitrary dependencies, and multi-project UI. Reduce supported languages or optional GitHub operations honestly if they cannot be tested. Do not market a simplified fallback as a full implementation.

## 7. Quality strategy and measurable acceptance

### Tooling to introduce

Keep the existing npm workspaces. Add real ESLint checks, a formatter policy, Vitest/React Testing Library for suitable frontend units, Node/Vitest plus Supertest for backend tests, Socket.IO integration clients, and Playwright for multi-browser-context flows. These are proposed additions, not tools currently installed.

Use an isolated MongoDB test database; never run destructive tests against real student work. Use mocked GitHub failures in CI plus a separate authorized integration test on the demo repository. Execution tests require a dedicated Docker-capable environment.

Recommended future CI gates: lockfile install, real lint, unit tests, API/socket integration tests, client build, and core Playwright tests. Keep actual commands and versions documented when added. Run vulnerability/dependency checks and secret scanning, but review findings rather than treating a scanner as proof of security.

### Mandatory regression scenarios

1. Register/login/logout, expired session, and unauthorized room access.
2. Owner/editor/viewer matrix through UI, direct REST, and direct socket messages.
3. Simultaneous same-file editing and independent different-file editing.
4. Rapid switching between files during the broadcast debounce.
5. Typing during an in-flight save and delayed/out-of-order acknowledgments.
6. Disconnect/reconnect, two tabs for one user, late join, and backend restart after a durable save.
7. Two projects containing `index.js`, including join, rename, delete, and GitHub import.
8. Role demotion/removal while the user is editing or sharing.
9. Program timeout, excessive output, compiler failure, memory/process limits, and queue saturation.
10. GitHub remote divergence, revoked authorization, failed pull, moved branch, and checkpoint restore during a live session.
11. More than 200 chat messages, denied microphone/screen permissions, and a restrictive-network share test if supported.
12. Analytics room switching, archive/delete cleanup, and database/voice-asset restore.

### Initial quality targets — to validate, not present as measured results

| Area | Initial acceptance target and measurement |
| --- | --- |
| Collaboration correctness | All deterministic concurrency/recovery fixtures converge with expected edits preserved; no silent data loss in the scripted suite. |
| Responsiveness | Remote edit visibility p95 below 300 ms on a documented LAN setup with five editors and approximately 50 KB documents; measure from source edit to remote application. |
| Reconnection | Clients converge within five seconds after transport is restored under the test workload; no false saved state. |
| Durability | Every revision labeled durably saved is recoverable after immediate server restart. |
| Authorization | Every denied action in the role/isolation matrix is rejected at the backend, including socket bypass attempts. |
| Runner | Deadline enforced and container removal verified within two seconds of timeout/cancellation under the test environment; queue remains bounded. |
| Load | Start with 20 connected clients across four rooms for a 30-minute soak; document CPU/RAM, active runs, latency percentiles, disconnects, and retained-state growth. Adjust capacity claims to evidence. |
| Usability | At least 8 of 10 consenting student participants complete the core task unaided; record completion time, confusion points, and fixes. |
| Accessibility | No critical automated accessibility findings on core screens, plus manual keyboard, focus, contrast, and zoom checks. |
| Demo reliability | Three consecutive successful full rehearsals on the actual presentation setup. |

Collect before/after evidence using identical workloads and hardware. Separate HTTP health-check latency from collaboration latency and end-to-end run latency from program runtime. Do not invent percentages, scalability results, or user-study outcomes.

## 8. Deployment and operational readiness

- Pin a tested, supported Node LTS/toolchain and runtime image versions after compatibility checks; use the lockfile for reproducible installation.
- Build the frontend and provide documented API startup, migrations, health/readiness checks, and graceful shutdown.
- Use HTTPS/WSS, explicit allowed origins, secure cookies, and a same-origin deployment where practical. A Vite development server is not the production host.
- Keep database and runner access private. The current unauthenticated MongoDB host-port mapping is a local-development convenience, not a public deployment configuration.
- Distinguish API liveness from MongoDB/runner readiness. Show unavailable execution without making basic editing fail.
- Maintain persistent storage for MongoDB and media; test backup restoration and retention cleanup.
- Log correlation IDs and redacted operational metadata. Track socket failures, save failures, runner queue/timeout counts, GitHub errors, and storage growth.
- Keep secrets in deployment configuration, never documentation, source, screenshots, or exported session reports.
- For the first release, prefer one measured API/collaboration instance. Add Redis adapters/shared state only if a real scaling requirement appears; an adapter alone does not solve durable document consistency.
- Prepare a local fallback with installed dependencies, cached editor assets, pre-pulled runner images, and synthetic demo data. GitHub OAuth/sync and external relays remain internet-dependent; describe that limitation honestly.
- Confirm the hosting budget and Docker support in Week 1. Do not select a platform that cannot support the required runner boundary.

## 9. College evaluation package

Prepare these alongside implementation, matching the actual college rubric:

1. **Problem statement and objectives:** the student teamwork/lab problem, target users, constraints, and measurable objectives.
2. **Existing-system comparison:** compare verified capabilities of relevant collaboration tools, cite current sources, and explain CodeSync's intended niche without claiming to outperform mature products universally.
3. **SRS and use cases:** actors, role matrix, workflows, functional/non-functional requirements, supported scope, and failure behavior.
4. **Architecture evidence:** component/deployment diagrams, MongoDB entity relationships, edit/save/reconnect sequence diagrams, execution lifecycle, and GitHub conflict flow.
5. **Design decisions:** why CRDT rather than naive replacement, why server authority, why isolated containers, and which trade-offs remain.
6. **Implementation documentation:** modules, schemas/migrations, API/OpenAPI documentation, socket event contracts, setup, and release procedure.
7. **Testing report:** test cases and actual results, defect history, performance setup/results, accessibility review, and student feedback.
8. **Project evidence:** individual contributions, real commits/PRs, a milestone log, screenshots, and a short backup demonstration video.
9. **Limitations/future work:** honest boundaries, unimplemented ideas, security assumptions, and scaling limits.

Make sure every teammate can explain the core design and at least one difficult bug, not just show screenshots. Explain how libraries were integrated and tested; do not claim to have invented a library's underlying algorithm.

## 10. Suggested 8-10 minute live demo

1. **Problem and product:** explain one concrete student-team workflow.
2. **Create/join:** student A creates a room; student B joins on a second browser/device.
3. **Collaborate:** both edit the same file, with presence and cursors visible; deliberately include overlapping activity.
4. **Permissions:** change B to viewer and demonstrate both the UI and enforced restriction.
5. **Run:** execute a useful sample; demonstrate a handled error or timeout without affecting the room.
6. **Recovery:** create a checkpoint, change the program, inspect a diff, and restore through the controlled flow.
7. **Continuity:** briefly disconnect/reconnect or reopen the room and show saved state.
8. **GitHub:** preview and push selected changes to the demo branch, if internet is available.
9. **Evidence:** show one automated concurrency test and measured results; end with limitations and next steps.

Use synthetic accounts and code. Preflight Docker images, firewall/network, HTTPS/media permissions, OAuth callback URLs, repository access, and projection resolution. Keep a recording and local fallback; if an external integration is unavailable, label the recorded demonstration rather than simulate a live success.

## 11. First implementation backlog

These are proposed tickets, not work already completed. Estimate them after the setup/spike; preserve the dependency order.

| ID | Ticket | Depends on | Done when |
| --- | --- | --- | --- |
| CS-01 | Reproduce clean setup and record baseline | None | Lockfile install/build works on a documented toolchain; two-user baseline and blockers recorded. |
| CS-02 | Real lint, regression harness, and CI | CS-01 | Frontend/backend checks run in CI; isolated test database and browser harness are usable. |
| CS-03 | Define canonical file scope and permission contracts | CS-01 | Action matrix/event schemas agreed; cross-room/project and forged metadata requests rejected by tests. |
| CS-04 | Characterize current edit/save races | CS-02 | Repro fixtures demonstrate simultaneous overwrite, rapid switching, and save-response races. |
| CS-05 | Prove and integrate collaboration document lifecycle | CS-03, CS-04 | Monaco/provider spike passes; correct IDs, concurrency, persistence, reconnect, and migration are verified. |
| CS-06 | Make execution cleanup and quotas dependable | CS-02, CS-03 | Timeout/cancel removes the actual container; global/user bounds and isolation checks pass. |
| CS-07 | Synchronize room settings and membership changes | CS-03 | All clients update; revoked capabilities are immediately rejected server-side. |
| CS-08 | Refactor workspace and polish golden path | CS-04, stable CS-05 contracts | Existing behavior retained; keyboard/accessibility and role-based end-to-end tests pass. |
| CS-09 | Repair chat history and analytics state | CS-02 | Newest messages load, pagination works, metrics are defined, and room switching is correct. |
| CS-10 | Add checkpoint/diff/restore and safe GitHub bases | CS-05, CS-07 | Restore and remote-conflict cases pass without stale live-state resurrection. |
| CS-11 | Deploy, measure, and rehearse | Core P0/P1 tickets | Backup restore, soak test, usability study, evidence package, and three rehearsals complete. |

### Definition of done for every feature

- User-facing acceptance criteria and failure cases are satisfied.
- Server-side access checks exist for any protected action.
- Automated tests cover meaningful behavior and a relevant edge case.
- Loading, empty, error, retry, and accessibility states are considered.
- No secrets or unnecessary personal data enter logs or reports.
- API/schema changes and migrations are documented and backward/rollback behavior is considered.
- Another teammate reviews the change and the integrated demo still works.

## 12. Decisions to confirm before scheduling

- Exact submission date, intermediate reviews, and marking rubric.
- Number of teammates, weekly capacity, and relevant experience.
- Primary audience: student teams, instructor-led labs, or interviews. Recommendation: student teams first.
- Whether the final evaluation requires public hosting or allows a local/LAN demonstration.
- Hosting budget, Docker-capable infrastructure, GitHub OAuth ownership, and whether email/TURN services are available.

**Recommended first milestone:** two authenticated users can safely edit one file, reconnect, and recover the durably saved result, while unauthorized users cannot modify it. Build the rest around that dependable core.
