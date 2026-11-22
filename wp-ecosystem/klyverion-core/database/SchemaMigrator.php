<?php
declare(strict_types=1);

namespace Klyverion\Core\Database;

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Gerencia tabelas dedicadas (wp_klyv_*) com integridade referencial, índices e migrações.
 */
final class SchemaMigrator
{
    public function migrate(): void
    {
        global $wpdb;
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';

        $charset = $wpdb->get_charset_collate();
        $prefix  = $wpdb->prefix . 'klyv_';

        $sql = "
        CREATE TABLE {$prefix}companies (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            legal_name VARCHAR(180) NOT NULL,
            trade_name VARCHAR(180) NOT NULL,
            tax_id VARCHAR(32) DEFAULT NULL,
            currency CHAR(3) NOT NULL DEFAULT 'BRL',
            timezone VARCHAR(64) NOT NULL DEFAULT 'America/Sao_Paulo',
            status VARCHAR(20) NOT NULL DEFAULT 'active',
            created_at DATETIME NOT NULL,
            PRIMARY KEY (id),
            KEY idx_company_status (status)
        ) {$charset};

        CREATE TABLE {$prefix}modules (
            slug VARCHAR(64) NOT NULL,
            name VARCHAR(120) NOT NULL,
            version VARCHAR(24) NOT NULL,
            phase TINYINT UNSIGNED NOT NULL DEFAULT 1,
            status VARCHAR(20) NOT NULL DEFAULT 'inactive',
            settings_json LONGTEXT NULL,
            updated_at DATETIME NOT NULL,
            PRIMARY KEY (slug),
            KEY idx_module_status (status)
        ) {$charset};

        CREATE TABLE {$prefix}audit_logs (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            actor_user_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
            company_id BIGINT UNSIGNED NULL,
            action VARCHAR(80) NOT NULL,
            resource_type VARCHAR(60) NOT NULL,
            resource_id VARCHAR(80) NOT NULL,
            ip_address VARCHAR(45) NOT NULL,
            metadata_json LONGTEXT NULL,
            created_at DATETIME NOT NULL,
            PRIMARY KEY (id),
            KEY idx_audit_actor (actor_user_id),
            KEY idx_audit_action (action),
            KEY idx_audit_created (created_at)
        ) {$charset};
        ";

        dbDelta($sql);
        update_option('klyverion_core_db_version', '1.0.0', false);
    }
}
