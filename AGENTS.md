# Agent Guide

PLAN.md is the source of truth for project planning.
This guide provides a quick reference to the repository structure, development commands, and key considerations for working with the Excalidraw codebase.
todo.md is a task tracking file that should be updated based on the milestones and tasks outlined in PLAN.md. Always refer to PLAN.md for the most up-to-date information on project goals and tasks.
When done with a task, check it off in todo.md and update PLAN.md if necessary to reflect any changes in the project plan or milestones.

## Repo Purpose
- Excalidraw monorepo.
- `excalidraw-app` is the public Vite app.

## Key Directories
- `excalidraw-app/`: Vite app for the public demo.
- `packages/*`: Shared libraries and packages used across the repo.
- `examples/*`: Example integrations and demos.

## Public Dev Demo
- Run the Vite app: `yarn --cwd excalidraw-app vite`.
- The basic-auth proxy is outside the repo; run it separately if needed.

## Local Hosting and Run Checks
- Preferred local host command: `yarn host:app` (serves on `http://localhost:3001`).
- Before checking localhost health, run TypeScript typecheck:
  - `cd excalidraw-app && TMPDIR=/tmp yarn tsc --noEmit`
- If Yarn temp/cache permissions fail, run with user-owned temp/cache dirs:
  - `mkdir -p "$HOME/.tmp/yarn" "$HOME/.cache/yarn"`
  - `TMPDIR="$HOME/.tmp/yarn" YARN_CACHE_FOLDER="$HOME/.cache/yarn" yarn host:app`
- Check if app is running:
  - `curl -I http://localhost:3001/` and confirm `HTTP/1.1 200 OK`.
  - `lsof -nP -iTCP:3001 -sTCP:LISTEN` to confirm a listener exists.
- After any major code change, always verify the app loads before reporting back.
- If the app is not running when verification is needed, start it first, then run the checks above.

## Common Commands
- Install deps: `yarn install`.
- Run Vite app: `yarn --cwd excalidraw-app vite`.
- Build packages: `yarn build:packages`.
- Tests: `yarn test`.

## Node/Yarn
- Node.js >= 18.
- Yarn 1.22.

## Gotchas
- Set `server.open` to `false` for headless environments.
- Fonts/assets: ensure static assets are present and paths resolve correctly when running locally.
