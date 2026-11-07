<?php
/**
 * Same-origin API entry point.
 *
 * The frontend is served from the document root and calls /api/*. The SPA
 * .htaccess routes those requests here; this shim boots the real backend
 * front controller. Running from api.php keeps SCRIPT_NAME at the root, so
 * request_uri_path() leaves the /api/... path intact for the router.
 */

declare(strict_types=1);

require __DIR__ . '/backend/public/index.php';
