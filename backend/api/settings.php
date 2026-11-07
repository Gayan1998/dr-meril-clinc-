<?php
/**
 * Clinic settings. Readable by any signed-in user (receipts need them),
 * editable by a doctor only.
 */

declare(strict_types=1);

function settings_show(): void
{
    require_login();
    json_ok(clinic_settings());
}

function settings_update(): void
{
    $user = require_role('doctor');

    $clinicName = v_str('clinic_name', 'Clinic name', 2, 160);
    $address = v_str('address', 'Address', 0, 255, false) ?? '';
    $phone = v_str('phone', 'Phone', 0, 60, false) ?? '';
    $email = v_str('email', 'Email', 0, 120, false) ?? '';
    $logoUrl = v_str('logo_url', 'Logo URL', 0, 255, false) ?? '';
    $footer = v_str('receipt_footer', 'Receipt footer', 0, 255, false) ?? '';
    $currency = v_str('currency', 'Currency', 2, 10) ?? 'LKR';

    db()->prepare(
        'UPDATE clinic_settings
            SET clinic_name = ?, address = ?, phone = ?, email = ?, logo_url = ?, receipt_footer = ?, currency = ?
          WHERE id = 1'
    )->execute([$clinicName, $address, $phone, $email, $logoUrl, $footer, $currency]);

    audit('SETTINGS_UPDATED', 'clinic_settings', 1, null, ['clinic_name' => $clinicName, 'currency' => $currency], $user['id']);

    json_ok(clinic_settings(), 'Clinic settings saved.');
}
