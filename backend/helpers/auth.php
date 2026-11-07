<?php
/**
 * Authentication + role based access control.
 * Opaque bearer tokens (random 32 bytes), stored as SHA-256 hashes.
 * No cookies are used, so classic CSRF does not apply; every
 * protected endpoint still verifies authentication and role server-side.
 */

declare(strict_types=1);

function current_user(): ?array
{
    static $resolved = false;
    static $user = null;

    if ($resolved) {
        return $user;
    }
    $resolved = true;

    $token = bearer_token();
    if ($token === null) {
        return null;
    }

    $hash = hash('sha256', $token);
    $stmt = db()->prepare(
        'SELECT u.id, u.name, u.username, u.role, u.status, u.last_login_at,
                t.id AS token_id, t.expires_at
           FROM auth_tokens t
           JOIN users u ON u.id = t.user_id
          WHERE t.token_hash = ? AND t.expires_at > NOW()
          LIMIT 1'
    );
    $stmt->execute([$hash]);
    $row = $stmt->fetch();

    if (!$row || $row['status'] !== 'active') {
        return null;
    }

    // touch last_used_at at most once per request
    db()->prepare('UPDATE auth_tokens SET last_used_at = NOW() WHERE id = ?')->execute([$row['token_id']]);

    $user = [
        'id'         => (int) $row['id'],
        'name'       => $row['name'],
        'username'   => $row['username'],
        'role'       => $row['role'],
        'status'     => $row['status'],
        'last_login' => $row['last_login_at'],
    ];
    return $user;
}

function require_login(): array
{
    $user = current_user();
    if ($user === null) {
        json_err('Your session has expired. Please sign in again.', 401);
    }
    return $user;
}

function require_role(string $role): array
{
    $user = require_login();
    if ($user['role'] !== $role) {
        json_err('You are not authorised to perform this action.', 403);
    }
    return $user;
}

/**
 * Route-level guard used by the router.
 */
function guard(string $role): void
{
    if ($role === 'public') {
        return;
    }
    $user = require_login();
    if ($role === 'auth') {
        return;
    }
    if ($user['role'] !== $role) {
        json_err('You are not authorised to perform this action.', 403);
    }
}

function issue_token(int $userId): array
{
    $config = require __DIR__ . '/../config/config.php';
    $ttl = max(5, (int) $config['auth']['ttl_minutes']);
    $plain = bin2hex(random_bytes(32));
    $hash = hash('sha256', $plain);

    $stmt = db()->prepare(
        'INSERT INTO auth_tokens (user_id, token_hash, ip_address, user_agent, expires_at)
         VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))'
    );
    $stmt->execute([$userId, $hash, client_ip(), client_agent(), $ttl]);

    return [
        'token'      => $plain,
        'expires_at' => date('c', strtotime('+' . $ttl . ' minutes')),
    ];
}

function revoke_current_token(): void
{
    $token = bearer_token();
    if ($token === null) {
        return;
    }
    db()->prepare('DELETE FROM auth_tokens WHERE token_hash = ?')->execute([hash('sha256', $token)]);
}

/**
 * Login throttling. Reuses the append-only audit log so no extra
 * table is required: counts recent LOGIN_FAILED rows for the IP.
 */
function login_is_locked(string $username): bool
{
    $config = require __DIR__ . '/../config/config.php';
    $max = (int) $config['security']['login_max_attempts'];
    $minutes = (int) $config['security']['login_lockout_min'];

    $stmt = db()->prepare(
        "SELECT COUNT(*) FROM audit_logs
          WHERE action = 'LOGIN_FAILED' AND ip_address = ?
            AND created_at > DATE_SUB(NOW(), INTERVAL ? MINUTE)"
    );
    $stmt->execute([client_ip(), $minutes]);
    $failures = (int) $stmt->fetchColumn();

    // also cap per-username failures regardless of IP
    $stmt = db()->prepare(
        "SELECT COUNT(*) FROM audit_logs
          WHERE action = 'LOGIN_FAILED'
            AND JSON_UNQUOTE(JSON_EXTRACT(new_values, '$.username')) = ?
            AND created_at > DATE_SUB(NOW(), INTERVAL ? MINUTE)"
    );
    $stmt->execute([$username, $minutes]);
    $userFailures = (int) $stmt->fetchColumn();

    return $failures >= $max || $userFailures >= $max;
}
