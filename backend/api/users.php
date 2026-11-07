<?php
/**
 * User management. Doctor (admin) only.
 * A cashier can never reach these endpoints, so they cannot promote
 * themselves or create accounts.
 */

declare(strict_types=1);

function users_index(): void
{
    require_role('doctor');
    $stmt = db()->query(
        'SELECT id, name, username, role, status, last_login_at, created_at
           FROM users ORDER BY role ASC, id ASC'
    );
    $items = array_map(static fn (array $r): array => [
        'id'            => (int) $r['id'],
        'name'          => $r['name'],
        'username'      => $r['username'],
        'role'          => $r['role'],
        'status'        => $r['status'],
        'last_login_at' => $r['last_login_at'],
        'created_at'    => $r['created_at'],
    ], $stmt->fetchAll());
    json_ok(['items' => $items]);
}

function users_store(): void
{
    $admin = require_role('doctor');

    $name = v_str('name', 'Full name', 2, 120);
    $username = v_str('username', 'Username', 3, 60);
    if (!preg_match('/^[a-zA-Z0-9._-]+$/', $username)) {
        json_err('Username may only contain letters, numbers, dots, underscores and hyphens.', 422, ['username' => 'Invalid username format.']);
    }
    $password = (string) input('password', '');
    if (strlen($password) < 8) {
        json_err('Password must be at least 8 characters.', 422, ['password' => 'Use at least 8 characters.']);
    }
    $role = v_enum('role', ['doctor', 'cashier'], 'Role');

    $exists = db()->prepare('SELECT COUNT(*) FROM users WHERE username = ?');
    $exists->execute([$username]);
    if ((int) $exists->fetchColumn() > 0) {
        json_err('That username is already taken.', 409, ['username' => 'Username already exists.']);
    }

    $stmt = db()->prepare('INSERT INTO users (name, username, password_hash, role, status) VALUES (?, ?, ?, ?, "active")');
    $stmt->execute([$name, $username, password_hash($password, PASSWORD_BCRYPT), $role]);
    $id = (int) db()->lastInsertId();

    audit('USER_CREATED', 'user', $id, null, ['name' => $name, 'username' => $username, 'role' => $role], $admin['id']);

    json_ok([
        'id'       => $id,
        'name'     => $name,
        'username' => $username,
        'role'     => $role,
        'status'   => 'active',
    ], 'User account created.', 201);
}

function users_update_status(string $id): void
{
    $admin = require_role('doctor');
    $userId = (int) $id;
    $status = v_enum('status', ['active', 'inactive'], 'Status');

    if ($userId === (int) $admin['id']) {
        json_err('You cannot change your own account status.', 409);
    }

    $stmt = db()->prepare('SELECT id, name, role, status FROM users WHERE id = ? LIMIT 1');
    $stmt->execute([$userId]);
    $target = $stmt->fetch();
    if (!$target) {
        json_err('User not found.', 404);
    }

    if ($status === 'inactive' && $target['role'] === 'doctor') {
        $activeDoctors = (int) db()->query("SELECT COUNT(*) FROM users WHERE role = 'doctor' AND status = 'active'")->fetchColumn();
        if ($activeDoctors <= 1) {
            json_err('At least one active doctor account must remain.', 409);
        }
    }

    db()->prepare('UPDATE users SET status = ? WHERE id = ?')->execute([$status, $userId]);
    // revoke sessions when deactivating
    if ($status === 'inactive') {
        db()->prepare('DELETE FROM auth_tokens WHERE user_id = ?')->execute([$userId]);
    }

    audit($status === 'active' ? 'USER_ACTIVATED' : 'USER_DEACTIVATED', 'user', $userId, ['status' => $target['status']], ['status' => $status], $admin['id']);

    json_ok(['id' => $userId, 'status' => $status], 'User status updated.');
}

function users_reset_password(string $id): void
{
    $admin = require_role('doctor');
    $userId = (int) $id;
    $password = (string) input('password', '');
    if (strlen($password) < 8) {
        json_err('Password must be at least 8 characters.', 422, ['password' => 'Use at least 8 characters.']);
    }

    $exists = db()->prepare('SELECT COUNT(*) FROM users WHERE id = ?');
    $exists->execute([$userId]);
    if ((int) $exists->fetchColumn() === 0) {
        json_err('User not found.', 404);
    }

    db()->prepare('UPDATE users SET password_hash = ? WHERE id = ?')->execute([password_hash($password, PASSWORD_BCRYPT), $userId]);
    db()->prepare('DELETE FROM auth_tokens WHERE user_id = ?')->execute([$userId]);

    audit('PASSWORD_RESET', 'user', $userId, null, null, $admin['id']);
    json_ok(null, 'Password reset. The user will need to sign in again.');
}
