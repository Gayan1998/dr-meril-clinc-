<?php
/**
 * API integration / security test suite.
 *
 * Run against a running backend:
 *   php backend/tests/api_test.php [baseUrl]
 *
 * Default baseUrl: http://localhost/dr_meril/backend/public
 * It creates its own patient + visits, so run on a dev database.
 */

declare(strict_types=1);

$base = $argv[1] ?? 'http://localhost/dr_meril/backend/public';
$pass = 0;
$fail = 0;
$failures = [];

function http(string $method, string $path, ?array $body = null, ?string $token = null): array
{
    global $base;
    $ch = curl_init($base . $path);
    $headers = ['Accept: application/json'];
    if ($token) {
        $headers[] = 'Authorization: Bearer ' . $token;
    }
    if ($body !== null) {
        $headers[] = 'Content-Type: application/json';
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
    }
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST  => $method,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_TIMEOUT        => 15,
    ]);
    $raw = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    if ($raw === false) {
        $err = curl_error($ch);
        curl_close($ch);
        return [0, ['success' => false, 'message' => "curl error: $err"]];
    }
    curl_close($ch);
    $json = json_decode($raw, true);
    return [$status, is_array($json) ? $json : ['raw' => $raw]];
}

function check(string $label, bool $condition, string $detail = ''): void
{
    global $pass, $fail, $failures;
    if ($condition) {
        $pass++;
        echo "  PASS  $label\n";
    } else {
        $fail++;
        $failures[] = "$label :: $detail";
        echo "  FAIL  $label" . ($detail ? "  ($detail)" : '') . "\n";
    }
}

function section(string $name): void
{
    echo "\n== $name ==\n";
}

$stamp = date('His') . '-' . random_int(100, 999);

// ---------------------------------------------------------------
section('Health');
[$status, $res] = http('GET', '/api/health');
check('health returns 200', $status === 200 && ($res['success'] ?? false) === true, "status=$status");

// ---------------------------------------------------------------
section('Authentication');
[$status] = http('POST', '/api/auth/login', ['username' => 'doctor', 'password' => 'wrong-password']);
check('invalid login rejected (401)', $status === 401, "status=$status");

[$status, $res] = http('POST', '/api/auth/login', ['username' => 'doctor', 'password' => 'Doctor@123']);
$doctor = $res['data']['token'] ?? null;
$doctorId = $res['data']['user']['id'] ?? null;
check('doctor login works', $status === 200 && $doctor !== null, "status=$status");

[$status, $res] = http('POST', '/api/auth/login', ['username' => 'cashier', 'password' => 'Cashier@123']);
$cashier = $res['data']['token'] ?? null;
check('cashier login works', $status === 200 && $cashier !== null, "status=$status");

[$status] = http('GET', '/api/auth/me');
check('unauthenticated request rejected (401)', $status === 401, "status=$status");

[$status] = http('GET', '/api/auth/me', null, 'not-a-real-token');
check('invalid token rejected (401)', $status === 401, "status=$status");

// ---------------------------------------------------------------
section('Role based access control');
[$status] = http('GET', '/api/dashboard/doctor', null, $cashier);
check('cashier cannot read doctor dashboard (403)', $status === 403, "status=$status");

[$status] = http('GET', '/api/audit-logs', null, $cashier);
check('cashier cannot read audit logs (403)', $status === 403, "status=$status");

[$status] = http('GET', '/api/users', null, $cashier);
check('cashier cannot list users (403)', $status === 403, "status=$status");

[$status] = http('POST', '/api/users', ['name' => 'Hacker', 'username' => 'hack' . $stamp, 'password' => 'hackhack1', 'role' => 'doctor'], $cashier);
check('cashier cannot create users / self-promote (403)', $status === 403, "status=$status");

[$status] = http('POST', '/api/patients', ['full_name' => 'Should Fail'], $cashier);
check('cashier cannot create patients (403)', $status === 403, "status=$status");

// ---------------------------------------------------------------
section('Doctor workflow');
[$status, $res] = http('POST', '/api/patients', [
    'full_name' => "Test Patient $stamp",
    'phone'     => '077' . random_int(1000000, 9999999),
], $doctor);
$patientId = $res['data']['id'] ?? null;
check('doctor creates patient (201)', $status === 201 && $patientId, "status=$status msg=" . ($res['message'] ?? ''));

[$status, $res] = http('POST', '/api/visits', ['patient_id' => $patientId, 'consultation_fee' => 2000], $doctor);
$visitId = $res['data']['id'] ?? null;
check('doctor creates visit (201)', $status === 201 && $visitId, "status=$status msg=" . ($res['message'] ?? ''));
check('new visit is pending_payment', ($res['data']['status'] ?? '') === 'pending_payment');
check('visit fee stored as 2000', ($res['data']['consultation_fee'] ?? 0) == 2000.0, 'fee=' . json_encode($res['data']['consultation_fee'] ?? null));

[$status] = http('POST', '/api/visits', ['patient_id' => $patientId, 'consultation_fee' => 0], $doctor);
check('zero / invalid fee rejected (422)', $status === 422, "status=$status");

[$status] = http('POST', '/api/visits', ['patient_id' => $patientId, 'consultation_fee' => -500], $doctor);
check('negative fee rejected (422)', $status === 422, "status=$status");

[$status] = http('POST', '/api/visits', ['patient_id' => 99999999, 'consultation_fee' => 1000], $doctor);
check('visit for unknown patient rejected (422)', $status === 422, "status=$status");

// quick entry: no patient_id, just a typed name
[$status, $res] = http('POST', '/api/visits', ['patient_name' => "Walk In $stamp", 'consultation_fee' => 1750], $doctor);
$walkInVisitId = $res['data']['id'] ?? null;
check('walk-in visit without registration (201)', $status === 201 && $walkInVisitId, "status=$status msg=" . ($res['message'] ?? ''));
check('walk-in patient name is kept', ($res['data']['patient']['full_name'] ?? '') === "Walk In $stamp");

[$status] = http('POST', '/api/visits', ['patient_name' => 'X', 'consultation_fee' => 1000], $doctor);
check('walk-in name too short rejected (422)', $status === 422, "status=$status");

[$status] = http('POST', '/api/visits', ['consultation_fee' => 1000], $doctor);
check('visit with neither patient nor name rejected (422)', $status === 422, "status=$status");

// a second visit to test cancellation
[$status, $res] = http('POST', '/api/visits', ['patient_id' => $patientId, 'consultation_fee' => 1500], $doctor);
$cancelVisitId = $res['data']['id'] ?? null;
check('doctor creates second visit', $status === 201 && $cancelVisitId);

[$status] = http('POST', "/api/visits/$cancelVisitId/cancel", ['reason' => 'Patient left before payment'], $doctor);
check('doctor cancels pending visit', $status === 200, "status=$status");

[$status] = http('POST', "/api/visits/$cancelVisitId/cancel", ['reason' => 'again'], $doctor);
check('double cancel rejected (409)', $status === 409, "status=$status");

[$status] = http('POST', "/api/visits/$visitId/cancel", ['reason' => ''], $doctor);
check('cancel without reason rejected (422)', $status === 422, "status=$status");

// ---------------------------------------------------------------
section('Cashier: pending queue');
[$status, $res] = http('GET', '/api/payments/pending', null, $cashier);
$pendingIds = array_column($res['data']['items'] ?? [], 'id');
check('cashier can read pending queue', $status === 200 && is_array($pendingIds));
check('new visit appears in pending queue', in_array($visitId, $pendingIds, true));

// ---------------------------------------------------------------
section('SECURITY: amount manipulation');
[$status, $res] = http('POST', "/api/payments/$visitId/collect", [
    'payment_method' => 'cash',
    'amount'         => 500, // attacker-supplied; must be ignored
], $cashier);
$collected = $res['data']['amount'] ?? null;
check('cashier collects payment (201)', $status === 201, "status=$status msg=" . ($res['message'] ?? ''));
check('CRITICAL: collected amount is the doctor fee (2000), not 500', (float) $collected === 2000.0, 'got=' . json_encode($collected));

// ---------------------------------------------------------------
section('SECURITY: duplicate payment');
[$status] = http('POST', "/api/payments/$visitId/collect", ['payment_method' => 'cash'], $cashier);
check('duplicate collection rejected (409)', $status === 409, "status=$status");

[$status, $res] = http('GET', "/api/visits/$visitId", null, $doctor);
check('visit is now marked paid', ($res['data']['status'] ?? '') === 'paid');
check('exactly one active payment linked', ($res['data']['payment']['id'] ?? null) !== null);

// ---------------------------------------------------------------
section('SECURITY: cashier cannot mutate doctor records');
[$status] = http('POST', '/api/visits', ['patient_id' => $patientId, 'consultation_fee' => 9999], $cashier);
check('cashier cannot create a charge (403)', $status === 403, "status=$status");

[$status] = http('POST', "/api/visits/$cancelVisitId/cancel", ['reason' => 'cashier cancels'], $cashier);
check('cashier cannot cancel a visit (403)', $status === 403, "status=$status");

[$status] = http('POST', "/api/payments/$visitId/void", ['reason' => 'cashier voids'], $cashier);
check('cashier cannot void a payment (403)', $status === 403, "status=$status");

[$status] = http('POST', "/api/visits/$visitId", ['consultation_fee' => 1], $cashier);
check('cashier cannot edit a visit (no such route)', in_array($status, [404, 405], true), "status=$status");

[$status] = http('DELETE', "/api/payments/" . (($res['data']['payment']['id'] ?? 1)), null, $cashier);
check('payment cannot be deleted (no route)', in_array($status, [404, 405], true), "status=$status");

// ---------------------------------------------------------------
section('SECURITY: no payment without a real doctor visit');
[$status] = http('POST', '/api/payments/99999999/collect', ['payment_method' => 'cash'], $cashier);
check('fake visit id rejected (404)', $status === 404, "status=$status");

// ---------------------------------------------------------------
section('Doctor reports + anti-fraud totals');
[$status, $res] = http('GET', '/api/reports/activity', null, $doctor);
$s = $res['data'] ?? [];
check('doctor can read activity summary', $status === 200);
check('visits_created >= visits_paid', ($s['visits_created'] ?? 0) >= ($s['visits_paid'] ?? 0));
check('total_charges >= collected', ($s['total_charges'] ?? 0) >= ($s['collected'] ?? 0));
check('pending == total_charges - collected (approx)', abs((($s['total_charges'] ?? 0) - ($s['collected'] ?? 0)) - ($s['pending'] ?? 0)) < 0.01, json_encode($s));

[$status, $res] = http('GET', '/api/dashboard/doctor', null, $doctor);
check('doctor dashboard works', $status === 200 && isset($res['data']['summary']));

[$status] = http('GET', '/api/dashboard/cashier', null, $doctor);
check('doctor cannot read cashier dashboard (403)', $status === 403, "status=$status");

// ---------------------------------------------------------------
section('Doctor: void payment');
$paymentId = null;
[$status, $res] = http('GET', "/api/visits/$visitId", null, $doctor);
$paymentId = $res['data']['payment']['id'] ?? null;
[$status] = http('POST', "/api/payments/$paymentId/void", ['reason' => 'Duplicate entry, corrected'], $doctor);
check('doctor voids payment', $status === 200, "status=$status");
[$status, $res] = http('GET', "/api/visits/$visitId", null, $doctor);
check('voided visit returns to pending', ($res['data']['status'] ?? '') === 'pending_payment');

// ---------------------------------------------------------------
section('Audit trail');
[$status, $res] = http('GET', '/api/audit-logs?per_page=100', null, $doctor);
$actions = array_column($res['data']['items'] ?? [], 'action');
check('audit log readable by doctor', $status === 200);
foreach (['LOGIN', 'PATIENT_CREATED', 'VISIT_CREATED', 'VISIT_CANCELLED', 'PAYMENT_CREATED', 'PAYMENT_VOIDED'] as $expected) {
    check("audit records $expected", in_array($expected, $actions, true));
}

// ---------------------------------------------------------------
section('Doctor: staff management');
$newUsername = 'staff' . $stamp;
[$status, $res] = http('POST', '/api/users', [
    'name'     => "Test Cashier $stamp",
    'username' => $newUsername,
    'password' => 'temporary123',
    'role'     => 'cashier',
], $doctor);
$staffId = $res['data']['id'] ?? null;
check('doctor creates a staff account (201)', $status === 201 && $staffId, "status=$status msg=" . ($res['message'] ?? ''));

[$status] = http('POST', '/api/users', [
    'name' => 'Duplicate', 'username' => $newUsername, 'password' => 'temporary123', 'role' => 'cashier',
], $doctor);
check('duplicate username rejected (409)', $status === 409, "status=$status");

[$status] = http('PATCH', "/api/users/$doctorId/status", ['status' => 'inactive'], $doctor);
check('doctor cannot deactivate their own account (409)', $status === 409, "status=$status");

[$status] = http('PATCH', "/api/users/$staffId/status", ['status' => 'inactive'], $doctor);
check('doctor deactivates a staff account', $status === 200, "status=$status");

[$status] = http('POST', '/api/auth/login', ['username' => $newUsername, 'password' => 'temporary123']);
check('inactive user cannot sign in (403)', $status === 403, "status=$status");

[$status] = http('POST', "/api/users/$staffId/password", ['password' => 'resetpass123'], $doctor);
check('doctor resets a staff password', $status === 200, "status=$status");

// ---------------------------------------------------------------
section('Clinic settings');
[$status, $res] = http('GET', '/api/settings', null, $doctor);
check('settings readable by doctor', $status === 200 && isset($res['data']['clinic_name']), "status=$status");

[$status, $res] = http('PUT', '/api/settings', [
    'clinic_name'    => 'Meril Medical Centre',
    'address'        => 'No. 42, Galle Road, Colombo 04',
    'phone'          => '+94 11 234 5678',
    'email'          => 'frontdesk@merilmedical.lk',
    'receipt_footer' => 'Thank you. Please follow the doctor\'s advice.',
    'currency'       => 'LKR',
], $doctor);
check('doctor updates settings', $status === 200 && ($res['data']['clinic_name'] ?? '') === 'Meril Medical Centre', "status=$status");

[$status] = http('PUT', '/api/settings', ['clinic_name' => 'Hacked Clinic'], $cashier);
check('cashier cannot update settings (403)', $status === 403, "status=$status");

// ---------------------------------------------------------------
section('Logout');
[$status] = http('POST', '/api/auth/logout', null, $cashier);
check('logout succeeds', $status === 200, "status=$status");
[$status] = http('GET', '/api/auth/me', null, $cashier);
check('token invalid after logout (401)', $status === 401, "status=$status");

// ---------------------------------------------------------------
echo "\n----------------------------------------\n";
echo "PASSED: $pass   FAILED: $fail\n";
if ($failures) {
    echo "\nFailures:\n";
    foreach ($failures as $f) {
        echo "  - $f\n";
    }
    exit(1);
}
echo "All checks passed.\n";
exit(0);
