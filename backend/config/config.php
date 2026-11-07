<?php
/**
 * Environment + application configuration.
 * Never hardcode credentials here; values come from backend/.env
 *
 * Safe to require more than once: it always returns the same config array.
 */

declare(strict_types=1);

if (!function_exists('load_env')) {
    function load_env(string $path): void
    {
        if (!is_file($path)) {
            return;
        }
        foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
            $line = trim($line);
            if ($line === '' || $line[0] === '#' || !str_contains($line, '=')) {
                continue;
            }
            [$key, $value] = explode('=', $line, 2);
            $key = trim($key);
            $value = trim($value);
            if (strlen($value) >= 2) {
                $first = $value[0];
                if (($first === '"' || $first === "'") && $value[strlen($value) - 1] === $first) {
                    $value = substr($value, 1, -1);
                }
            }
            if (getenv($key) === false) {
                putenv("$key=$value");
                $_ENV[$key] = $value;
            }
        }
    }
}

if (!function_exists('env')) {
    function env(string $key, mixed $default = null): mixed
    {
        $value = getenv($key);
        if ($value === false || $value === '') {
            return $default;
        }
        return match (strtolower((string) $value)) {
            'true', '(true)'   => true,
            'false', '(false)' => false,
            'null'             => null,
            default            => $value,
        };
    }
}

if (!function_exists('app_config')) {
    function app_config(): array
    {
        static $config = null;
        if ($config !== null) {
            return $config;
        }

        load_env(dirname(__DIR__) . '/.env');
        date_default_timezone_set((string) env('APP_TIMEZONE', 'Asia/Colombo'));

        $config = [
            'env'      => env('APP_ENV', 'production'),
            'debug'    => (bool) env('APP_DEBUG', false),
            'timezone' => env('APP_TIMEZONE', 'Asia/Colombo'),
            'app_url'  => env('APP_URL', ''),
            'cors'     => array_filter(array_map('trim', explode(',', (string) env('CORS_ALLOWED_ORIGINS', '')))),
            'db'       => [
                'host'    => env('DB_HOST', '127.0.0.1'),
                'port'    => (int) env('DB_PORT', 3306),
                'name'    => env('DB_NAME', 'dr_meril_clinic'),
                'user'    => env('DB_USER', 'root'),
                'pass'    => (string) env('DB_PASS', ''),
                'charset' => 'utf8mb4',
            ],
            'auth'     => [
                'ttl_minutes' => (int) env('AUTH_TOKEN_TTL_MINUTES', 720),
            ],
            'security' => [
                'login_max_attempts' => (int) env('LOGIN_MAX_ATTEMPTS', 8),
                'login_lockout_min'  => (int) env('LOGIN_LOCKOUT_MINUTES', 10),
            ],
        ];

        return $config;
    }
}

return app_config();
