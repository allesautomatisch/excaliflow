<?php

return [
    // Match Excalidraw default request sizes unless you decide to allow bigger scenes.
    // Keep this aligned with your frontend/post-proxy limits.
    'max_payload_bytes' => (int) env('EXCALIDRAW_MAX_PAYLOAD_BYTES', 4 * 1024 * 1024),
];
