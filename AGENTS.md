# Agent Guide

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
