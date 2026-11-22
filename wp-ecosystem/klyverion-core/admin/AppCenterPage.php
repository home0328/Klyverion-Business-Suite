<?php
declare(strict_types=1);

namespace Klyverion\Core\Admin;

use Klyverion\Core\ModuleRegistry;
use Klyverion\Core\Security\CapabilityGuard;

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Tela administrativa do Klyverion App Center no wp-admin.
 */
final class AppCenterPage
{
    public function __construct(
        private readonly ModuleRegistry $registry,
        private readonly CapabilityGuard $guard
    ) {}

    public function register_submenu(): void
    {
        if (!$this->guard->current_user_can('klyv_modules_manage')) {
            return;
        }

        add_submenu_page(
            'klyverion-suite',
            __('App Center', 'klyverion-core'),
            __('App Center', 'klyverion-core'),
            'read',
            'klyverion-app-center',
            [$this, 'render']
        );
    }

    public function render(): void
    {
        if (!$this->guard->current_user_can('klyv_modules_manage')) {
            wp_die(esc_html__('Acesso negado.', 'klyverion-core'), 403);
        }

        $nonce = wp_create_nonce('wp_rest');
        echo '<div class="wrap">';
        echo '<h1>' . esc_html__('Klyverion App Center', 'klyverion-core') . '</h1>';
        echo '<div id="klyverion-app-center-mount" data-rest-nonce="' . esc_attr($nonce) . '"></div>';
        echo '</div>';
    }
}
