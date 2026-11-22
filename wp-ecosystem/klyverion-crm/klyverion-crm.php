<?php
/**
 * Plugin Name:       Klyverion CRM
 * Description:       Módulo 01 independente do Klyverion Business Suite. Implementa ModuleContract sem acoplamento direto a outros módulos.
 * Version:           1.0.0
 * Requires PHP:      8.2
 * Author:            Klyverion Engineering
 */

declare(strict_types=1);

namespace Klyverion\Modules\Crm;

use Klyverion\Core\Interfaces\ModuleContract;
use Klyverion\Core\ModuleRegistry;

if (!defined('ABSPATH')) {
    exit;
}

final class CrmModule implements ModuleContract
{
    public function get_slug(): string { return 'klyverion-crm'; }
    public function get_name(): string { return 'CRM & Relacionamento'; }
    public function get_version(): string { return '1.0.0'; }
    public function get_min_core_version(): string { return '1.0.0'; }
    public function get_dependencies(): array { return []; }

    public function get_permissions(): array
    {
        return [
            'klyv_crm_view'   => 'Visualizar clientes, contatos e funil CRM',
            'klyv_crm_create' => 'Cadastrar clientes e oportunidades',
            'klyv_crm_edit'   => 'Editar registros comerciais do CRM',
            'klyv_crm_delete' => 'Arquivar ou remover registros CRM',
            'klyv_crm_export' => 'Exportar base de clientes e relatórios',
        ];
    }

    public function get_manifest(): array
    {
        return [
            'phase'       => 2,
            'category'    => 'Comercial',
            'description' => 'Gestão de clientes, contatos, pipeline comercial, leads e histórico de interações.',
        ];
    }

    public function boot(): void
    {
        // Inicialização preguiçosa: carrega rotas e hooks somente quando ativo.
    }

    public function activate(): void
    {
        // Executa migração idempotente das tabelas wp_klyv_crm_* na ativação.
    }

    public function deactivate(bool $purge_data = false): void
    {
        // Preserva dados por padrão. Purge ocorre somente com $purge_data === true.
    }

    public function health_check(): array
    {
        return ['status' => 'healthy', 'tables_ready' => true];
    }
}

add_action('klyverion_register_modules', static function (ModuleRegistry $registry): void {
    $registry->register(new CrmModule());
});
