# CodeSync: An Engineering Case Study of a Browser-Based Collaborative Coding Workspace

**Draft status:** student conference/workshop manuscript scaffold. Replace every `[TODO]` item
with author, venue, citation, and empirical-study information before submission.

## Abstract

Pair programming and guided coding activities often require participants to coordinate an editor,
screen-sharing software, chat, code execution, and persistence as separate tools. This paper
presents CodeSync, a browser-based collaborative coding workspace that integrates authenticated
rooms, project-scoped files, real-time presence, contextual chat, bounded code execution, optional
GitHub synchronization, and an optional repository-aware AI assistant. The system is implemented as
a MERN application using React, Monaco, Express, MongoDB, Socket.IO, JWT cookie authentication, and
Docker-based execution.

Rather than introducing a new conflict-resolution algorithm, this work contributes an engineering
case study of the design, security boundaries, reliability safeguards, and reproducible evaluation
of an integrated collaborative coding prototype. The implementation includes server-side room and
file authorization, file-bound client update queues, save-response reconciliation, stale-workspace
lifecycle guards, canonical Socket.IO file-scope validation, and resource limits for code execution.
The evaluation will combine automated fault-injection tests with a controlled student study that
compares CodeSync with a conventional editor-plus-communication-tool workflow. The study will
measure task completion time, tool switching, coordination failures, edit-loss incidents,
perceived workload, and usability.

**Keywords:** collaborative coding, browser IDE, pair programming, software engineering, access
control, Docker sandboxing, reproducibility

## 1. Introduction

Collaborative coding is used in pair programming, technical interviews, software laboratories, and
remote teaching. The technical work is not limited to editing text: participants must identify the
current file, communicate decisions, run code, inspect output, recover saved work, and understand
who is present. When these actions are distributed across an editor, a video call, a chat tool, a
terminal, and a source-control website, the workflow introduces context switching and coordination
overhead.

CodeSync explores a narrower engineering question: **can a dependable browser workspace combine the
core coordination surfaces for a small authenticated coding room without sacrificing file scope,
execution safety, persistence, or reproducibility?** The goal is not to replace professional IDEs
or source-control platforms. Instead, the system targets student teams and guided coding sessions
where a lightweight, invite-based workspace can reduce setup friction.

The current prototype provides authenticated room creation and joining, project/file management,
Monaco-based editing, presence and cursor updates, chat with search and voice notes, screen sharing,
Docker-backed execution for four languages, GitHub repository synchronization, analytics, and an
optional AI assistant. Because a feature-rich prototype can hide reliability problems, this paper
emphasizes the engineering safeguards around asynchronous saves, room lifecycle changes, scope
validation, and bounded execution.

This paper makes the following contributions:

1. It describes a reproducible architecture for an authenticated collaborative coding workspace.
2. It documents the implementation of file-scoped synchronization, save-race reconciliation,
   server-side permissions, and Docker execution limits.
3. It defines a fault-injection and user-study methodology for evaluating collaboration workflow,
   reliability, usability, and security boundaries.
4. It reports the limitations of a whole-file Socket.IO synchronization design and identifies the
   evidence required before making stronger claims about concurrent editing.

The paper addresses the following research questions:

- **RQ1:** Does integrating editing, communication, presence, and execution reduce workflow
  overhead compared with a split-tool baseline?
- **RQ2:** How usable is CodeSync for student pairs completing short coding tasks?
- **RQ3:** Which reliability failures appear under delayed saves, rapid file switching, reconnects,
  and simultaneous edits?
- **RQ4:** Do the tested authorization and execution boundaries prevent the defined unauthorized
  actions and unsafe host-side execution attempts?

## 2. Background and Related Work

### 2.1 Collaborative editors and pair programming

[TODO: Add scholarly work on pair programming, distributed pair programming, collaborative IDEs,
and browser-based editors. Explain how CodeSync differs in its combination of workflow surfaces,
not necessarily in its editor technology.]

### 2.2 Real-time document synchronization

Collaborative editors commonly use operational transformation, CRDTs, or server-mediated revision
protocols to merge concurrent text edits. CodeSync currently uses authenticated Socket.IO events
that carry whole-file state and client-side queues that bind updates to immutable file IDs. This
design reduces several local race conditions but should not be described as conflict-free editing.
The evaluation therefore treats convergence under simultaneous edits as an empirical question and a
known limitation.

[TODO: Add citations for OT, CRDTs, Monaco collaboration bindings, and representative collaborative
editor systems.]

### 2.3 Sandboxed code execution

CodeSync executes supported programs through Docker containers with network isolation, memory and
CPU limits, process limits, read-only filesystems where applicable, temporary writable storage,
bounded input/output, and timeouts. These controls reduce—but do not eliminate—the risk of running
untrusted code. A complete security claim requires testing container cleanup, hostile programs,
concurrency, image provenance, and the deployment host.

[TODO: Add citations for container isolation, online judge sandboxes, and untrusted-code execution.]

## 3. System Requirements and Threat Model

### 3.1 Requirements

The system was designed around the following requirements:

1. Users must authenticate before accessing protected rooms or collaboration sockets.
2. Room membership and role must control editing, file management, chat, screen sharing, and code
   execution.
3. Files must remain scoped to their project and room, including when paths repeat across projects.
4. A save response must not erase newer local edits made while the request is in flight.
5. Code execution must be bounded and must not run user code directly on the application host.
6. A fresh database and a clean checkout must be sufficient to reproduce the basic system setup.

### 3.2 Threat model

The threat model includes an authenticated but malicious room member, a viewer attempting editor-only
actions, a forged REST or Socket.IO payload containing another room or file ID, code attempting
network access or resource exhaustion, and delayed requests arriving after a user changes rooms.

The model does not claim to protect against a compromised operating-system kernel, a compromised
Docker daemon, a malicious database administrator, or global denial-of-service traffic. These limits
must be explicit in the final paper.

## 4. Architecture and Implementation

### 4.1 Components

The client is a React/Vite application using Monaco for editing, Zustand for workspace state, Axios
for REST calls, React Router for protected routes, and Socket.IO Client for presence and code events.
The server is an Express application backed by MongoDB and Mongoose. JWTs are stored in httpOnly
cookies for normal browser sessions. Socket.IO authenticates the handshake using the cookie or an
explicit token and then requires room membership before room-scoped events are accepted.

### 4.2 Workspace state and asynchronous saves

The client binds pending code changes to a file ID rather than to whichever file is active when a
debounce timer fires. Save requests for one file are serialized. When a response arrives, the store
compares the request snapshot with the current local file and preserves fields changed during the
request. Dirty state is retained when newer local text exists or when a save fails.

These mechanisms address local request races; they do not provide a complete multi-user merge
protocol. Simultaneous edits must therefore be tested and reported honestly.

### 4.3 Scope and authorization

The server resolves code events against the canonical file record in the requested room. Client
payload metadata cannot redefine a file's project, path, language, or filename. Content edits use
room edit permission; metadata changes and deletion require file-management permission. The client
also qualifies remote-file identity by project so equal paths in separate projects do not evict one
another.

### 4.4 Code execution

Execution validates the language, code size, and stdin size, checks room/project/file access, checks
Docker availability, writes a temporary workspace, and invokes a language-specific image. The
execution result is bounded and logged. The final evaluation must verify actual timeout behavior and
container cleanup instead of inferring those properties from command-line arguments.

### 4.5 Optional integrations

GitHub integration uses OAuth and encrypted token storage, supports repository selection and branch
selection, and exposes pull, change preview, and push operations. The AI assistant uses an
authenticated server route that excludes likely secret files, redacts common token formats, bounds
repository context, and keeps active-file application local until the user explicitly saves.

## 5. Evaluation Method

### 5.1 Automated verification

The repository includes backend Node tests and frontend Vitest/React Testing Library tests. The
current suite covers index initialization, AI context safety, provider response handling, OAuth
configuration errors, code-mutation normalization, chat ordering, save reconciliation, file-bound
queues, stale workspace responses, terminal controls, and cross-project path handling.

The reproducibility checks are:

```text
npm ci
npm test
npm run lint
npm run build
npm run test:mongodb --workspace server -- <isolated-local-mongodb-port>
```

Current local verification is **18 backend tests and 36 frontend tests**, plus a passing client
build, existing lint scripts, and an isolated MongoDB startup check. These are engineering checks,
not substitutes for a two-browser study or a live third-party integration test.

### 5.2 Fault-injection scenarios

The test protocol will delay saves by 500 ms, 2 s, and 5 s; switch files while updates are queued;
disconnect and reconnect a client; submit forged room/project/file identifiers; test every role
against every action; run infinite loops and high-output programs; disable Docker; and inspect
temporary directory and container cleanup after timeouts.

For each scenario, record the input, expected invariant, observed result, timestamp, and sanitized
log identifier. The raw logs must not contain cookies, tokens, source secrets, or participant
identifiers.

### 5.3 Controlled student study

The proposed study will recruit 6–12 pairs of students. Each pair will complete three tasks under
CodeSync and a split-tool baseline: implementing a small function, debugging a seeded defect, and
reviewing and executing a change. The order of conditions will be counterbalanced.

Primary measures are task completion time, completion rate, number of tool switches, coordination
messages, lost-edit incidents, execution failures, recovery time, and SUS or UMUX-Lite usability
score. A small sample will be treated as exploratory; results will use descriptive statistics and
confidence intervals rather than unsupported generalizations.

Human-participant testing requires institutional approval or the applicable course/research process,
informed consent, anonymized IDs, and a data-retention plan.

## 6. Results

### 6.1 Automated and integration results

| Evaluation | Result | Status |
| --- | --- | --- |
| Backend regression suite | 18 passing tests | Completed |
| Frontend regression suite | 36 passing tests | Completed |
| Client production build | Passed; known bundle/Browserslist warnings | Completed |
| API health and protected-route smoke checks | Healthy; protected routes reject unauthenticated requests | Completed |
| Fresh isolated MongoDB startup | Index initialization and legacy backfill passed | Completed |
| Two-browser collaboration | `[TODO: run and record]` | Pending |
| Live Docker hostile-program tests | `[TODO: run and record]` | Pending |
| GitHub OAuth/pull/push integration | `[TODO: configure test OAuth app and record]` | Pending |
| Screen sharing across restrictive network | `[TODO: run and record]` | Pending |
| Live AI provider evaluation | `[TODO: use rotated key and record sanitized results]` | Pending |
| Human usability study | `[TODO: ethics/consent and data collection]` | Pending |

### 6.2 User-study results

`[TODO: Insert participant count, task-level descriptive statistics, confidence intervals, usability
scores, qualitative themes, and order-effect analysis. Do not fabricate values.]`

## 7. Discussion

The expected value of CodeSync is workflow integration: participants can see the same room state,
discuss decisions near the editor, execute code through a bounded interface, and preserve project
files without manually coordinating several applications. The engineering safeguards are most
valuable where asynchronous UI behavior can otherwise produce silent data loss.

The main limitation is collaboration semantics. A whole-file event model can protect against several
client-side races while still losing independent simultaneous edits. A future version should evaluate
a revision protocol, operational transformation, or an authenticated CRDT provider. Additional
limitations include the need for TURN support for difficult WebRTC networks, live GitHub and AI
provider verification, and a deeper Docker cleanup/concurrency audit.

## 8. Threats to Validity

- **Internal validity:** learning effects may influence the counterbalanced user study.
- **External validity:** a small student sample may not represent professional teams or classrooms.
- **Measurement validity:** tool-switch counts and coordination failures require consistent coding
  rules and ideally two independent raters.
- **System validity:** mocked provider, socket, Monaco, and media tests do not prove live integration.
- **Security validity:** resource flags are not a complete container escape analysis.
- **Reproducibility validity:** third-party OAuth, Docker images, browser versions, and network
  conditions may affect results.

## 9. Conclusion

CodeSync is an engineering prototype for authenticated, browser-based collaborative coding. Its
contribution is a reproducible integration of editing, presence, communication, persistence,
bounded execution, and source-control workflows, together with explicit safeguards for common
asynchronous client and authorization failures. The next step is not to claim universal reliability;
it is to complete the two-browser, hostile-execution, third-party integration, and student-study
evaluation required to determine where the design succeeds and where its whole-file collaboration
model remains insufficient.

## Reproducibility and ethics statement

The code, setup instructions, test commands, synthetic fixtures, and anonymized evaluation scripts
should be released with the final paper where licensing and institutional policy permit. No API keys,
OAuth secrets, cookies, raw voice recordings, or personal participant identifiers should be included.
Human-participant data collection should begin only after the relevant institutional approval or
course authorization is obtained.

## References

`[TODO: Add venue-appropriate scholarly references for pair programming, collaborative editors,
CRDT/OT, browser IDEs, container security, software reproducibility, usability measurement, and
educational technology.]`
