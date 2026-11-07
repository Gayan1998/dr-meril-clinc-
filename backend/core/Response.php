<?php
/**
 * Consistent JSON responses + CORS + security headers.
 */

declare(strict_types=1);

function apply_cors(): void
{
    $config = require __DIR__ . '/../config/config.php';
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    $allowed = $config['cors'];

    if ($origin !== '' && (in_array($origin, $allowed, true) || in_array('*', $allowed, true))) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
        header('Access-Control-Allow-Credentials: false');
    }
    header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
    header('Access-Control-Max-Age: 86400');
}

function security_headers(): void
{
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: no-referrer');
    header('Cache-Control: no-store, no-cache, must-revalidate');
    header('Pragma: no-cache');
    if (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') {
        header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
    }
}

function json_ok(mixed $data = null, string $message = 'OK', int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'success' => true,
        'message' => $message,
        'data'    => $data,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function json_err(string $message, int $status = 400, array $errors = []): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    $payload = [
        'success' => false,
        'message' => $message,
    ];
    if ($errors !== []) {
        $payload['errors'] = $errors;
    }
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/**
 * Central uncaught-exception handler. Never leaks SQL / paths in production.
 */
function register_error_handlers(bool $debug): void
{
    set_exception_handler(function (Throwable $e) use ($debug): void {
        error_log('[uncaught] ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
        $message = 'Something went wrong. Please try again.';
        if ($debug) {
            $message = $e->getMessage();
        }
        json_err($message, 500);
    });

    set_error_handler(function (int $severity, string $message, string $file, int $line): bool {
        if (!(error_reporting() & $severity)) {
            return false;
        }
        throw new ErrorException($message, 0, $severity, $file, $line);
    });
}
