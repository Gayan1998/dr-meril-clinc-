<?php
/**
 * Shared read helpers: clinic settings, pagination.
 */

declare(strict_types=1);

function clinic_settings(): array
{
    static $settings = null;
    if (is_array($settings)) {
        return $settings;
    }
    $row = db()->query('SELECT clinic_name, address, phone, email, logo_url, receipt_footer, currency FROM clinic_settings WHERE id = 1')->fetch();
    $settings = $row ?: [
        'clinic_name'    => 'Clinic',
        'address'        => '',
        'phone'          => '',
        'email'          => '',
        'logo_url'       => '',
        'receipt_footer' => '',
        'currency'       => 'LKR',
    ];
    return $settings;
}

/**
 * @return array{page:int, per_page:int, offset:int}
 */
function pagination(int $defaultPerPage = 20, int $maxPerPage = 100): array
{
    $page = max(1, query_int('page', 1));
    $perPage = query_int('per_page', $defaultPerPage);
    $perPage = max(1, min($maxPerPage, $perPage));
    return [
        'page'     => $page,
        'per_page' => $perPage,
        'offset'   => ($page - 1) * $perPage,
    ];
}

function money(float|string $amount): float
{
    return round((float) $amount, 2);
}
