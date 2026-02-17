<?php

namespace App\Http\Controllers\Api;

use App\Models\Drawing;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class DrawingController
{
    public function store(Request $request): JsonResponse
    {
        $maxBytes = (int) config('drawings.max_payload_bytes', 4 * 1024 * 1024);

        $payload = null;

        if ($request->hasFile('payload')) {
            $payload = $request->file('payload')->get();
        } elseif ($request->hasFile('file')) {
            $payload = $request->file('file')->get();
        } else {
            $payload = $request->getContent();
        }

        $size = is_string($payload) ? strlen($payload) : 0;

        if ($size === 0) {
            return response()->json([
                'error_class' => 'InvalidRequestError',
                'message' => 'Payload is required.',
            ], 400);
        }

        if ($size > $maxBytes) {
            return response()->json([
                'error_class' => 'RequestTooLargeError',
                'message' => 'Uploaded drawing payload is too large.',
            ], 413);
        }

        $name = $this->getMetaValue($request, 'name');
        $name = $name === null || trim((string) $name) === '' ? null : mb_substr(trim((string) $name), 0, 255);

        $encryptionKey = $this->getMetaValue($request, 'encryption_key');
        if ($encryptionKey === null || trim((string) $encryptionKey) === '') {
            $encryptionKey = $this->getMetaValue($request, 'key');
        }
        $encryptionKey = $encryptionKey === null || trim((string) $encryptionKey) === '' ? null : trim((string) $encryptionKey);

        $ownerId = $this->getMetaValue($request, 'owner_id');
        $projectId = $this->getMetaValue($request, 'project_id');

        $id = (string) Str::ulid();

        $drawing = new Drawing([
            'id' => $id,
            'name' => $name,
            'payload' => $payload,
            'size_bytes' => $size,
            'owner_id' => $ownerId,
            'project_id' => $projectId,
            'encryption_key' => $encryptionKey,
        ]);

        $drawing->save();

        return response()->json(['id' => $id], 201);
    }

    public function show(string $id): Response
    {
        $drawing = Drawing::query()->find($id);

        if (!$drawing) {
            return response()->json([
                'error_class' => 'DrawingNotFound',
                'message' => 'Drawing not found.',
            ], 404);
        }

        return response($drawing->payload, 200)
            ->header('Content-Type', 'application/octet-stream')
            ->header('Content-Length', (string) $drawing->size_bytes);
    }

    public function index(Request $request): JsonResponse
    {
        $perPage = (int) $request->query('per_page', 25);
        $perPage = max(1, min(100, $perPage));

        // Cursor support kept for client compatibility.
        $cursorPage = $request->query('cursor');
        $page = (int) $request->query('page', $cursorPage ?? 1);
        $page = max(1, $page);

        $query = Drawing::query()
            ->select('id', 'name', 'size_bytes', 'owner_id', 'project_id', 'created_at', 'updated_at');

        $q = trim((string) $request->query('q', ''));
        if ($q !== '') {
            $query->where('name', 'like', "%{$q}%");
        }

        if ($request->filled('owner_id')) {
            $query->where('owner_id', $request->query('owner_id'));
        }

        if ($request->filled('project_id')) {
            $query->where('project_id', $request->query('project_id'));
        }

        $query->orderByDesc('updated_at');

        $pageData = $query->paginate($perPage, ['*'], 'page', $page);

        $items = $pageData->through(function (Drawing $drawing): array {
            return [
                'id' => $drawing->id,
                'name' => $drawing->name,
                'size_bytes' => $drawing->size_bytes,
                'created_at' => optional($drawing->created_at)->toIso8601String(),
                'updated_at' => optional($drawing->updated_at)->toIso8601String(),
            ];
        })->items();

        return response()->json([
            'items' => $items,
            'meta' => [
                'page' => $pageData->currentPage(),
                'per_page' => $pageData->perPage(),
                'total' => $pageData->total(),
                'has_more_pages' => $pageData->hasMorePages(),
                'next_cursor' => $pageData->hasMorePages() ? (string) ($pageData->currentPage() + 1) : null,
            ],
        ]);
    }

    public function showWithKey(string $id, Request $request): JsonResponse
    {
        $includeKey = filter_var((string) $request->query('include_encryption_key', false), FILTER_VALIDATE_BOOLEAN);

        if (!$includeKey) {
            return response()->json([
                'error_class' => 'Unauthorized',
                'message' => 'Missing include_encryption_key=1 query parameter.',
            ], 400);
        }

        $drawing = Drawing::query()->find($id);

        if (!$drawing) {
            return response()->json([
                'error_class' => 'DrawingNotFound',
                'message' => 'Drawing not found.',
            ], 404);
        }

        return response()->json([
            'id' => $drawing->id,
            'name' => $drawing->name,
            'encryption_key' => $drawing->encryption_key,
            'size_bytes' => $drawing->size_bytes,
            'created_at' => optional($drawing->created_at)->toIso8601String(),
            'updated_at' => optional($drawing->updated_at)->toIso8601String(),
        ]);
    }
}
