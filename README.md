# CodeSync

CodeSync is a production-oriented MERN application for real-time collaborative coding. It uses MongoDB, Express, React, Node.js, Socket.IO, Monaco Editor, JWT cookie authentication, request validation, rate limiting, and secure HTTP middleware.

## Stack

- Frontend: React, Vite, JavaScript, Tailwind CSS, Zustand, Axios, React Router, Monaco Editor, Socket.IO Client
- Backend: Node.js, Express, MongoDB, Mongoose, Socket.IO, JWT, bcrypt, Joi, Helmet, CORS, cookie-parser, express-rate-limit, Morgan, Axios, Octokit
- DevOps: npm workspaces, Docker Compose for MongoDB

## Project Structure

```text
codesync/
  client/
  server/
  README.md
  docker-compose.yml
  package.json
```

## Prerequisites

- Node.js 20+
- npm 10+
- Docker Desktop, or a local MongoDB instance

## Environment

Create local environment files from the examples:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

Set strong `JWT_SECRET` and `GITHUB_TOKEN_ENCRYPTION_SECRET` values in `server/.env`. For GitHub sync, also configure `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and `GITHUB_REDIRECT_URI` from a GitHub OAuth App. For local development, the server can generate temporary secrets if they are not provided, but fixed strong secrets are required for stable sessions, GitHub token decryption, and production deployments.

## Setup

Install all workspace dependencies from the repository root:

```bash
npm install
```

Start MongoDB:

```bash
docker compose up -d
```

Run the full application:

```bash
npm run dev
```

The client runs on `http://localhost:5173` and the API runs on `http://localhost:5000`.

On Windows, you can also double-click `run-dev.bat` from the project root to start both the backend and frontend.

## LAN Access

The dev servers are configured for local network access. Find your machine's IPv4 address, then other devices on the same network can open:

```text
http://YOUR_IPV4_ADDRESS:5173
```

For example:

```text
http://192.168.1.25:5173
```

The React app automatically connects API and Socket.IO traffic to `http://YOUR_IPV4_ADDRESS:5000`. In development, the backend accepts CORS requests from localhost and private network origins. If Windows Firewall prompts for Node.js access, allow it on private networks.

## Scripts

```bash
npm run dev      # run client and server together
npm run build    # build the React client
npm test         # run backend and frontend regression tests
npm start        # start the Express server
```

Workspace scripts are also available:

```bash
npm run dev --workspace client
npm run dev --workspace server
```

## Regression Tests and Improvement Work

Install the exact locked dependencies with `npm ci`, then run from the repository root:

```bash
npm test
npm run lint
npm run build
```

The regression suite uses Vitest, React Testing Library, and jsdom. It tests per-file
debouncing, save reconciliation, dirty-state feedback, rename interactions, and stale
workspace responses. API calls, sockets, Monaco, and media components are mocked in
the component tests; MongoDB, Docker, credentials, and a running server are not required.
These tests do not replace an actual two-browser collaboration or sandbox test.

Backend startup/index tests use Node's built-in test runner and mock database calls:

```bash
npm run test --workspace server
```

For a real fresh-database check, run `npm run test:mongodb --workspace server -- PORT`
with the port of a separate local MongoDB test instance. The check does not read
`.env`: it creates a uniquely named test database, reproduces the missing-collection
error, verifies initialization and repeated startup/backfill, then deletes only that
generated test database. It never targets the application's `codesync` database.

Run a focused suite or watch tests while developing:

```bash
npm test --workspace client -- src/store/room.store.test.js
npm run test:watch --workspace client
```

`.github/workflows/checks.yml` runs install, tests, the existing lint scripts, and a
production build on Node 22 after pushes/pull requests. The existing `lint` command
is still only a server entry-point syntax check plus a client development build;
full ESLint and backend integration coverage remain follow-up work.

### Editor smoke checks

With the normal application and MongoDB running, use two authenticated browser sessions:

1. Create/open files A and B. Edit A and quickly select B. Only A should change on
   the other client. Edit both quickly and verify both updates arrive separately.
2. Slow the save request with browser network throttling. Save A, then continue
   typing before the response arrives. New text must remain and the status must
   stay **Unsaved changes** until another successful save.
3. Rename a file with unsaved text. Its path changes, but rename does not implicitly
   save or replace its text. Save explicitly, then reload to check persistence.
4. Simulate a failed save. The editor should remain available with the local text,
   an error notice, and a usable Save button for retry.
5. Leave the room while a request is pending. Its late response must not populate
   a different workspace or emit an old queued text change.

Current scope: these changes fix client-side request/debounce races, not concurrent
multi-user merging or offline recovery. Disconnected queued broadcasts are discarded
instead of replayed blindly; users should save before leaving. Conflict-safe editing,
durable autosave, reconnect recovery, and socket authorization hardening remain in
`IMPROVEMENT_PLAN.md`.

## API Routes

Authentication:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

Rooms:

- `POST /api/rooms`
- `GET /api/rooms`
- `GET /api/rooms/:roomId`
- `POST /api/rooms/join`
- `PATCH /api/rooms/:roomId`
- `DELETE /api/rooms/:roomId`

Projects:

- `POST /api/projects`
- `GET /api/projects/room/:roomId`
- `GET /api/projects/:projectId`
- `PATCH /api/projects/:projectId`
- `DELETE /api/projects/:projectId`

Files:

- `POST /api/files`
- `GET /api/files/project/:projectId`
- `GET /api/files/:fileId`
- `PATCH /api/files/:fileId`
- `DELETE /api/files/:fileId`

Execution:

- `POST /api/execute`

Chat:

- `GET /api/chat/room/:roomId`
- `GET /api/chat/room/:roomId/search?q=keyword&limit=50&page=1`
- `POST /api/chat/room/:roomId/voice`
- `GET /api/chat/voice/:fileName`

GitHub:

- `GET /api/github/oauth/start`
- `GET /api/github/oauth/callback`
- `GET /api/github/account`
- `DELETE /api/github/account/disconnect`
- `GET /api/github/repos`
- `GET /api/github/repos/:owner/:repo/branches`
- `POST /api/github/projects/:projectId/connect-repo`
- `GET /api/github/project/:projectId`
- `DELETE /api/github/repositories/:id/disconnect`
- `POST /api/github/repositories/:id/pull`
- `POST /api/github/repositories/:id/push`

AI:

- `POST /api/ai/generate`

## GitHub Integration

CodeSync lets each authenticated user connect their GitHub account with OAuth, then choose repositories from a searchable in-app picker. There are no hardcoded tokens, and GitHub access tokens are encrypted at rest.

### Create a GitHub OAuth App

1. Open GitHub Developer Settings.
2. Create a new OAuth App.
3. Set Homepage URL to `http://localhost:5173`.
4. Set Authorization callback URL to `http://localhost:5000/api/github/oauth/callback`.
5. Add the generated client ID and client secret to `server/.env`.

Required variables:

```bash
GITHUB_CLIENT_ID=your-client-id
GITHUB_CLIENT_SECRET=your-client-secret
GITHUB_REDIRECT_URI=http://localhost:5000/api/github/oauth/callback
GITHUB_TOKEN_ENCRYPTION_SECRET=replace-with-a-random-64-character-secret
CLIENT_URL=http://localhost:5173
```

Restart the backend after changing these values:

```powershell
npm run dev --workspace server
```

If OAuth is not configured, CodeSync keeps the rest of the application available
and redirects the GitHub connection attempt to a readable setup-error page. It
does not expose the client secret in the browser. Never paste the GitHub client
secret into chat, source files, screenshots, or commits.

OAuth permissions:

- `public_repo` is enough for public repository sync.
- `repo` is required when users need private repository access.
- The UI uses “Connect GitHub Account” first. Manual PATs should be treated only as an advanced fallback, not the normal user path.

GitHub sync behavior:

- Users connect a GitHub account from the room workspace or project page.
- Users select a repository from their GitHub account and choose a branch.
- Pull imports safe text files only, up to 80 files and 500 KB per file.
- Imported files are saved as CodeSync project files and broadcast to room collaborators.
- Users can push CodeSync files back to GitHub only after confirming the push.
- CodeSync never auto-pushes changes.

Security:

- Raw GitHub tokens are never stored.
- OAuth access tokens are encrypted with `GITHUB_TOKEN_ENCRYPTION_SECRET` before persistence.
- Token fields are excluded from API responses.
- Project and room access are validated before repository connect, pull, and push.
- GitHub endpoints have a stricter rate limit than normal API routes.
- Never commit tokens, `.env` files, SSH keys, or private credentials.

## Gemini AI Assistant

CodeSync includes an optional, server-mediated Gemini assistant inside each room.
It can generate code, explain code, suggest fixes, and review the active project.
The backend loads repository context from the authenticated project, prioritizes
the active file, excludes likely secret files, redacts common secret assignments,
and sends bounded context to Gemini. The browser never receives the Gemini key or
builds the repository context request itself.

Configure Gemini only in `server/.env`:

```bash
GEMINI_API_KEY=replace-with-your-rotated-gemini-key
GEMINI_BASE_URL=https://generativelanguage.googleapis.com/v1beta
GEMINI_MODEL=gemini-3.1-flash-lite
```

Do not put `GEMINI_API_KEY` in `client/.env`, source code, screenshots, commits,
issue reports, or chat messages. If a key is ever pasted into a chat or committed,
revoke/rotate it immediately and replace it in `server/.env`.

Restart the backend after changing the server environment:

```powershell
npm run dev --workspace server
```

In a room, open the **CodeSync AI** sparkle button or the **CodeSync AI** tab in
the collaboration panel. Choose an intent, describe the task, and optionally add
selected text. Review the response, warnings, target file, and code preview before
using **Apply to editor**. Applying code changes only the local editor and marks
the file unsaved; it does not save automatically. Review the change and use the
normal Save action when ready.

If Gemini is not configured, the rest of CodeSync remains available and the panel
shows a configuration message instead of failing room startup. AI requests are
authenticated, project-scoped, bounded, timed out, and rate-limited per user.

The server accepts only the room/project/file identity, intent, prompt, and optional
selection. It does not accept arbitrary client-supplied repository context.

## Code Execution

CodeSync can run the active file from a room workspace for these languages only:

- JavaScript: `.js`
- Python: `.py`
- C++: `.cpp`, `.cc`, `.cxx`
- C: `.c`

Execution is a per-user action. Output is shown only to the user who clicks Run and is not stored in the database.

### Docker Requirement

Code execution requires Docker to be installed and running on the server. The backend uses Docker containers as the sandbox and never runs submitted code directly on the host.

Sandbox controls:

- Network disabled with `--network none`
- Memory limited to `128m`
- CPU limited to `0.5`
- Process count limited with `--pids-limit 64`
- Container removed after each run with `--rm`
- Read-only container filesystem where possible
- Timeout of 5 seconds
- Code size limit of 200 KB
- stdin limit of 20 KB

The first C or C++ run may take longer because Docker may need to pull the `gcc:13` image. JavaScript uses `node:20-alpine`; Python uses `python:3.11-alpine`.

Troubleshooting:

- If you see `Code execution requires Docker to be running on the server.`, start Docker Desktop or the Docker daemon.
- If C or C++ runs are slow at first, wait for Docker to finish pulling the GCC image.
- If Docker reports permission errors on Linux, make sure the backend process user can access the Docker daemon.
- Never replace the Docker sandbox with direct `child_process` execution of user code on the host.

## Socket Events

Room events:

- `room:join`
- `room:leave`
- `room:users`

Code events:

- `code:change`
- `code:sync`

Cursor events:

- `cursor:move`
- `cursor:update`

Chat events:

- `chat:send`
- `chat:new`
- `typing:start`
- `typing:stop`

Voice notes are uploaded over REST as `multipart/form-data`; Socket.IO only broadcasts the created message metadata and playback URL.

Screen share events:

- `screen:start`
- `screen:stop`
- `screen:active`
- `screen:user-joined-viewer`
- `screen:user-left-viewer`
- `webrtc:offer`
- `webrtc:answer`
- `webrtc:ice-candidate`

All real-time events are scoped to the joined room. The server authenticates Socket.IO connections with the same HTTP-only JWT cookie used by the REST API.
Screen sharing uses browser WebRTC peer-to-peer connections. The server only handles signaling.

## Security Notes

- JWT is stored in an HTTP-only cookie.
- Protected REST routes use authentication middleware.
- Socket.IO connections are authenticated before room events are registered.
- GitHub OAuth access tokens are encrypted at rest and never exposed in API responses.
- Joi validates request bodies and parameters.
- Helmet, CORS, rate limiting, Mongo query sanitization, HPP protection, and XSS sanitization are enabled.
- MongoDB indexes are defined on auth, room lookup, membership, project, file, and chat query paths.
- Voice notes are stored locally in `server/uploads/voice-notes/` for development. Browsers require microphone permission before recording. For production, move voice note storage to object storage such as S3 or Cloudinary and keep the same metadata-only chat message flow.

## Production

Use a managed MongoDB URI and set production environment variables:

```bash
NODE_ENV=production
MONGODB_URI=mongodb+srv://...
CLIENT_URL=https://your-client-domain.com
JWT_SECRET=your-strong-random-secret
GITHUB_TOKEN_ENCRYPTION_SECRET=your-strong-random-secret-for-github-token-encryption
GITHUB_CLIENT_ID=your-github-oauth-client-id
GITHUB_CLIENT_SECRET=your-github-oauth-client-secret
GITHUB_REDIRECT_URI=https://your-api-domain.com/api/github/oauth/callback
COOKIE_SAME_SITE=none
```

When `COOKIE_SAME_SITE=none`, HTTPS is required because cookies are sent with `secure: true`.

## Git Repository Setup

Do not commit secrets, tokens, SSH keys, private repository credentials, local `.env` files, `node_modules`, or build output. This project is Git-ready, but no GitHub remote is configured automatically.

### Option 1: Create a new GitHub repository

1. Go to GitHub.
2. Create a new repository named `codesync`.
3. Do not add README, `.gitignore`, or license if project already has them.
4. Run:

```bash
git init
git add .
git commit -m "Initial production setup"
git branch -M main
git remote add origin <your-repo-url>
git push -u origin main
```

### Option 2: Use an existing repository

```bash
git init
git remote add origin <your-existing-repo-url>
git pull origin main --allow-unrelated-histories
git add .
git commit -m "Add CodeSync production project"
git push -u origin main
```

### Option 3: Private repository

Private repo setup is the user's responsibility.

User can use either:

HTTPS:

```bash
git remote add origin https://github.com/username/repo.git
```

SSH:

```bash
git remote add origin git@github.com:username/repo.git
```

For private repos:

- User must authenticate with GitHub login, GitHub CLI, PAT, or SSH key.
- Do not store tokens in code.
- Do not store tokens in `.env` unless absolutely necessary.
- Never commit credentials.
