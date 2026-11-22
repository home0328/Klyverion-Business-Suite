<?php
declare(strict_types=1);

if (!defined('WP_UNINSTALL_PLUGIN')) {
    exit;
}

// Preserva dados do CRM por padrão na remoção, salvo confirmação explícita.
if (get_option('klyverion_crm_purge_on_uninstall', false) !== true) {
    return;
}

delete_option('klyverion_crm_purge_on_uninstall');
