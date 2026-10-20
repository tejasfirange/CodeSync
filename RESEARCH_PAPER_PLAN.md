# CodeSync Research Paper Plan

## Working title

**CodeSync: A Secure and Durable Real-Time Collaborative Coding Workspace for Student Teams**

Alternative titles:

- **Design and Evaluation of CodeSync, a Browser-Based Collaborative Coding Environment**
- **From Shared Editor to Reproducible Coding Workspace: The CodeSync Architecture**

## Publication positioning

CodeSync should currently be presented as a **design-and-evaluation software systems paper** or
**student research prototype paper**, not as a claim that a new collaboration algorithm has been
invented. The strongest contribution is the integration of authenticated rooms, scoped files,
real-time presence, bounded code execution, persistence, GitHub synchronization, and a measured
student workflow in one reproducible MERN system.

The paper must not claim “perfect reliability,” “conflict-free collaboration,” or production-grade
security until those properties are demonstrated with the experiments below. The current system
still uses Socket.IO whole-file updates rather than a CRDT or operational-transform protocol, so
concurrent editing should be described as a known limitation unless the collaboration protocol is
substantially upgraded and evaluated.

## Proposed research questions

### RQ1 — Workflow efficiency

Does CodeSync reduce context switching and task completion time compared with a conventional
combination of a code editor, screen sharing, chat, and a separate execution tool?

### RQ2 — Collaboration usability

Can student pairs complete a shared coding task with fewer coordination failures and lower perceived
friction when files, presence, chat, and execution are colocated?

### RQ3 — Reliability and data integrity

How does CodeSync behave under rapid file switching, delayed saves, reconnects, simultaneous edits,
and room/project isolation tests?

### RQ4 — Safety and access control

Do room roles, project/file scope checks, authenticated sockets, and Docker execution limits prevent
unauthorized edits, cross-room access, and unsafe host-side execution in the tested threat model?

### RQ5 — Reproducibility

Can another student or researcher install, run, and evaluate the system from the repository and
documented environment without access to private credentials?

## Claimed contributions

Use only contributions supported by the final evaluation:

1. An end-to-end architecture for authenticated collaborative coding rooms built with React,
   Express, MongoDB, Socket.IO, Monaco, and Docker.
2. A room/project/file permission model with server-side authorization and canonical file-scope
   validation.
3. A bounded execution workflow for JavaScript, Python, C, and C++ using resource-limited Docker
   containers.
4. A reproducible test and deployment workflow covering persistence, client save races, room
   lifecycle, and workspace-panel behavior.
5. An empirical evaluation with student tasks, fault-injection scenarios, and security boundary
   tests.

Do not list the Gemini assistant as a primary contribution unless a separate study evaluates its
usefulness, safety, and effect on student outcomes. It is currently an optional supporting feature.

## Paper structure

### 1. Introduction

- Explain the coordination problem in pair programming, interviews, and guided labs.
- State why existing tools force users to split editing, communication, execution, and persistence.
- Introduce CodeSync and its design goal: one scoped, authenticated workspace.
- State the research questions and contributions.
- Clearly state the collaboration and evaluation boundaries.

### 2. Background and related work

Compare CodeSync with:

- desktop collaborative editors and live coding tools;
- browser IDEs and cloud development environments;
- screen-sharing plus chat workflows;
- CRDT/operational-transform collaboration systems;
- containerized code execution platforms;
- collaborative learning and pair-programming research.

This section needs real scholarly citations selected for the target venue. Do not invent citations.

### 3. System requirements and threat model

Requirements:

- authenticated room access;
- scoped projects and files;
- role-aware edit, file-management, chat, screen-share, and execution permissions;
- durable saves and recoverable workspace state;
- bounded execution with clear failure states;
- reproducible local deployment.

Threat model:

- an authenticated but malicious room member;
- a viewer attempting editor-only actions;
- a client forging file/project/room identifiers in REST or Socket.IO payloads;
- code attempting network access, excessive CPU/memory/process creation, or host escape;
- a stale or delayed request arriving after a user changes rooms.

Out of scope unless separately tested: a compromised host kernel, malicious Docker daemon,
malicious MongoDB administrator, and global Internet-scale denial of service.

### 4. Architecture and implementation

Describe:

- React/Vite client and Monaco editor;
- Zustand workspace state and dirty/save reconciliation;
- Express/MongoDB REST services;
- JWT httpOnly-cookie authentication;
- authenticated Socket.IO handshake and room membership;
- real-time presence, cursors, chat, and code events;
- Docker execution limits and supported languages;
- GitHub OAuth, encrypted token storage, pull/change-preview/push flow;
- optional repository-aware AI context handling with secret exclusion and redaction.

Include one architecture diagram and one sequence diagram for:

1. join room → hydrate project/files → join Socket.IO room;
2. edit → queued event → server authorization → collaborator update → explicit save;
3. execute → access check → Docker run → bounded result → execution log.

### 5. Reliability and security design

Explain the design decisions that are already implemented:

- file-bound client update queues;
- stale workspace generation guards;
- save reconciliation that preserves newer local edits;
- canonical room/file scope checks for code socket events;
- project-qualified remote-file merging;
- isolated fresh-MongoDB index initialization;
- rate limiting, request validation, response size limits, and secret redaction.

Separate implemented protections from planned work. In particular, whole-file Socket.IO updates
are not equivalent to conflict-free concurrent editing.

### 6. Evaluation methodology

#### 6.1 Functional test matrix

Test each feature with a clean database and authenticated accounts:

| Area | Main scenario | Boundary/error scenario | Evidence |
| --- | --- | --- | --- |
| Auth | register, login, session restore, logout | wrong password, expired/invalid token, duplicate email | request/response logs with secrets removed |
| Rooms | create, list, join by code, reopen | non-member access, invalid ID, disband cleanup | API tests and screenshots |
| Projects/files | create, edit, save, rename, delete | duplicate path, stale save, failed save, late response | automated tests + two-browser run |
| Collaboration | presence, cursors, code sync, room leave | rapid file switching, reconnect, simultaneous edits | screen recording and event traces |
| Chat | send, edit, delete, search, voice note | empty message, long message, disabled viewer action, newest-page order | API/UI evidence |
| Execution | JS/Python/C/C++ success and stdin | syntax error, timeout, output limit, Docker unavailable, unauthorized role | execution result records |
| Screen sharing | start, viewer join, stop | permission denial, disconnect, restrictive network | two-browser test |
| GitHub | OAuth, connect, branch, pull, preview, push | missing OAuth config, read-only repo, unsafe path, remote conflict | sanitized integration log |
| AI | explain/fix/review, copy, local apply | no key, provider timeout, secret file, oversized context | mocked tests + optional live test |

#### 6.2 Baselines

Use at least one baseline:

- conventional editor + video call + chat + local terminal; or
- a browser editor with separate communication and execution tools.

Keep task difficulty, code seed, network, and participant instructions constant.

#### 6.3 Human study

Recommended minimum for a student paper:

- 12–24 participants, preferably 6–12 pairs;
- balanced order: half use CodeSync first, half use the baseline first;
- three tasks: implement a small function, debug a seeded defect, and review/execute a change;
- 20–30 minutes per condition;
- post-task SUS or UMUX-Lite questionnaire plus a short interview;
- collect consent, anonymized IDs, and no source code containing personal data.

Metrics:

- task completion time;
- successful task completion rate;
- number of tool switches;
- coordination messages/clarifications;
- incorrect or lost-edit incidents;
- execution failures and recovery time;
- SUS/UMUX-Lite score;
- NASA-TLX or a shorter perceived workload measure.

Use descriptive statistics and confidence intervals. If the sample is small, label tests as
exploratory and avoid unsupported causal claims.

#### 6.4 Fault injection and security tests

- delay save responses by 500 ms, 2 s, and 5 s;
- switch files while events are queued;
- disconnect/reconnect one client;
- send forged room/project/file IDs over REST and Socket.IO;
- test editor/viewer/owner action matrices;
- run infinite loops, high-output programs, process-spawning programs, and network attempts;
- verify Docker containers and temporary work directories are removed after timeout/error;
- test clean startup against a fresh MongoDB database;
- run dependency and secret scanning before submission.

## Current evidence and remaining gaps

### Evidence already available

- 17 backend tests pass.
- 36 frontend tests pass.
- `npm run lint` passes its current scripts.
- `npm run build` passes.
- `git diff --check` passes.
- `/health` returns a healthy response from the running API.
- Isolated fresh-MongoDB startup/index/backfill check passes on MongoDB 7.
- API smoke checks return 401 for protected routes without authentication and 404 for unknown routes.

### Not yet evidence for a paper claim

- No controlled user study.
- No two-browser concurrency/convergence study.
- No live GitHub OAuth integration run with configured credentials.
- No live Gemini-provider evaluation with a rotated key.
- No complete screen-sharing test across restrictive networks or TURN.
- No Docker timeout/container-cleanup audit covering hostile programs.
- No remote CI result in the current work session.
- No venue-specific bibliography, ethics approval, or author/contribution statement.

## Reproducibility package

Prepare the submission companion materials:

- anonymized repository tag or release;
- `.env.example` files with placeholders only;
- Docker Compose file for MongoDB;
- seed script with synthetic rooms/files;
- exact Node/npm versions;
- one-command test/build instructions;
- sanitized benchmark and user-study CSV files;
- analysis notebook or scripts;
- architecture diagrams and UI screenshots;
- threat-model and limitations document.

Never include API keys, GitHub secrets, cookies, access tokens, voice recordings without consent,
or raw participant identifiers.

## Next decisions needed from the authors

1. Target venue and paper length: college symposium, student conference, workshop, or journal.
2. Author list, affiliations, and contribution order.
3. Whether human-participant testing is permitted by the institution.
4. Whether the paper should focus on educational collaboration, software architecture/security, or
   developer productivity.
5. Whether to treat the current whole-file collaboration protocol as a limitation or upgrade it
   before evaluation.

Once these are decided, this plan can be turned into a full IMRaD paper draft, an experiment
protocol, consent text, and a results template without inventing data.
