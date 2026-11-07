<?php
/**
 * Create a user account from the command line.
 *
 * A fresh production database has no users (seed.sql is demo-only), so this
 * is how you bootstrap the first doctor account.
 *
 *   php database/create_user.php "Dr. Name" doctor "StrongPass123"
 *   php database/create_user.php "Front Desk" cashier "StrongPass123"
 *
 * CLI only: never executable over the web.
 */

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('Forbidden');
}

require __DIR__ . '/../backend/config/database.php';

$name = $argv[1] ?? '';
$username = $argv[2] ?? '';
$password = $argv[3] ?? '';
$role = $argv[4] ?? 'doctor';

if ($name === '' || $username === '' || $password === '') {
    fwrite(STDERR, "Usage: php database/create_user.php \"Full Name\" username password [doctor|cashier]\n");
    exit(1);
}
if (!in_array($role, ['doctor', 'cashier'], true)) {
    fwrite(STDERR, "Role must be 'doctor' or 'cashier'.\n");
    exit(1);
}
if (strlen($password) < 8) {
    fwrite(STDERR, "Password must be at least 8 characters.\n");
    exit(1);
}
if (!preg_match('/^[a-zA-Z0-9._-]+$/', $username)) {
    fwrite(STDERR, "Username may only contain letters, numbers, dots, underscores and hyphens.\n");
    exit(1);
}

$exists = db()->prepare('SELECT COUNT(*) FROM users WHERE username = ?');
$exists->execute([$username]);
if ((int) $exists->fetchColumn() > 0) {
    fwrite(STDERR, "That username already exists.\n");
    exit(1);
}

$stmt = db()->prepare(
    'INSERT INTO users (name, username, password_hash, role, status) VALUES (?, ?, ?, ?, "active")'
);
$stmt->execute([$name, $username, password_hash($password, PASSWORD_BCRYPT), $role]);

fwrite(STDOUT, "Created {$role} account '{$username}'. Sign in and change the password.\n");
