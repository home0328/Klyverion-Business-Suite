<?php
declare(strict_types=1);

namespace Klyverion\Core\Api;

use Klyverion\Core\ModuleRegistry;
use Klyverion\Core\Security\CapabilityGuard;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Roteador REST API versionado (/wp-json/klyverion/v1/*).
 */
final class RestRouter
{
    private const NAMESPACE = 'klyverion/v1';

    public function __construct(
        private readonly ModuleRegistry $modules,
        private readonly CapabilityGuard $guard
    ) {}

    public function register_routes(): void
    {
        register_rest_route(self::NAMESPACE, '/modules/(?P<slug>[a-z0-9-]+)/toggle', [
            'methods'             => 'POST',
            'callback'            => [$this, 'handle_toggle_module'],
            'permission_callback' => fn() => $this->guard->current_user_can('klyv_modules_manage'),
        ]);
    }

    public function handle_toggle_module(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        $slug   = sanitize_key((string) $request->get_param('slug'));
        $action = sanitize_key((string) $request->get_param('action'));

        $result = $action === 'activate'
            ? $this->modules->activate_module($slug)
            : $this->modules->deactivate_module($slug, false);

        if (!$result['ok']) {
            return new WP_Error('klyverion_module_error', $result['error'] ?? 'Falha na operação.', ['status' => 409, 'details' => $result]);
        }

        return new WP_REST_Response(['ok' => true, 'slug' => $slug, 'action' => $action], 200);
    }
}
