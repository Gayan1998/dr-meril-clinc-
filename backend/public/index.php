<?php
/**
 * Front controller. All API traffic enters here.
 *
 * Nothing in this file (or the app) trusts client-supplied financial
 * values. Amounts always come from the database.
 */

declare(strict_types=1);

require __DIR__ . '/../config/config.php';
$config = app_config();

require __DIR__ . '/../config/database.php';
require __DIR__ . '/../core/Response.php';
require __DIR__ . '/../core/Request.php';
require __DIR__ . '/../core/Router.php';

require __DIR__ . '/../helpers/auth.php';
require __DIR__ . '/../helpers/audit.php';
require __DIR__ . '/../helpers/codes.php';
require __DIR__ . '/../helpers/format.php';
require __DIR__ . '/../helpers/validate.php';

require __DIR__ . '/../api/auth.php';
require __DIR__ . '/../api/patients.php';
require __DIR__ . '/../api/visits.php';
require __DIR__ . '/../api/payments.php';
require __DIR__ . '/../api/reports.php';
require __DIR__ . '/../api/dashboard.php';
require __DIR__ . '/../api/audit.php';
require __DIR__ . '/../api/users.php';
require __DIR__ . '/../api/settings.php';

register_error_handlers((bool) $config['debug']);
security_headers();
apply_cors();

$method = request_method();
if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$router = new Router();

// ---- health -------------------------------------------------
$router->add('GET', '/api/health', function (): void {
    json_ok(['status' => 'ok', 'time' => date('c')]);
}, 'public');

// ---- auth ---------------------------------------------------
$router->add('POST', '/api/auth/login', 'auth_login', 'public');
$router->add('POST', '/api/auth/logout', 'auth_logout', 'auth');
$router->add('GET', '/api/auth/me', 'auth_me', 'auth');
$router->add('POST', '/api/auth/change-password', 'auth_change_password', 'auth');

// ---- patients ----------------------------------------------
$router->add('GET', '/api/patients', 'patients_index', 'auth');
$router->add('POST', '/api/patients', 'patients_store', 'doctor');
$router->add('GET', '/api/patients/{id}', 'patients_show', 'auth');

// ---- visits ------------------------------------------------
$router->add('POST', '/api/visits', 'visits_store', 'doctor');
$router->add('GET', '/api/visits', 'visits_index', 'auth');
$router->add('GET', '/api/visits/{id}', 'visits_show', 'auth');
$router->add('POST', '/api/visits/{id}/cancel', 'visits_cancel', 'doctor');

// ---- payments (specific routes first) ----------------------
$router->add('GET', '/api/payments/pending', 'payments_pending', 'auth');
$router->add('POST', '/api/payments/{id}/collect', 'payments_collect', 'cashier');
$router->add('POST', '/api/payments/{id}/void', 'payments_void', 'doctor');
$router->add('GET', '/api/payments', 'payments_index', 'auth');
$router->add('GET', '/api/payments/{id}', 'payments_show', 'auth');

// ---- reports -----------------------------------------------
$router->add('GET', '/api/reports/daily', 'reports_daily', 'auth');
$router->add('GET', '/api/reports/closing', 'reports_closing', 'auth');
$router->add('GET', '/api/reports/activity', 'reports_activity', 'auth');
$router->add('GET', '/api/reports/summary', 'reports_activity', 'auth');

// ---- dashboards --------------------------------------------
$router->add('GET', '/api/dashboard/doctor', 'dashboard_doctor', 'doctor');
$router->add('GET', '/api/dashboard/cashier', 'dashboard_cashier', 'cashier');

// ---- audit -------------------------------------------------
$router->add('GET', '/api/audit-logs', 'audit_index', 'doctor');
$router->add('GET', '/api/audit-logs/actions', 'audit_actions', 'doctor');

// ---- users -------------------------------------------------
$router->add('GET', '/api/users', 'users_index', 'doctor');
$router->add('POST', '/api/users', 'users_store', 'doctor');
$router->add('PATCH', '/api/users/{id}/status', 'users_update_status', 'doctor');
$router->add('POST', '/api/users/{id}/password', 'users_reset_password', 'doctor');

// ---- settings ----------------------------------------------
$router->add('GET', '/api/settings', 'settings_show', 'auth');
$router->add('PUT', '/api/settings', 'settings_update', 'doctor');

$router->dispatch($method, request_uri_path());
