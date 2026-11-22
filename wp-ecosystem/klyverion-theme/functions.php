<?php
declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Klyverion Theme — Camada 3 (Apresentação Pura).
 * Proibido conter regras de negócio de ERP/CRM neste tema.
 */
add_action('after_setup_theme', static function (): void {
    add_theme_support('title-tag');
    add_theme_support('post-thumbnails');
    add_theme_support('html5', ['search-form', 'gallery', 'caption', 'style', 'script']);
    register_nav_menus([
        'klyv_primary' => __('Navegação Principal Klyverion', 'klyverion-theme'),
    ]);
});

add_action('wp_enqueue_scripts', static function (): void {
    wp_enqueue_style('klyverion-theme-style', get_stylesheet_uri(), [], '1.0.0');
});
