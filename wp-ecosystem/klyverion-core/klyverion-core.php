<?php
/**
 * Plugin Name:       Klyverion Core
 * Plugin URI:        https://klyverion.com/business-suite
 * Description:       Núcleo obrigatório do Klyverion Business Suite. Gerencia registro de módulos, barramento de eventos, RBAC, migrações de banco, REST API v1, auditoria e diagnósticos.
 * Version:           1.0.0
 * Requires at least: 6.4
 * Requires PHP:      8.2
 * Author:            Klyverion Engineering
 * License:           GPL-2.0-or-later
 * Text Domain:       klyverion-core
 * Domain Path:       /languages
 */

declare(strict_types=1);

namespace Klyverion\Core;

if (!defined('ABSPATH')) {
    exit;
}

define('KLYVERION_CORE_VERSION', '1.0.0');
define('KLYVERION_CORE_PATH', plugin_dir_path(__FILE__));
define('KLYVERION_CORE_URL', plugin_dir_url(__FILE__));

require_once KLYVERION_CORE_PATH . 'interfaces/ModuleContract.php';
require_once KLYVERION_CORE_PATH . 'includes/EventBus.php';
require_once KLYVERION_CORE_PATH . 'includes/SettingsManager.php';
require_once KLYVERION_CORE_PATH . 'includes/ModuleRegistry.php';
require_once KLYVERION_CORE_PATH . 'security/CapabilityGuard.php';
require_once KLYVERION_CORE_PATH . 'database/SchemaMigrator.php';
require_once KLYVERION_CORE_PATH . 'api/RestRouter.php';
require_once KLYVERION_CORE_PATH . 'admin/AppCenterPage.php';

final class Kernel
{
    private static ?self $instance = null;

    public readonly EventBus $events;
    public readonly SettingsManager $settings;
    public readonly ModuleRegistry $modules;
    public readonly Security\CapabilityGuard $guard;
    public readonly Database\SchemaMigrator $migrator;
    public readonly Api\RestRouter $rest;
    public readonly Admin\AppCenterPage $app_center;

    private function __construct()
    {
        $this->events     = new EventBus();
        $this->settings   = new SettingsManager();
        $this->migrator   = new Database\SchemaMigrator();
        $this->guard      = new Security\CapabilityGuard();
        $this->modules    = new ModuleRegistry($this->events, $this->guard);
        $this->rest       = new Api\RestRouter($this->modules, $this->guard);
        $this->app_center = new Admin\AppCenterPage($this->modules, $this->guard);
    }

    public static function instance(): self
    {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    public function boot(): void
    {
        add_action('init', [$this->guard, 'register_default_roles'], 5);
        add_action('plugins_loaded', [$this, 'discover_modules'], 20);
        add_action('rest_api_init', [$this->rest, 'register_routes']);
        add_action('admin_menu', [$this, 'register_central_menu']);
        add_action('admin_menu', [$this->app_center, 'register_submenu'], 15);
    }

    public function discover_modules(): void
    {
        /**
         * Permite que plugins modulares independentes se registrem no Klyverion Core
         * exclusivamente por meio do contrato público ModuleContract.
         */
        do_action('klyverion_register_modules', $this->modules);
        $this->modules->boot_active_modules();
    }

    public function register_central_menu(): void
    {
        if (!$this->guard->current_user_can('klyv_core_view')) {
            return;
        }

        add_menu_page(
            __('Klyverion Suite', 'klyverion-core'),
            __('Klyverion', 'klyverion-core'),
            'read',
            'klyverion-suite',
            [$this, 'render_shell_mount'],
            'dashicons-grid-view',
            3
        );
    }

    public function render_shell_mount(): void
    {
        $nonce = wp_create_nonce('wp_rest');
        echo '<div id="klyverion-suite-root" data-rest-nonce="' . esc_attr($nonce) . '"></div>';
    }
}

register_activation_hook(__FILE__, static function (): void {
    $kernel = Kernel::instance();
    $kernel->migrator->migrate();
    $kernel->guard->register_default_roles();
});

register_deactivation_hook(__FILE__, static function (): void {
    // Política de Segurança: desativar o Core nunca apaga tabelas de negócios.
    flush_rewrite_rules();
});

Kernel::instance()->boot();
