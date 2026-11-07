<?php
/**
 * Reports + shared daily aggregation.
 *
 * All official totals are computed here, in SQL, from the database.
 * The frontend only ever displays these numbers.
 */

declare(strict_types=1);

/**
 * @param int|null $collectorId when set, payment totals are scoped to that cashier
 */
function daily_summary(string $date, ?int $collectorId = null): array
{
    $pdo = db();

    // Visit-side aggregates (the doctor's financial obligations).
    $stmt = $pdo->prepare(
        "SELECT
            COUNT(*)                                                                    AS visits_created,
            COALESCE(SUM(status = 'paid'), 0)                                           AS visits_paid,
            COALESCE(SUM(status = 'pending_payment'), 0)                                AS visits_pending,
            COALESCE(SUM(status = 'cancelled'), 0)                                      AS visits_cancelled,
            COALESCE(SUM(CASE WHEN status <> 'cancelled' THEN consultation_fee END), 0) AS total_charges,
            COALESCE(SUM(CASE WHEN status = 'pending_payment' THEN consultation_fee END), 0) AS pending
           FROM visits WHERE visit_date = ?"
    );
    $stmt->execute([$date]);
    $visits = $stmt->fetch();

    // Payment-side aggregates tied to the same day's visits.
    $payWhere = "pay.status = 'paid' AND v.visit_date = ?";
    $payParams = [$date];
    if ($collectorId !== null) {
        $payWhere .= ' AND pay.collected_by = ?';
        $payParams[] = $collectorId;
    }

    $stmt = $pdo->prepare(
        "SELECT pay.payment_method, COALESCE(SUM(pay.amount),0) AS total, COUNT(*) AS cnt
           FROM payments pay JOIN visits v ON v.id = pay.visit_id
          WHERE $payWhere
          GROUP BY pay.payment_method"
    );
    $stmt->execute($payParams);

    $byMethod = ['cash' => 0.0, 'card' => 0.0, 'bank_transfer' => 0.0];
    $collected = 0.0;
    $transactions = 0;
    foreach ($stmt->fetchAll() as $row) {
        $byMethod[$row['payment_method']] = money($row['total']);
        $collected += (float) $row['total'];
        $transactions += (int) $row['cnt'];
    }

    // Clinic-wide collection for the day (unscoped), for reference.
    $stmt = $pdo->prepare(
        "SELECT COALESCE(SUM(pay.amount),0)
           FROM payments pay JOIN visits v ON v.id = pay.visit_id
          WHERE pay.status = 'paid' AND v.visit_date = ?"
    );
    $stmt->execute([$date]);
    $clinicCollected = money($stmt->fetchColumn());

    // Voided payments for the day.
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM payments WHERE status = 'voided' AND DATE(voided_at) = ?");
    $stmt->execute([$date]);
    $voided = (int) $stmt->fetchColumn();

    return [
        'date'             => $date,
        'visits_created'   => (int) $visits['visits_created'],
        'visits_paid'      => (int) $visits['visits_paid'],
        'visits_pending'   => (int) $visits['visits_pending'],
        'visits_cancelled' => (int) $visits['visits_cancelled'],
        'patients_seen'    => (int) $visits['visits_created'] - (int) $visits['visits_cancelled'],
        'total_charges'    => money($visits['total_charges']),
        'collected'        => money($collected),
        'clinic_collected' => $clinicCollected,
        'pending'          => money($visits['pending']),
        'transactions'     => $transactions,
        'by_method'        => $byMethod,
        'voided'           => $voided,
    ];
}

function reports_daily(): void
{
    $user = require_login();
    $date = valid_date_or_today(query_str('date'));
    $status = query_str('status', '');
    $method = query_str('method', '');
    $q = query_str('q', '');

    $where = ['v.visit_date = ?'];
    $params = [$date];

    if ($status !== null && $status !== '' && in_array($status, ['pending_payment', 'paid', 'cancelled'], true)) {
        $where[] = 'v.status = ?';
        $params[] = $status;
    }
    if ($method !== null && $method !== '' && in_array($method, ['cash', 'card', 'bank_transfer'], true)) {
        $where[] = 'pay.payment_method = ?';
        $params[] = $method;
    }
    if ($q !== null && $q !== '') {
        $where[] = '(pt.full_name LIKE ? OR v.visit_number LIKE ?)';
        $like = '%' . $q . '%';
        $params[] = $like;
        $params[] = $like;
    }
    // Cashiers only ever see payments they collected.
    if ($user['role'] === 'cashier') {
        $where[] = "(pay.collected_by = ? OR v.status = 'pending_payment')";
        $params[] = $user['id'];
    }

    $whereSql = 'WHERE ' . implode(' AND ', $where);

    $stmt = db()->prepare(
        "SELECT v.id, v.visit_number, v.consultation_fee, v.status, v.visit_date, v.created_at,
                pt.full_name AS patient_name, pt.patient_code,
                d.name AS doctor_name,
                pay.id AS payment_id, pay.payment_number, pay.payment_method, pay.paid_at, pay.status AS payment_status,
                col.name AS collected_by_name
           FROM visits v
           JOIN patients pt ON pt.id = v.patient_id
           JOIN users d ON d.id = v.doctor_id
           LEFT JOIN payments pay ON pay.visit_id = v.id AND pay.status = 'paid'
           LEFT JOIN users col ON col.id = pay.collected_by
          $whereSql
          ORDER BY v.id ASC"
    );
    $stmt->execute($params);

    $rows = array_map(static function (array $r): array {
        return [
            'id'               => (int) $r['id'],
            'visit_number'     => $r['visit_number'],
            'consultation_fee' => money($r['consultation_fee']),
            'status'           => $r['status'],
            'created_at'       => $r['created_at'],
            'patient_name'     => $r['patient_name'],
            'patient_code'     => $r['patient_code'],
            'doctor_name'      => $r['doctor_name'],
            'payment_number'   => $r['payment_number'],
            'payment_method'   => $r['payment_method'],
            'paid_at'          => $r['paid_at'],
            'payment_status'   => $r['payment_status'],
            'cashier'          => $r['collected_by_name'],
        ];
    }, $stmt->fetchAll());

    $summary = daily_summary($date, $user['role'] === 'cashier' ? (int) $user['id'] : null);

    json_ok([
        'date'    => $date,
        'items'   => $rows,
        'summary' => $summary,
    ]);
}

/**
 * Cash reconciliation for end of day (payment-date centric).
 */
function reports_closing(): void
{
    require_login();
    $date = valid_date_or_today(query_str('date'));
    $pdo = db();

    $stmt = $pdo->prepare(
        "SELECT payment_method, COALESCE(SUM(amount),0) AS total, COUNT(*) AS cnt
           FROM payments
          WHERE status = 'paid' AND payment_date = ?
          GROUP BY payment_method"
    );
    $stmt->execute([$date]);

    $byMethod = ['cash' => 0.0, 'card' => 0.0, 'bank_transfer' => 0.0];
    $total = 0.0;
    $transactions = 0;
    foreach ($stmt->fetchAll() as $row) {
        $byMethod[$row['payment_method']] = money($row['total']);
        $total += (float) $row['total'];
        $transactions += (int) $row['cnt'];
    }

    $stmt = $pdo->prepare('SELECT COUNT(*) FROM visits WHERE visit_date = ?');
    $stmt->execute([$date]);
    $visitsCreated = (int) $stmt->fetchColumn();

    $stmt = $pdo->prepare("SELECT COUNT(*), COALESCE(SUM(consultation_fee),0) FROM visits WHERE visit_date = ? AND status = 'pending_payment'");
    $stmt->execute([$date]);
    $pendingRow = $stmt->fetch(PDO::FETCH_NUM) ?: [0, 0];

    json_ok([
        'date'             => $date,
        'visits_created'   => $visitsCreated,
        'patients_seen'    => $visitsCreated,
        'by_method'        => $byMethod,
        'total_collected'  => money($total),
        'transactions'     => $transactions,
        'pending_count'    => (int) ($pendingRow[0] ?? 0),
        'pending_total'    => money($pendingRow[1] ?? 0),
    ]);
}

/**
 * Anti-fraud comparison: visits created vs payments collected.
 */
function reports_activity(): void
{
    require_login();
    $date = valid_date_or_today(query_str('date'));
    json_ok(daily_summary($date));
}
