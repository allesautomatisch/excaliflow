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

- `VITE_APP_BACKEND_V2_POST_URL`
- `VITE_APP_BACKEND_V2_GET_URL`

`GET` endpoint uses `id` and keeps the encryption key in the frontend URL hash (`#json=<id>,<key>`).

For the load dialog, use:

- `GET /api/v2` to build entries by `name` and `updated_at`
- open selected drawing by calling existing Excalidraw load flow (`#json={id},{key}`)

If you do not persist `encryption_key` server-side, key retention is still local in the frontend mapping.

## 7) Security and production hardening

- Current API has no auth in this implementation.
- For multi-user systems, use `owner_id` checks against auth context and add middleware.
- If exposing `encryption_key`, gate it:
  - only include via `include_encryption_key=true` for trusted clients
- Configure rate limiting and CSRF/CORS policy according to your deployment topology.
- Keep payload size and row retention policies reviewed, especially for large drawings.

## Public exports (PNG, SVG, Excalidraw, Markdown)

`POST /api/v2/exports` accepts multipart `name` (max 128 characters) and one to four `files[png]`, `files[svg]`, `files[excalidraw]`, `files[md]` uploads. It returns HTTP 201 with `{ uuid, exports: [{ format, fileName, url, sizeBytes }] }`. All files in one request share the server-generated `YYYY-MM-DD-name-slug-UUID` stem. `url` is `/exports/<fileName>`, relative to the Flow origin. A new request generates a new UUID; existing publications remain unchanged. No database migration is required.

`GET /exports/{fileName}` is public and serves the stored bytes with the correct MIME type. The controller restricts filenames and formats, validates file content, bounds payloads, removes partially stored batches on storage failure, and returns CSP/nosniff headers for inline SVG rendering. The default disk is Laravel's local disk, under `exports`; this is public through the controller, not through the encrypted drawing-file API. Files have no automatic expiry.

Configuration in the Laravel backend: `DRAWINGS_EXPORTS_DISK` (default `local`), `DRAWINGS_EXPORTS_PATH` (default `exports`), `DRAWINGS_EXPORTS_MAX_PAYLOAD_BYTES` (default 20 MiB/file), `DRAWINGS_EXPORTS_MAX_BATCH_BYTES` (default 40 MiB/request). PHP `upload_max_filesize` and `post_max_size` and the hosting proxy's request limit must permit the intended sizes; use at least 20M/file and 48M/request for the defaults. Preserve the configured storage disk across releases.

Excaliflow sends uploads to its own origin and converts the relative response URLs to that origin. Vite proxies the upload and retrieval paths to the existing configured development backend. The repository Docker image includes `excalidraw-app/hosting/default.conf.template`, defaulting `FLOW_EXPORT_BACKEND` to `https://allesautomatisch.com` (an HTTPS origin without a trailing slash, with upstream certificate verification); Vercel rewrites cover the same routes. A production host using another serving setup must proxy both paths to the Laravel host before its SPA/static-file fallback. Example inside that host's Nginx server block (adapt upstream to the actual deployment):

```nginx
location = /api/v2/exports {
    client_max_body_size 48m;
    proxy_pass https://allesautomatisch.com;
    proxy_set_header Host allesautomatisch.com;
    proxy_ssl_server_name on;
}
location ^~ /exports/ {
    proxy_pass https://allesautomatisch.com;
    proxy_set_header Host allesautomatisch.com;
    proxy_ssl_server_name on;
}
```

Deploy the Laravel controller/routes/config and Excaliflow build together, then apply the Flow host routing. In production the returned addresses will be `https://flow.allesautomatisch.com/exports/YYYY-MM-DD-name-UUID.ext`. The repository hosting configuration is prepared; it has not been deployed to production from this local workspace.
