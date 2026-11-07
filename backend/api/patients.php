<?php
/**
 * Patient endpoints.
 */

declare(strict_types=1);

function patients_index(): void
{
    require_login();
    $q = query_str('q', '');
    $p = pagination(20);

    $where = '';
    $params = [];
    if ($q !== null && $q !== '') {
        $where = 'WHERE (full_name LIKE ? OR phone LIKE ? OR patient_code LIKE ?)';
        $like = '%' . $q . '%';
        $params = [$like, $like, $like];
    }

    $countStmt = db()->prepare("SELECT COUNT(*) FROM patients $where");
    $countStmt->execute($params);
    $total = (int) $countStmt->fetchColumn();

    $sql = "SELECT id, patient_code, full_name, phone, address, date_of_birth, gender, notes, created_at
              FROM patients $where
             ORDER BY id DESC
             LIMIT {$p['per_page']} OFFSET {$p['offset']}";
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    json_ok([
        'items'    => array_map('map_patient', $rows),
        'total'    => $total,
        'page'     => $p['page'],
        'per_page' => $p['per_page'],
    ]);
}

function patients_show(string $id): void
{
    require_login();
    $stmt = db()->prepare(
        'SELECT id, patient_code, full_name, phone, address, date_of_birth, gender, notes, created_at
           FROM patients WHERE id = ? LIMIT 1'
    );
    $stmt->execute([(int) $id]);
    $row = $stmt->fetch();
    if (!$row) {
        json_err('Patient not found.', 404);
    }

    // recent visits for context
    $visits = db()->prepare(
        'SELECT v.id, v.visit_number, v.consultation_fee, v.status, v.visit_date, v.created_at,
                p.payment_number, p.payment_method, p.paid_at
           FROM visits v
           LEFT JOIN payments p ON p.visit_id = v.id AND p.status = "paid"
          WHERE v.patient_id = ?
          ORDER BY v.id DESC
          LIMIT 10'
    );
    $visits->execute([(int) $id]);

    $patient = map_patient($row);
    $patient['visits'] = array_map(static function (array $v): array {
        return [
            'id'             => (int) $v['id'],
            'visit_number'   => $v['visit_number'],
            'consultation_fee' => money($v['consultation_fee']),
            'status'         => $v['status'],
            'visit_date'     => $v['visit_date'],
            'created_at'     => $v['created_at'],
            'payment_number' => $v['payment_number'],
            'payment_method' => $v['payment_method'],
            'paid_at'        => $v['paid_at'],
        ];
    }, $visits->fetchAll());

    json_ok($patient);
}

function patients_store(): void
{
    $user = require_role('doctor');

    $fullName = v_str('full_name', 'Patient name', 2, 160);
    $phone = v_str('phone', 'Phone', 0, 30, false);
    $address = v_str('address', 'Address', 0, 255, false);
    $dob = v_date('date_of_birth', 'Date of birth', false);
    $gender = null;
    if (input('gender') !== null && input('gender') !== '') {
        $gender = v_enum('gender', ['male', 'female', 'other'], 'Gender');
    }
    $notes = v_str('notes', 'Notes', 0, 500, false);

    $code = make_patient_code();
    $stmt = db()->prepare(
        'INSERT INTO patients (patient_code, full_name, phone, address, date_of_birth, gender, notes, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([$code, $fullName, $phone, $address, $dob, $gender, $notes, $user['id']]);
    $id = (int) db()->lastInsertId();

    audit('PATIENT_CREATED', 'patient', $id, null, [
        'patient_code' => $code,
        'full_name'    => $fullName,
    ]);

    $stmt = db()->prepare('SELECT id, patient_code, full_name, phone, address, date_of_birth, gender, notes, created_at FROM patients WHERE id = ?');
    $stmt->execute([$id]);

    json_ok(map_patient($stmt->fetch()), 'Patient created successfully.', 201);
}

function map_patient(array $row): array
{
    return [
        'id'           => (int) $row['id'],
        'patient_code' => $row['patient_code'],
        'full_name'    => $row['full_name'],
        'phone'        => $row['phone'],
        'address'      => $row['address'],
        'date_of_birth'=> $row['date_of_birth'],
        'gender'       => $row['gender'],
        'notes'        => $row['notes'],
        'created_at'   => $row['created_at'],
    ];
}
