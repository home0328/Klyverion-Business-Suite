<?php
declare(strict_types=1);

namespace Klyverion\Core\Interfaces;

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Contrato obrigatório para todos os módulos independentes do Klyverion Business Suite.
 * Nenhum módulo pode importar arquivos internos de outro módulo.
 */
interface ModuleContract
{
    public function get_slug(): string;

    public function get_name(): string;

    public function get_version(): string;

    public function get_min_core_version(): string;

    /** @return string[] Lista de slugs de módulos dos quais este módulo depende. */
    public function get_dependencies(): array;

    /** @return array<string, string> Mapa de capability_key => descrição legível. */
    public function get_permissions(): array;

    /** @return array<string, mixed> Metadados para exibição no Klyverion App Center. */
    public function get_manifest(): array;

    public function boot(): void;

    public function activate(): void;

    /**
     * @param bool $purge_data Somente true mediante confirmação explícita e opção de backup.
     */
    public function deactivate(bool $purge_data = false): void;

    public function health_check(): array;
}
