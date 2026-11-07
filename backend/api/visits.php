<?php
/**
 * Visit (consultation / charge) endpoints.
 * Only a doctor can create or cancel a visit.
 */

declare(strict_types=1);

function visits_index(): void
{
    require_login();
    $date = valid_date_or_today(query_str('date'));
    $status = query_str('status', '');
    $q = query_str('q', '');
    $p = pagination(50);

    $where = ['v.visit_date = ?'];
    $params = [$date];

    if ($status !== null && $status !== '' && in_array($status, ['pending_payment', 'paid', 'cancelled'], true)) {
        $where[] = 'v.status = ?';
        $params[] = $status;
    }
    if ($q !== null && $q !== '') {
        $where[] = '(pt.full_name LIKE ? OR v.visit_number LIKE ? OR pt.patient_code LIKE ?)';
        $like = '%' . $q . '%';
        $params[] = $like;
        $params[] = $like;
        $params[] = $like;
    }
    $whereSql = 'WHERE ' . implode(' AND ', $where);

    $countStmt = db()->prepare("SELECT COUNT(*) FROM visits v JOIN patients pt ON pt.id = v.patient_id $whereSql");
    $countStmt->execute($params);
    $total = (int) $countStmt->fetchColumn();

    $sql = "SELECT v.id, v.visit_number, v.consultation_fee, v.status, v.visit_date, v.created_at,
                   v.cancelled_at, v.cancellation_reason,
                   pt.id AS patient_id, pt.full_name AS patient_name, pt.patient_code, pt.phone AS patient_phone,
                   d.name AS doctor_name,
                   pay.id AS payment_id, pay.payment_number, pay.payment_method, pay.paid_at, pay.status AS payment_status
              FROM visits v
              JOIN patients pt ON pt.id = v.patient_id
              JOIN users d ON d.id = v.doctor_id
              LEFT JOIN payments pay ON pay.visit_id = v.id AND pay.status = 'paid'
             $whereSql
             ORDER BY v.id DESC
             LIMIT {$p['per_page']} OFFSET {$p['offset']}";
    $stmt = db()->prepare($sql);
    $stmt->execute($params);

    json_ok([
        'items'    => array_map('map_visit', $stmt->fetchAll()),
        'total'    => $total,
        'page'     => $p['page'],
        'per_page' => $p['per_page'],
        'date'     => $date,
    ]);
}

function visits_show(string $id): void
{
    require_login();
    $visit = load_visit((int) $id);
    if (!$visit) {
        json_err('Visit not found.', 404);
    }
    json_ok($visit);
}

function visits_store(): void
{
    $user = require_role('doctor');

    // Validate every input before opening a transaction.
    $patientId = (int) input('patient_id', 0);
    $walkInName = null;
    $patient = null;
    if ($patientId > 0) {
        $stmt = db()->prepare('SELECT id, patient_code, full_name FROM patients WHERE id = ? LIMIT 1');
        $stmt->execute([$patientId]);
        $patient = $stmt->fetch();
        if (!$patient) {
            json_err('The selected patient does not exist.', 422, ['patient_id' => 'Unknown patient.']);
        }
    } else {
        $walkInName = v_str('patient_name', 'Patient name', 2, 160);
    }

    // Server-side money validation. The client can never set an arbitrary amount later.
    $fee = v_money('consultation_fee', 'Consultation fee', 1, 1000000);

    $today = date('Y-m-d');
    $visitNumber = make_visit_number($today);

    $pdo = db();
    $pdo->beginTransaction();
    try {
        if ($patient === null) {
            // Quick entry: registration is optional, so create a lightweight
            // patient record from the typed name. Keeps the visit/cashier/receipt
            // reference stable; the doctor can complete the details later.
            $patientCode = make_patient_code();
            $pdo->prepare('INSERT INTO patients (patient_code, full_name, created_by) VALUES (?, ?, ?)')
                ->execute([$patientCode, $walkInName, $user['id']]);
            $patientId = (int) $pdo->lastInsertId();
            $patient = ['id' => $patientId, 'patient_code' => $patientCode, 'full_name' => $walkInName];
        }

        $stmt = $pdo->prepare(
            'INSERT INTO visits (visit_number, patient_id, doctor_id, consultation_fee, status, visit_date)
             VALUES (?, ?, ?, ?, "pending_payment", ?)'
        );
        $stmt->execute([$visitNumber, $patientId, $user['id'], $fee, $today]);
        $visitId = (int) $pdo->lastInsertId();
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }

    if ($walkInName !== null) {
        audit('PATIENT_CREATED', 'patient', $patientId, null, [
            'patient_code' => $patient['patient_code'],
            'full_name'    => $patient['full_name'],
            'walk_in'      => true,
        ]);
    }

    audit('VISIT_CREATED', 'visit', $visitId, null, [
        'visit_number'     => $visitNumber,
        'patient_id'       => $patientId,
        'patient_name'     => $patient['full_name'],
        'consultation_fee' => $fee,
    ]);

    json_ok(load_visit($visitId), 'Visit created. Waiting for cashier payment.', 201);
}

function visits_cancel(string $id): void
{
    $user = require_role('doctor');
    $visitId = (int) $id;
    $reason = v_str('reason', 'Cancellation reason', 3, 500);

    $pdo = db();
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('SELECT id, visit_number, status, consultation_fee, patient_id FROM visits WHERE id = ? FOR UPDATE');
        $stmt->execute([$visitId]);
        $visit = $stmt->fetch();

        if (!$visit) {
            $pdo->rollBack();
            json_err('Visit not found.', 404);
        }
        if ($visit['status'] === 'cancelled') {
            $pdo->rollBack();
            json_err('This visit is already cancelled.', 409);
        }
        if ($visit['status'] === 'paid') {
            $pdo->rollBack();
            json_err('A paid visit cannot be cancelled. Void the payment first.', 409);
        }

        $pdo->prepare(
            'UPDATE visits SET status = "cancelled", cancelled_at = NOW(), cancelled_by = ?, cancellation_reason = ? WHERE id = ?'
        )->execute([$user['id'], $reason, $visitId]);

        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }

    audit('VISIT_CANCELLED', 'visit', $visitId, [
        'status' => $visit['status'],
    ], [
        'status'              => 'cancelled',
        'cancellation_reason' => $reason,
    ]);

    json_ok(load_visit($visitId), 'Visit cancelled.');
}

/**
 * Load a single visit with patient, doctor and payment details.
 */
function load_visit(int $id): ?array
{
    $stmt = db()->prepare(
        "SELECT v.id, v.visit_number, v.consultation_fee, v.status, v.visit_date, v.created_at,
                v.cancelled_at, v.cancellation_reason,
                pt.id AS patient_id, pt.full_name AS patient_name, pt.patient_code, pt.phone AS patient_phone,
                d.name AS doctor_name, cu.name AS cancelled_by_name,
                pay.id AS payment_id, pay.payment_number, pay.payment_method, pay.paid_at, pay.status AS payment_status,
                col.name AS collected_by_name
           FROM visits v
           JOIN patients pt ON pt.id = v.patient_id
           JOIN users d ON d.id = v.doctor_id
           LEFT JOIN users cu ON cu.id = v.cancelled_by
           LEFT JOIN payments pay ON pay.visit_id = v.id AND pay.status = 'paid'
           LEFT JOIN users col ON col.id = pay.collected_by
          WHERE v.id = ? LIMIT 1"
    );
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    return $row ? map_visit($row) : null;
}

function map_visit(array $row): array
{
    return [
        'id'                  => (int) $row['id'],
        'visit_number'        => $row['visit_number'],
        'consultation_fee'    => money($row['consultation_fee']),
        'status'              => $row['status'],
        'visit_date'          => $row['visit_date'],
        'created_at'          => $row['created_at'],
        'cancelled_at'        => $row['cancelled_at'] ?? null,
        'cancellation_reason' => $row['cancellation_reason'] ?? null,
        'cancelled_by_name'   => $row['cancelled_by_name'] ?? null,
        'patient'             => [
            'id'           => (int) $row['patient_id'],
            'full_name'    => $row['patient_name'],
            'patient_code' => $row['patient_code'],
            'phone'        => $row['patient_phone'] ?? null,
        ],
        'doctor_name'         => $row['doctor_name'],
        'payment'             => isset($row['payment_id']) && $row['payment_id'] !== null ? [
            'id'             => (int) $row['payment_id'],
            'payment_number' => $row['payment_number'],
            'payment_method' => $row['payment_method'],
            'paid_at'        => $row['paid_at'],
            'status'         => $row['payment_status'],
            'collected_by'   => $row['collected_by_name'] ?? null,
        ] : null,
    ];
}
