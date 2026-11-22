<?php
declare(strict_types=1);

namespace Klyverion\Core\Security;

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Controle de acesso granular (RBAC) e trilha de auditoria no servidor.
 */
final class CapabilityGuard
{
    public const INITIAL_ROLES = [
        'klyv_superadmin'      => 'Superadministrador',
        'klyv_company_admin'   => 'Administrador empresarial',
        'klyv_manager'         => 'Gerente',
        'klyv_finance'         => 'Financeiro',
        'klyv_sales'           => 'Comercial',
        'klyv_hr'              => 'Recursos humanos',
        'klyv_warehouse'       => 'Estoquista',
        'klyv_support'         => 'Atendente',
        'klyv_employee'        => 'Funcionário',
    ];

    public function register_default_roles(): void
    {
        $admin = get_role('administrator');
        if ($admin !== null) {
            $admin->add_cap('klyv_core_view');
            $admin->add_cap('klyv_core_admin');
            $admin->add_cap('klyv_modules_manage');
            $admin->add_cap('klyv_rbac_manage');
        }

        foreach (self::INITIAL_ROLES as $role_slug => $role_name) {
            if (get_role($role_slug) === null) {
                add_role($role_slug, $role_name, ['read' => true, 'klyv_core_view' => true]);
            }
        }
    }

    public function current_user_can(string $capability, ?int $company_id = null): bool
    {
        if (!is_user_logged_in()) {
            return false;
        }
        $user_id = get_current_user_id();
        if ($company_id !== null && !$this->user_belongs_to_company($user_id, $company_id)) {
            return false;
        }
        return user_can($user_id, 'manage_options') || user_can($user_id, $capability);
    }

    private function user_belongs_to_company(int $user_id, int $company_id): bool
    {
        $assigned = (int) get_user_meta($user_id, 'klyv_company_id', true);
        return $assigned === 0 || $assigned === $company_id;
    }

    /** @param array<string, mixed> $metadata */
    public function log_audit(string $action, string $resource_type, string $resource_id, array $metadata = []): void
    {
        global $wpdb;
        $table = $wpdb->prefix . 'klyv_audit_logs';
        $wpdb->insert(
            $table,
            [
                'actor_user_id' => get_current_user_id(),
                'action'        => sanitize_text_field($action),
                'resource_type' => sanitize_key($resource_type),
                'resource_id'   => sanitize_text_field($resource_id),
                'ip_address'    => sanitize_text_field($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0'),
                'metadata_json' => wp_json_encode($metadata),
                'created_at'    => current_time('mysql', true),
            ],
            ['%d', '%s', '%s', '%s', '%s', '%s', '%s']
        );
    }
}
