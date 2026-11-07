<?php
/**
 * Tiny route matcher. Supports {param} segments and a role guard.
 *   public  -> no auth required
 *   auth    -> any logged-in user
 *   doctor  -> doctor only
 *   cashier -> cashier only
 */

declare(strict_types=1);

final class Router
{
    /** @var array<int, array{method:string, regex:string, params:array<int,string>, handler:callable, role:string}> */
    private array $routes = [];

    public function add(string $method, string $pattern, callable $handler, string $role = 'auth'): void
    {
        $params = [];
        $regex = preg_replace_callback('#\{([a-zA-Z_][a-zA-Z0-9_]*)\}#', function ($m) use (&$params) {
            $params[] = $m[1];
            return '([^/]+)';
        }, $pattern);

        $this->routes[] = [
            'method'  => strtoupper($method),
            'regex'   => '#^' . $regex . '$#',
            'params'  => $params,
            'handler' => $handler,
            'role'    => $role,
        ];
    }

    public function dispatch(string $method, string $path): void
    {
        foreach ($this->routes as $route) {
            if ($route['method'] !== $method) {
                continue;
            }
            if (!preg_match($route['regex'], $path, $matches)) {
                continue;
            }
            array_shift($matches);
            $args = array_map('urldecode', $matches);

            guard($route['role']);

            ($route['handler'])(...$args);
            return;
        }
        json_err('Endpoint not found.', 404);
    }
}
