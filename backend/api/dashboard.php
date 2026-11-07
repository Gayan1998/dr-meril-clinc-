<?php
/**
 * Role-specific dashboard summaries. Totals are computed server-side.
 */

declare(strict_types=1);

function dashboard_doctor(): void
{
    $user = require_role('doctor');
    $date = valid_date_or_today(query_str('date'));
    $summary = daily_summary($date);

    $stmt = db()->prepare(
        "SELECT v.id, v.visit_number, v.consultation_fee, v.status, v.created_at,
                pt.full_name AS patient_name, pt.patient_code
           FROM visits v JOIN patients pt ON pt.id = v.patient_id
          WHERE v.visit_date = ?
          ORDER BY v.id DESC LIMIT 8"
    );
    $stmt->execute([$date]);
    $recentVisits = array_map(static fn (array $r): array => [
        'id'               => (int) $r['id'],
        'visit_number'     => $r['visit_number'],
        'consultation_fee' => money($r['consultation_fee']),
        'status'           => $r['status'],
        'created_at'       => $r['created_at'],
        'patient_name'     => $r['patient_name'],
        'patient_code'     => $r['patient_code'],
    ], $stmt->fetchAll());

    $stmt = db()->prepare(
        "SELECT pay.id, pay.payment_number, pay.amount, pay.payment_method, pay.paid_at,
                pt.full_name AS patient_name
           FROM payments pay
           JOIN visits v ON v.id = pay.visit_id
           JOIN patients pt ON pt.id = v.patient_id
          WHERE pay.status = 'paid' AND v.visit_date = ?
          ORDER BY pay.id DESC LIMIT 8"
    );
    $stmt->execute([$date]);
    $recentPayments = array_map(static fn (array $r): array => [
        'id'             => (int) $r['id'],
        'payment_number' => $r['payment_number'],
        'amount'         => money($r['amount']),
        'payment_method' => $r['payment_method'],
        'paid_at'        => $r['paid_at'],
        'patient_name'   => $r['patient_name'],
    ], $stmt->fetchAll());

    json_ok([
        'date'            => $date,
        'doctor'          => $user['name'],
        'summary'         => $summary,
        'recent_visits'   => $recentVisits,
        'recent_payments' => $recentPayments,
        'anomalies'       => [
            'pending_visits'   => $summary['visits_pending'],
            'cancelled_visits' => $summary['visits_cancelled'],
            'voided_payments'  => $summary['voided'],
            'uncollected'      => $summary['pending'],
        ],
    ]);
}

function dashboard_cashier(): void
{
    $user = require_role('cashier');
    $date = valid_date_or_today(query_str('date'));
    $summary = daily_summary($date, (int) $user['id']);

    $stmt = db()->prepare(
        "SELECT pay.id, pay.payment_number, pay.amount, pay.payment_method, pay.paid_at,
                pt.full_name AS patient_name
           FROM payments pay
           JOIN visits v ON v.id = pay.visit_id
           JOIN patients pt ON pt.id = v.patient_id
          WHERE pay.status = 'paid' AND pay.collected_by = ? AND pay.payment_date = ?
          ORDER BY pay.id DESC LIMIT 8"
    );
    $stmt->execute([$user['id'], $date]);
    $recentPayments = array_map(static fn (array $r): array => [
        'id'             => (int) $r['id'],
        'payment_number' => $r['payment_number'],
        'amount'         => money($r['amount']),
        'payment_method' => $r['payment_method'],
        'paid_at'        => $r['paid_at'],
        'patient_name'   => $r['patient_name'],
    ], $stmt->fetchAll());

    json_ok([
        'date'            => $date,
        'cashier'         => $user['name'],
        'summary'         => $summary,
        'recent_payments' => $recentPayments,
    ]);
}
