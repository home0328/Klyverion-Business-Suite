<?php
declare(strict_types=1);

if (!defined('WP_UNINSTALL_PLUGIN')) {
    exit;
}

/**
 * Política de Segurança: a desinstalação do Core só remove tabelas se o administrador
 * autorizar explicitamente a flag 'klyverion_purge_on_uninstall'.
 */
if (get_option('klyverion_purge_on_uninstall', false) !== true) {
    return;
}

global $wpdb;
$prefix = $wpdb->prefix . 'klyv_';

$wpdb->query("DROP TABLE IF EXISTS {$prefix}audit_logs");
$wpdb->query("DROP TABLE IF EXISTS {$prefix}modules");
$wpdb->query("DROP TABLE IF EXISTS {$prefix}companies");

delete_option('klyverion_core_db_version');
delete_option('klyverion_active_modules');
delete_option('klyverion_global_settings');
delete_option('klyverion_purge_on_uninstall');
