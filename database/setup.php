<?php
/**
 * One-shot database installer for local development / shared hosting.
 *
 *   php database/setup.php          (schema only, safe for production)
 *   php database/setup.php --seed   (schema + demo data, development only)
 *
 * CLI only: this file is never executable over the web.
 * Reads credentials from backend/.env
 */

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('Forbidden');
}

require __DIR__ . '/../backend/config/config.php';
$config = app_config();
$db = $config['db'];

$withSeed = in_array('--seed', $argv, true);

$mysqli = new mysqli($db['host'], $db['user'], $db['pass'], '', (int) $db['port']);
if ($mysqli->connect_errno) {
    fwrite(STDERR, "Connection failed: {$mysqli->connect_error}\n");
    exit(1);
}

if (!$mysqli->query("CREATE DATABASE IF NOT EXISTS `{$db['name']}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")) {
    fwrite(STDERR, "Create database failed: {$mysqli->error}\n");
    exit(1);
}
$mysqli->select_db($db['name']);
$mysqli->set_charset('utf8mb4');

$files = ['schema.sql'];
if ($withSeed) {
    $files[] = 'seed.sql';
}

foreach ($files as $file) {
    $path = __DIR__ . '/' . $file;
    $sql = file_get_contents($path);
    if ($sql === false) {
        fwrite(STDERR, "Cannot read $path\n");
        exit(1);
    }
    if (!$mysqli->multi_query($sql)) {
        fwrite(STDERR, "Error running $file: {$mysqli->error}\n");
        exit(1);
    }
    // drain all result sets
    while ($mysqli->more_results()) {
        if (!$mysqli->next_result()) {
            fwrite(STDERR, "Error in $file: {$mysqli->error}\n");
            exit(1);
        }
    }
    echo "Applied $file\n";
}

echo "Database '{$db['name']}' is ready";
echo $withSeed ? " (with demo data).\n" : " (schema only).\n";
if ($withSeed) {
    echo "\nDemo accounts (development only — change before real use):\n";
    echo "  doctor  / Doctor@123\n  cashier / Cashier@123\n";
}
