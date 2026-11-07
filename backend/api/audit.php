<?php
/**
 * Audit log read endpoint (doctor only). Audit records are append-only;
 * there is deliberately no create/update/delete endpoint here.
 */

declare(strict_types=1);

function audit_index(): void
{
    require_role('doctor');
    $date = query_str('date');
    $action = query_str('action', '');
    $userId = query_str('user_id', '');
    $p = pagination(50);

    $where = [];
    $params = [];
    if ($date !== null && $date !== '') {
        $where[] = 'DATE(a.created_at) = ?';
        $params[] = valid_date_or_today($date);
    }
    if ($action !== null && $action !== '') {
        $where[] = 'a.action = ?';
        $params[] = $action;
    }
    if ($userId !== null && $userId !== '' && ctype_digit($userId)) {
        $where[] = 'a.user_id = ?';
        $params[] = (int) $userId;
    }
    $whereSql = $where ? 'WHERE ' . implode(' AND ', $where) : '';

    $countStmt = db()->prepare("SELECT COUNT(*) FROM audit_logs a $whereSql");
    $countStmt->execute($params);
    $total = (int) $countStmt->fetchColumn();

    $stmt = db()->prepare(
        "SELECT a.id, a.user_id, a.action, a.entity_type, a.entity_id, a.old_values, a.new_values,
                a.ip_address, a.created_at, u.name AS user_name, u.role AS user_role
           FROM audit_logs a
           LEFT JOIN users u ON u.id = a.user_id
          $whereSql
          ORDER BY a.id DESC
          LIMIT {$p['per_page']} OFFSET {$p['offset']}"
    );
    $stmt->execute($params);

    $items = array_map(static function (array $r): array {
        return [
            'id'          => (int) $r['id'],
            'user_id'     => $r['user_id'] !== null ? (int) $r['user_id'] : null,
            'user_name'   => $r['user_name'] ?? 'System',
            'user_role'   => $r['user_role'] ?? null,
            'action'      => $r['action'],
            'entity_type' => $r['entity_type'],
            'entity_id'   => $r['entity_id'] !== null ? (int) $r['entity_id'] : null,
            'old_values'  => $r['old_values'] ? json_decode($r['old_values'], true) : null,
            'new_values'  => $r['new_values'] ? json_decode($r['new_values'], true) : null,
            'ip_address'  => $r['ip_address'],
            'created_at'  => $r['created_at'],
        ];
    }, $stmt->fetchAll());

    json_ok([
        'items'    => $items,
        'total'    => $total,
        'page'     => $p['page'],
        'per_page' => $p['per_page'],
    ]);
}

function audit_actions(): void
{
    require_role('doctor');
    $rows = db()->query('SELECT DISTINCT action FROM audit_logs ORDER BY action')->fetchAll(PDO::FETCH_COLUMN);
    json_ok(['actions' => $rows]);
}
