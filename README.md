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
npm start        # start the Express server
```

Workspace scripts are also available:

```bash
npm run dev --workspace client
npm run dev --workspace server
```

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

Chat:

- `GET /api/chat/room/:roomId`

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

All real-time events are scoped to the joined room. The server authenticates Socket.IO connections with the same HTTP-only JWT cookie used by the REST API.

## Security Notes

- JWT is stored in an HTTP-only cookie.
- Protected REST routes use authentication middleware.
- Socket.IO connections are authenticated before room events are registered.
- GitHub OAuth access tokens are encrypted at rest and never exposed in API responses.
- Joi validates request bodies and parameters.
- Helmet, CORS, rate limiting, Mongo query sanitization, HPP protection, and XSS sanitization are enabled.
- MongoDB indexes are defined on auth, room lookup, membership, project, file, and chat query paths.

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
