<?php
/**
 * Auth endpoints.
 */

declare(strict_types=1);

function auth_login(): void
{
    $username = v_str('username', 'Username', 1, 60);
    $password = (string) input('password', '');

    if ($password === '') {
        json_err('Password is required.', 422, ['password' => 'Password is required.']);
    }

    if (login_is_locked($username)) {
        json_err('Too many failed sign-in attempts. Please wait a few minutes and try again.', 429);
    }

    $stmt = db()->prepare('SELECT id, name, username, password_hash, role, status FROM users WHERE username = ? LIMIT 1');
    $stmt->execute([$username]);
    $user = $stmt->fetch();

    // constant-ish time: always run a verify
    $hash = $user['password_hash'] ?? '$2y$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv';
    $valid = password_verify($password, $hash);

    if (!$user || !$valid) {
        audit('LOGIN_FAILED', 'user', null, null, ['username' => $username], null);
        json_err('Invalid username or password.', 401);
    }

    if ($user['status'] !== 'active') {
        audit('LOGIN_BLOCKED', 'user', (int) $user['id'], null, ['reason' => 'inactive'], null);
        json_err('This account is inactive. Please contact the clinic administrator.', 403);
    }

    db()->prepare('UPDATE users SET last_login_at = NOW() WHERE id = ?')->execute([$user['id']]);
    $token = issue_token((int) $user['id']);

    audit('LOGIN', 'user', (int) $user['id'], null, ['username' => $user['username'], 'role' => $user['role']], (int) $user['id']);

    json_ok([
        'token'      => $token['token'],
        'expires_at' => $token['expires_at'],
        'user'       => [
            'id'       => (int) $user['id'],
            'name'     => $user['name'],
            'username' => $user['username'],
            'role'     => $user['role'],
        ],
    ], 'Signed in successfully.');
}

function auth_logout(): void
{
    $user = require_login();
    audit('LOGOUT', 'user', $user['id']);
    revoke_current_token();
    json_ok(null, 'Signed out.');
}

function auth_me(): void
{
    $user = require_login();
    json_ok([
        'user'     => $user,
        'settings' => clinic_settings(),
    ]);
}

function auth_change_password(): void
{
    $user = require_login();
    $current = (string) input('current_password', '');
    $new = (string) input('new_password', '');

    if (strlen($new) < 8) {
        json_err('New password must be at least 8 characters.', 422, ['new_password' => 'Use at least 8 characters.']);
    }

    $stmt = db()->prepare('SELECT password_hash FROM users WHERE id = ?');
    $stmt->execute([$user['id']]);
    $hash = (string) $stmt->fetchColumn();

    if (!password_verify($current, $hash)) {
        json_err('Your current password is incorrect.', 422, ['current_password' => 'Incorrect password.']);
    }

    db()->prepare('UPDATE users SET password_hash = ? WHERE id = ?')
        ->execute([password_hash($new, PASSWORD_BCRYPT), $user['id']]);

    // invalidate all other sessions for this user
    $token = bearer_token();
    db()->prepare('DELETE FROM auth_tokens WHERE user_id = ? AND token_hash <> ?')
        ->execute([$user['id'], hash('sha256', (string) $token)]);

    audit('PASSWORD_CHANGED', 'user', (int) $user['id']);
    json_ok(null, 'Password updated.');
}
