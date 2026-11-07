<?php
/**
 * Append-only audit logging. Records are never updated or deleted
 * by the application.
 */

declare(strict_types=1);

function audit(
    string $action,
    ?string $entityType = null,
    ?int $entityId = null,
    ?array $oldValues = null,
    ?array $newValues = null,
    ?int $userId = null
): void {
    if ($userId === null) {
        $user = current_user();
        $userId = $user['id'] ?? null;
    }

    $stmt = db()->prepare(
        'INSERT INTO audit_logs
            (user_id, action, entity_type, entity_id, old_values, new_values, ip_address, user_agent)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        $userId,
        $action,
        $entityType,
        $entityId,
        $oldValues === null ? null : json_encode($oldValues, JSON_UNESCAPED_UNICODE),
        $newValues === null ? null : json_encode($newValues, JSON_UNESCAPED_UNICODE),
        client_ip(),
        client_agent(),
    ]);
}
