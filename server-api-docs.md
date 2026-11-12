# Laravel Drawing API (Excalidraw-compatible) Documentation

This document describes the API implemented in `/Users/oliver/Herd/automatisch` and how it is used by this Excalidraw project. When adding functionality, you are allowed to update the project in `/Users/oliver/Herd/automatisch` and the API contract described here, but breaking changes to the API should be avoided to prevent frontend integration issues.

## 1) What is implemented

- Prefix: `/api/v2`
- Routes in `/Users/oliver/Herd/automatisch/routes/api.php`:
  - `POST /api/v2/post`
  - `GET /api/v2`
  - `GET /api/v2/{id}`
  - `GET /api/v2/{id}/meta`
- Controller: `/Users/oliver/Herd/automatisch/app/Http/Controllers/Api/DrawingController.php`
- Request validation:
  - `/Users/oliver/Herd/automatisch/app/Http/Requests/Api/StoreDrawingRequest.php`
  - `/Users/oliver/Herd/automatisch/app/Http/Requests/Api/ListDrawingsRequest.php`
- Persistence model: `/Users/oliver/Herd/automatisch/app/Models/Drawing.php`
- Table migration:
  - `2026_02_12_221612_create_drawings_table.php`
  - `2026_02_13_203500_alter_drawings_payload_to_longblob.php`
- Config:
  - `/Users/oliver/Herd/automatisch/config/drawings.php`
  - `/Users/oliver/Herd/automatisch/.env.example` (`DRAWINGS_MAX_PAYLOAD_BYTES`)

## 2) Database schema

`drawings` table columns used by the API:

- `id` (string, PK, 36, non-incrementing)
- `name` (nullable string, indexed)
- `payload` (LONGBLOB, required)
- `size_bytes` (unsigned big integer)
- `owner_id` (nullable string, indexed)
- `project_id` (nullable string, indexed)
- `encryption_key` (nullable string)
- `created_at`, `updated_at`

Indexes:

- `name`
- `updated_at`
- `owner_id`
- `project_id`
- `(owner_id, updated_at)`
- `(project_id, updated_at)`

## 3) Environment / setup

- Set database connection in `.env`:
  - Use mysql for binary payload compatibility (recommended)
- Install/refresh:
  - `php artisan migrate`
- Optional payload size override:
  - `DRAWINGS_MAX_PAYLOAD_BYTES=1048576` in `.env`
- API routes are already loaded by `bootstrap/app.php` (`api: __DIR__.'/../routes/api.php'`).

## 4) API contract

### 4.1 `POST /api/v2/post` — create/update drawing

This endpoint accepts raw encrypted binary payload and optional metadata for naming and scoping.

- Method: `POST`
- Body:
  - Preferred: raw request body (`ArrayBuffer` / binary), no wrapper object
- Optional:
  - query param: `name`
  - header: `X-Drawing-Name`
  - request input: `name`
  - input: `owner_id`
  - input: `project_id`
  - input/header: `encryption_key`, header `X-Drawing-Key`
- Response:
  - on success: `{ "id": "<string>" }`
- Status codes:
  - `201` when a new row is created
  - `200` when existing drawing row is updated by same `(name, owner_id, project_id)`
  - `400` when payload is missing
  - `413` when payload exceeds `DRAWINGS_MAX_PAYLOAD_BYTES`

Important behavior:

- If `name` is absent, no dedupe occurs.
- If `name` is present, API uses Laravel `updateOrCreate` with key:
  - `{ name, owner_id, project_id }`
- Because `id` is not auto-incrementing, the insert path always supplies `id` explicitly (ULID).
- Empty string metadata is treated as `null`.

Example:

```http
POST /api/v2/post?name=My+Sketch HTTP/1.1
Content-Type: application/octet-stream
X-Drawing-Key: random-key-string

<encrypted payload bytes>
```

### 4.2 `GET /api/v2/{id}` — load drawing payload

- Method: `GET`
- Response:
  - Status `200` with raw binary body and headers:
    - `Content-Type: application/octet-stream`
    - `Content-Length: <size_bytes>`
  - `404` `{ "error_class": "DrawingNotFound", "message": "Drawing not found." }`

### 4.3 `GET /api/v2` — list drawings (for load dialog)

- Method: `GET`
- Query params:
  - `q` optional search in name
  - `owner_id` optional
  - `project_id` optional
  - `cursor` or `page` optional (pagination)
  - `per_page` optional (1..100)
  - `include_encryption_key` optional boolean
- Response:
  - `200` with:
    - `items`: array of `{ id, name, size_bytes, created_at, updated_at, encryption_key? }`
    - `meta`: `{ page, per_page, total, has_more_pages, next_cursor }`

Example:

```http
GET /api/v2?owner_id=123&per_page=25&q=sketch&cursor=2
```

### 4.4 `GET /api/v2/{id}/meta`

- Method: `GET`
- Returns metadata only:
  - `id`, `name`, `size_bytes`, `created_at`, `updated_at`

## 5) Error contract

- `DrawingNotFound` => `404`
- `InvalidRequestError` => `400`
- `RequestTooLargeError` => `413`
- Validation errors (rules in request classes) return Laravel validation payload with `422`.

## 6) Frontend integration (Excalidraw)

In `excaliflow` the backend save/load endpoints are consumed with:

- Set `VITE_APP_FLOW_BACKEND_ORIGIN` to the Laravel origin for the Vite development proxy. The browser uses relative API URLs under its own origin.

`GET` endpoint uses `id` and keeps the encryption key in the frontend URL hash (`#json=<id>,<key>`).

For the load dialog, use:

- `GET /api/v2` to build entries by `name` and `updated_at`
- open selected drawing by calling existing Excalidraw load flow (`#json={id},{key}`)

If you do not persist `encryption_key` server-side, key retention is still local in the frontend mapping.

## 7) Security and production hardening

- The editor and the drawing, project, file and export-write routes require the Excaliflow session and an admin account. The public exports path is described below.
- The private API sends no-store responses and accepts writes only from the configured Flow origin. Keep the Flow routes same-origin in the browser.
- An authenticated editor may open an existing drawing link. External readers can use an explicitly published export.

### Flow login and hosting

The browser checks `GET /api/flow-auth/session` before mounting the editor. On `401` it requests the login URL from `/api/flow-auth/start` and navigates to the main domain. Laravel uses its existing login on the main domain, checks the account's admin permission, and returns a one-minute code to the fixed Flow callback. Only the browser with the matching verifier cookie can redeem the code, once. The separate Flow cookie is HTTPS-only, HttpOnly and scoped to the Flow host. It expires after two hours. Signing out in the editor revokes the Flow session, and the existing main-domain login can sign the user in again.

`APP_URL` is the Laravel login origin, and `FLOW_ORIGIN` is the exact Flow origin with no trailing slash. Production defaults to `https://flow.allesautomatisch.com`; local development defaults to `http://localhost:3001`. `FLOW_CACHE_STORE` defaults to the Laravel database cache and must support atomic locks and be shared across the Laravel instances serving the two hosts. Existing database cache tables are sufficient. In local development, if Node does not trust Herd's certificate, set `NODE_EXTRA_CA_CERTS` to the Herd CA PEM before starting Vite.

Before deploying either application, add the following block to the Flow site's Forge Nginx server config, in addition to its existing public `/exports/` location. It can replace the previous exact `/api/v2/exports` proxy block.

```nginx
location ~ ^/api/(v2|flow-auth)(/|$) {
    client_max_body_size 48m;
    proxy_pass https://allesautomatisch.com;
    proxy_intercept_errors off;
    proxy_redirect off;
    proxy_set_header Host allesautomatisch.com;
    proxy_ssl_server_name on;
    proxy_ssl_name allesautomatisch.com;
    proxy_ssl_verify on;
    proxy_ssl_verify_depth 3;
    proxy_ssl_trusted_certificate /etc/ssl/certs/ca-certificates.crt;
}
```

Validate the Nginx configuration before reloading. Then deploy Laravel and Excaliflow together. In a fresh browser session verify that Flow goes to the main-domain login and returns to the original Flow URL. Verify the private API returns `401` anonymously on both hosts and a published SVG opens in a private window. The editor build and Laravel API must stay in sync.

## Public exports (PNG, SVG, Excalidraw, Markdown)

`POST /api/v2/exports` requires a Flow session and accepts multipart `name` (max 128 characters) and one to four `files[png]`, `files[svg]`, `files[excalidraw]`, `files[md]` uploads. It returns HTTP 201 with `{ uuid, exports: [{ format, fileName, url, sizeBytes }] }`. All files in one request share the server-generated `YYYY-MM-DD-name-slug-UUID` stem. `url` is `/exports/<fileName>`, relative to the Flow origin. A new request generates a new UUID; existing publications remain unchanged. No database migration is required.

`GET /exports/{fileName}` is public and serves the stored bytes with the correct MIME type. The controller restricts filenames and formats, validates file content, bounds payloads, removes partially stored batches on storage failure, and returns CSP/nosniff headers for inline SVG rendering. The default disk is Laravel's local disk, under `exports`; this is public through the controller, not through the encrypted drawing-file API. Files have no automatic expiry.

Configuration in the Laravel backend: `DRAWINGS_EXPORTS_DISK` (default `local`), `DRAWINGS_EXPORTS_PATH` (default `exports`), `DRAWINGS_EXPORTS_MAX_PAYLOAD_BYTES` (default 20 MiB/file), `DRAWINGS_EXPORTS_MAX_BATCH_BYTES` (default 40 MiB/request). PHP `upload_max_filesize` and `post_max_size` and the hosting proxy's request limit must permit the intended sizes; use at least 20M/file and 48M/request for the defaults. Preserve the configured storage disk across releases.

Excaliflow sends uploads to its own origin and converts the relative response URLs to that origin. In addition to the private API proxy above, keep the public retrieval route below before the SPA fallback. Vite, the Docker Nginx template and Vercel already route both.

```nginx
location ^~ /exports/ {
    proxy_pass https://allesautomatisch.com;
    proxy_set_header Host allesautomatisch.com;
    proxy_ssl_server_name on;
    proxy_ssl_name allesautomatisch.com;
    proxy_ssl_verify on;
    proxy_ssl_verify_depth 3;
    proxy_ssl_trusted_certificate /etc/ssl/certs/ca-certificates.crt;
}
```

The public export deployment was completed on 2026-10-01. All four formats were published and retrieved at `https://flow.allesautomatisch.com/exports/YYYY-MM-DD-name-UUID.ext`. The PWA navigation fallback excludes `/exports/` and `/api/`, and the Laravel Markdown URL middleware preserves actual export filenames while retaining page `.md` variants.

## Stable PNG and SVG flow URLs

`/<drawing-slug>.png` and `/<drawing-slug>.svg` are public, lazy-rendered images of the last backend drawing. Requests proxy to `GET /api/v2/flow-images/{slug}.{format}`. A cache miss uses the same browser exporter as the image dialog, including attached images and saved background, dark mode, embedded-scene and scale preferences. It exports the whole drawing. Existing drawings without saved preferences use exporter defaults until their next backend save. The server cache defaults to Laravel's private local disk at `storage/app/private/drawings/image-cache/<drawing-id>.png` and `.svg`.

Only the Save to Flow backend button requests `DELETE /api/v2/drawings/{drawing}/image-cache` after all uploads succeed. JSON `revision` is the SHA-256 of the encrypted payload; a superseded save returns 409. This deletes both images under the renderer's lock. Local saves, manual server exports, share-link creation and unsaved edits do not invalidate them. Image responses use `Cache-Control: no-store`, so a browser or CDN cannot retain an older image after invalidation. Existing dated `/exports/` links keep their immutable behavior.

### Forge host addition

Add these locations to the **Flow frontend** server block alongside the existing API and `/exports/` proxies (replace the upstream with your existing Laravel upstream). Insert this before any general static-image regex location. Static files such as `favicon.svg` retain precedence:

```nginx
location ~ ^/[a-z0-9]+(-[a-z0-9]+)*\.(png|svg)$ {
    try_files $uri @flow_image;
}

location @flow_image {
    rewrite ^/(.*)$ /api/v2/flow-images/$1 break;
    proxy_pass https://allesautomatisch.com;
    proxy_intercept_errors off;
    proxy_set_header Host $proxy_host;
    proxy_ssl_server_name on;
    proxy_ssl_verify_depth 3;
    proxy_ssl_verify on;
    proxy_ssl_trusted_certificate /etc/ssl/certs/ca-certificates.crt;
    proxy_read_timeout 110s;
}
```

Vite, Docker Nginx and Vercel routing are included in this repository. The PWA navigation fallback excludes root image URLs and the standalone renderer page. Deploy the matching frontend and Laravel change together. The backend needs production Node dependencies (`npm ci --omit=dev`) and Chromium installed for the PHP/deploy user (`npx playwright install chromium`; Linux system libraries via `npx playwright install-deps chromium`). Set `DRAWINGS_IMAGE_NODE_BINARY` if PHP needs an absolute Node path, and ensure the browser can reach `FLOW_ORIGIN/flow-render.html` and its assets. Full backend deployment notes are in `automatisch/resources/docs/flow-images.md`.
