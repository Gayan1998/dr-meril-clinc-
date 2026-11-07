<?php
/**
 * Payment endpoints.
 *
 * SECURITY (the core of this system):
 *   The browser NEVER sends the amount for a collection. The backend
 *   loads the doctor-created visit row, reads consultation_fee from the
 *   database, and creates the payment with that value. Any `amount`
 *   present in the request body is ignored.
 *
 *   Collection runs inside a transaction with SELECT ... FOR UPDATE so
 *   two cashiers cannot pay the same visit twice. A UNIQUE index on
 *   (visit_id, active) is the database-level backstop.
 */

declare(strict_types=1);

function payments_pending(): void
{
    require_login();
    $q = query_str('q', '');
    $date = query_str('date');

    $where = ["v.status = 'pending_payment'"];
    $params = [];
    if ($date !== null && $date !== '') {
        $where[] = 'v.visit_date = ?';
        $params[] = valid_date_or_today($date);
    }
    if ($q !== null && $q !== '') {
        $where[] = '(pt.full_name LIKE ? OR v.visit_number LIKE ? OR pt.patient_code LIKE ? OR pt.phone LIKE ?)';
        $like = '%' . $q . '%';
        array_push($params, $like, $like, $like, $like);
    }
    $whereSql = 'WHERE ' . implode(' AND ', $where);

    $stmt = db()->prepare(
        "SELECT v.id, v.visit_number, v.consultation_fee, v.status, v.visit_date, v.created_at,
                pt.id AS patient_id, pt.full_name AS patient_name, pt.patient_code, pt.phone AS patient_phone,
                d.name AS doctor_name
           FROM visits v
           JOIN patients pt ON pt.id = v.patient_id
           JOIN users d ON d.id = v.doctor_id
          $whereSql
          ORDER BY v.id DESC"
    );
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    $total = 0.0;
    $items = array_map(static function (array $r) use (&$total): array {
        $total += (float) $r['consultation_fee'];
        return [
            'id'               => (int) $r['id'],
            'visit_number'     => $r['visit_number'],
            'consultation_fee' => money($r['consultation_fee']),
            'status'           => $r['status'],
            'visit_date'       => $r['visit_date'],
            'created_at'       => $r['created_at'],
            'doctor_name'      => $r['doctor_name'],
            'patient'          => [
                'id'           => (int) $r['patient_id'],
                'full_name'    => $r['patient_name'],
                'patient_code' => $r['patient_code'],
                'phone'        => $r['patient_phone'],
            ],
        ];
    }, $rows);

    json_ok([
        'items' => $items,
        'count' => count($items),
        'total' => money($total),
    ]);
}

function payments_collect(string $visitId): void
{
    $user = require_role('cashier');
    $visitId = (int) $visitId;
    $method = v_enum('payment_method', ['cash'], 'Payment method');

    // NOTE: input('amount') is deliberately never read.
    $pdo = db();
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare(
            'SELECT id, visit_number, patient_id, consultation_fee, status
               FROM visits WHERE id = ? FOR UPDATE'
        );
        $stmt->execute([$visitId]);
        $visit = $stmt->fetch();

        if (!$visit) {
            $pdo->rollBack();
            json_err('This visit could not be found. Please refresh the payment queue.', 404);
        }
        if ($visit['status'] === 'paid') {
            $pdo->rollBack();
            json_err('This visit has already been paid.', 409);
        }
        if ($visit['status'] === 'cancelled') {
            $pdo->rollBack();
            json_err('This visit was cancelled by the doctor and cannot be paid.', 409);
        }

        // Belt and braces: confirm no active payment already exists.
        $check = $pdo->prepare("SELECT COUNT(*) FROM payments WHERE visit_id = ? AND status = 'paid'");
        $check->execute([$visitId]);
        if ((int) $check->fetchColumn() > 0) {
            $pdo->rollBack();
            json_err('This visit has already been paid.', 409);
        }

        // Amount comes from the DATABASE, never from the request.
        $amount = money($visit['consultation_fee']);
        $paymentNumber = make_payment_number();

        $stmt = $pdo->prepare(
            'INSERT INTO payments (payment_number, visit_id, amount, payment_method, collected_by, paid_at, payment_date, status)
             VALUES (?, ?, ?, ?, ?, NOW(), CURDATE(), "paid")'
        );
        $stmt->execute([$paymentNumber, $visitId, $amount, $method, $user['id']]);
        $paymentId = (int) $pdo->lastInsertId();

        $pdo->prepare('UPDATE visits SET status = "paid" WHERE id = ?')->execute([$visitId]);

        $pdo->commit();
    } catch (PDOException $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        // 23000 = integrity constraint (duplicate active payment) -> race lost
        if ($e->getCode() === '23000') {
            json_err('This payment could not be completed because the visit was just paid. Please refresh and try again.', 409);
        }
        throw $e;
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }

    audit('PAYMENT_CREATED', 'payment', $paymentId, null, [
        'payment_number' => $paymentNumber,
        'visit_id'       => $visitId,
        'visit_number'   => $visit['visit_number'],
        'amount'         => $amount,
        'payment_method' => $method,
    ]);

    json_ok(load_payment($paymentId), 'Payment collected successfully.', 201);
}

function payments_index(): void
{
    require_login();
    $date = query_str('date');
    $method = query_str('method', '');
    $status = query_str('status', '');
    $q = query_str('q', '');
    $p = pagination(50);

    $where = [];
    $params = [];

    if ($date !== null && $date !== '') {
        $where[] = 'pay.payment_date = ?';
        $params[] = valid_date_or_today($date);
    }
    if ($method !== null && $method !== '' && in_array($method, ['cash', 'card', 'bank_transfer'], true)) {
        $where[] = 'pay.payment_method = ?';
        $params[] = $method;
    }
    if ($status !== null && $status !== '' && in_array($status, ['paid', 'voided'], true)) {
        $where[] = 'pay.status = ?';
        $params[] = $status;
    }
    if ($q !== null && $q !== '') {
        $where[] = '(pt.full_name LIKE ? OR pay.payment_number LIKE ? OR v.visit_number LIKE ?)';
        $like = '%' . $q . '%';
        array_push($params, $like, $like, $like);
    }
    $whereSql = $where ? 'WHERE ' . implode(' AND ', $where) : '';

    $countStmt = db()->prepare(
        "SELECT COUNT(*) FROM payments pay
           JOIN visits v ON v.id = pay.visit_id
           JOIN patients pt ON pt.id = v.patient_id
         $whereSql"
    );
    $countStmt->execute($params);
    $total = (int) $countStmt->fetchColumn();

    $stmt = db()->prepare(
        "SELECT pay.id, pay.payment_number, pay.amount, pay.payment_method, pay.paid_at, pay.payment_date, pay.status,
                v.id AS visit_id, v.visit_number, v.consultation_fee,
                pt.id AS patient_id, pt.full_name AS patient_name, pt.patient_code,
                col.name AS collected_by_name, d.name AS doctor_name
           FROM payments pay
           JOIN visits v ON v.id = pay.visit_id
           JOIN patients pt ON pt.id = v.patient_id
           JOIN users col ON col.id = pay.collected_by
           JOIN users d ON d.id = v.doctor_id
         $whereSql
          ORDER BY pay.id DESC
          LIMIT {$p['per_page']} OFFSET {$p['offset']}"
    );
    $stmt->execute($params);

    json_ok([
        'items'    => array_map('map_payment_row', $stmt->fetchAll()),
        'total'    => $total,
        'page'     => $p['page'],
        'per_page' => $p['per_page'],
    ]);
}

function payments_show(string $id): void
{
    require_login();
    $payment = load_payment((int) $id);
    if (!$payment) {
        json_err('Payment not found.', 404);
    }
    json_ok($payment);
}

function payments_void(string $id): void
{
    $user = require_role('doctor');
    $paymentId = (int) $id;
    $reason = v_str('reason', 'Void reason', 3, 500);

    $pdo = db();
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('SELECT id, payment_number, visit_id, amount, status FROM payments WHERE id = ? FOR UPDATE');
        $stmt->execute([$paymentId]);
        $payment = $stmt->fetch();

        if (!$payment) {
            $pdo->rollBack();
            json_err('Payment not found.', 404);
        }
        if ($payment['status'] === 'voided') {
            $pdo->rollBack();
            json_err('This payment is already voided.', 409);
        }

        $pdo->prepare(
            'UPDATE payments SET status = "voided", voided_at = NOW(), voided_by = ?, void_reason = ? WHERE id = ?'
        )->execute([$user['id'], $reason, $paymentId]);

        // return the visit to the pending queue
        $pdo->prepare('UPDATE visits SET status = "pending_payment" WHERE id = ?')->execute([$payment['visit_id']]);

        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }

    audit('PAYMENT_VOIDED', 'payment', $paymentId, [
        'status' => 'paid',
    ], [
        'status'      => 'voided',
        'void_reason' => $reason,
        'amount'      => money($payment['amount']),
    ]);

    json_ok(load_payment($paymentId), 'Payment voided and returned to the pending queue.');
}

function load_payment(int $id): ?array
{
    $stmt = db()->prepare(
        "SELECT pay.id, pay.payment_number, pay.amount, pay.payment_method, pay.paid_at, pay.payment_date, pay.status,
                pay.voided_at, pay.void_reason,
                v.id AS visit_id, v.visit_number, v.consultation_fee,
                pt.id AS patient_id, pt.full_name AS patient_name, pt.patient_code, pt.phone AS patient_phone,
                col.name AS collected_by_name, d.name AS doctor_name,
                vd.name AS voided_by_name
           FROM payments pay
           JOIN visits v ON v.id = pay.visit_id
           JOIN patients pt ON pt.id = v.patient_id
           JOIN users col ON col.id = pay.collected_by
           JOIN users d ON d.id = v.doctor_id
           LEFT JOIN users vd ON vd.id = pay.voided_by
          WHERE pay.id = ? LIMIT 1"
    );
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) {
        return null;
    }
    $payment = map_payment_row($row);
    $payment['clinic'] = clinic_settings();
    return $payment;
}

function map_payment_row(array $row): array
{
    return [
        'id'             => (int) $row['id'],
        'payment_number' => $row['payment_number'],
        'amount'         => money($row['amount']),
        'payment_method' => $row['payment_method'],
        'paid_at'        => $row['paid_at'],
        'payment_date'   => $row['payment_date'],
        'status'         => $row['status'],
        'voided_at'      => $row['voided_at'] ?? null,
        'void_reason'    => $row['void_reason'] ?? null,
        'voided_by'      => $row['voided_by_name'] ?? null,
        'collected_by'   => $row['collected_by_name'] ?? null,
        'doctor_name'    => $row['doctor_name'] ?? null,
        'visit'          => [
            'id'               => (int) $row['visit_id'],
            'visit_number'     => $row['visit_number'],
            'consultation_fee' => money($row['consultation_fee']),
        ],
        'patient'        => [
            'id'           => (int) $row['patient_id'],
            'full_name'    => $row['patient_name'],
            'patient_code' => $row['patient_code'],
            'phone'        => $row['patient_phone'] ?? null,
        ],
    ];
}
