<?php
/**
 * Atomic sequence generators for human readable codes.
 * Uses UPDATE ... LAST_INSERT_ID(value+1) which is atomic per row.
 */

declare(strict_types=1);

function next_counter(string $name): int
{
    // Single atomic statement: safe under concurrent first use of a counter.
    // LAST_INSERT_ID(expr) returns the new value on update; on a fresh insert
    // it is 0, so the value is 1.
    $stmt = db()->prepare(
        'INSERT INTO counters (name, value) VALUES (?, 1)
         ON DUPLICATE KEY UPDATE value = LAST_INSERT_ID(value + 1)'
    );
    $stmt->execute([$name]);
    $value = (int) db()->lastInsertId();
    return $value > 0 ? $value : 1;
}

function make_patient_code(): string
{
    return 'P' . str_pad((string) next_counter('patient_code'), 6, '0', STR_PAD_LEFT);
}

function make_visit_number(?string $date = null): string
{
    $date = $date ?: date('Y-m-d');
    $seq = next_counter('visit_number:' . str_replace('-', '', $date));
    return 'V-' . str_replace('-', '', $date) . '-' . str_pad((string) $seq, 4, '0', STR_PAD_LEFT);
}

function make_payment_number(?string $date = null): string
{
    $date = $date ?: date('Y-m-d');
    $seq = next_counter('payment_number:' . str_replace('-', '', $date));
    return 'R-' . str_replace('-', '', $date) . '-' . str_pad((string) $seq, 5, '0', STR_PAD_LEFT);
}
