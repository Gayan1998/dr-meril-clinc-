<?php
/**
 * PDO connection factory. One connection per request.
 */

declare(strict_types=1);

function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $config = require __DIR__ . '/config.php';
    $db = $config['db'];

    $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=%s', $db['host'], $db['port'], $db['name'], $db['charset']);

    try {
        $pdo = new PDO($dsn, $db['user'], $db['pass'], [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
        // Keep the DB session on the clinic's configured offset so CURDATE()
        // matches PHP. date('P') is safe to interpolate (e.g. +05:30).
        $offset = date('P');
        if (preg_match('/^[+-]\d{2}:\d{2}$/', $offset)) {
            $pdo->exec("SET time_zone = '{$offset}'");
        }
    } catch (PDOException $e) {
        error_log('[db] connection failed: ' . $e->getMessage());
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'success' => false,
            'message' => 'The service is temporarily unavailable. Please try again shortly.',
        ]);
        exit;
    }

    return $pdo;
}
