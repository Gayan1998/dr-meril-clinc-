<?php
/**
 * Input validation. Every trust boundary goes through here.
 */

declare(strict_types=1);

function v_str(string $key, string $label, int $min = 1, int $max = 255, bool $required = true): ?string
{
    $value = input($key);
    if ($value === null || (is_string($value) && trim($value) === '')) {
        if ($required) {
            json_err("$label is required.", 422, [$key => "$label is required."]);
        }
        return null;
    }
    if (!is_string($value)) {
        json_err("$label is invalid.", 422, [$key => "$label is invalid."]);
    }
    $value = trim($value);
    $len = mb_strlen($value);
    if ($len < $min) {
        json_err("$label is too short.", 422, [$key => "$label must be at least $min characters."]);
    }
    if ($len > $max) {
        json_err("$label is too long.", 422, [$key => "$label must be at most $max characters."]);
    }
    return $value;
}

function v_money(string $key, string $label, float $min = 0.01, float $max = 1000000): float
{
    $value = input($key);
    if ($value === null || $value === '') {
        json_err("$label is required.", 422, [$key => "$label is required."]);
    }
    if (!is_numeric($value)) {
        json_err("$label must be a number.", 422, [$key => "$label must be a number."]);
    }
    $amount = round((float) $value, 2);
    if ($amount < $min) {
        json_err("$label must be at least " . number_format($min, 2) . ".", 422, [$key => "$label is too low."]);
    }
    if ($amount > $max) {
        json_err("$label is too large.", 422, [$key => "$label is too large."]);
    }
    return $amount;
}

function v_enum(string $key, array $allowed, string $label, ?string $default = null): string
{
    $value = input($key, $default);
    if ($value === null || $value === '') {
        json_err("$label is required.", 422, [$key => "$label is required."]);
    }
    if (!in_array($value, $allowed, true)) {
        json_err("$label is invalid.", 422, [$key => "$label is invalid."]);
    }
    return (string) $value;
}

function v_date(string $key, string $label, bool $required = true): ?string
{
    $value = input($key);
    if ($value === null || $value === '') {
        if ($required) {
            json_err("$label is required.", 422, [$key => "$label is required."]);
        }
        return null;
    }
    $d = DateTime::createFromFormat('Y-m-d', (string) $value);
    if (!$d || $d->format('Y-m-d') !== $value) {
        json_err("$label must be a valid date (YYYY-MM-DD).", 422, [$key => "$label is invalid."]);
    }
    return (string) $value;
}

function valid_date_or_today(?string $value): string
{
    if ($value === null || $value === '') {
        return date('Y-m-d');
    }
    $d = DateTime::createFromFormat('Y-m-d', $value);
    if (!$d || $d->format('Y-m-d') !== $value) {
        json_err('Invalid date filter. Use YYYY-MM-DD.', 422);
    }
    return $value;
}
