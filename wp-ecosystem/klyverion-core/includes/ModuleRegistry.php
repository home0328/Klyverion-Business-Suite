<?php
declare(strict_types=1);

namespace Klyverion\Core;

use Klyverion\Core\Interfaces\ModuleContract;
use Klyverion\Core\Security\CapabilityGuard;

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Gerenciador de registro, dependências e ciclo de vida dos módulos (App Center).
 */
final class ModuleRegistry
{
    /** @var array<string, ModuleContract> */
    private array $registered = [];

    /** @var array<string, bool> */
    private array $active_map = [];

    public function __construct(
        private readonly EventBus $events,
        private readonly CapabilityGuard $guard
    ) {
        $saved = get_option('klyverion_active_modules', []);
        $this->active_map = is_array($saved) ? $saved : [];
    }

    public function register(ModuleContract $module): void
    {
        $slug = sanitize_key($module->get_slug());
        if (isset($this->registered[$slug])) {
            return;
        }
        $this->registered[$slug] = $module;
    }

    public function boot_active_modules(): void
    {
        foreach ($this->registered as $slug => $module) {
            if (!$this->is_active($slug)) {
                continue;
            }
            if ($this->check_dependencies($slug) !== []) {
                continue;
            }
            $module->boot();
        }
    }

    public function is_active(string $slug): bool
    {
        return !empty($this->active_map[$slug]);
    }

    /** @return string[] Slugs de dependências ausentes ou inativas. */
    public function check_dependencies(string $slug): array
    {
        if (!isset($this->registered[$slug])) {
            return ['module_not_registered'];
        }
        $missing = [];
        foreach ($this->registered[$slug]->get_dependencies() as $dep) {
            if (!isset($this->registered[$dep]) || !$this->is_active($dep)) {
                $missing[] = $dep;
            }
        }
        return $missing;
    }

    /** @return array{ok: bool, error?: string, missing?: string[]} */
    public function activate_module(string $slug): array
    {
        if (!isset($this->registered[$slug])) {
            return ['ok' => false, 'error' => 'Módulo não encontrado.'];
        }
        $missing = $this->check_dependencies($slug);
        if ($missing !== []) {
            return ['ok' => false, 'error' => 'Dependências inativas.', 'missing' => $missing];
        }

        $module = $this->registered[$slug];
        if (version_compare(KLYVERION_CORE_VERSION, $module->get_min_core_version(), '<')) {
            return ['ok' => false, 'error' => 'Versão do Klyverion Core incompatível.'];
        }

        $module->activate();
        $this->active_map[$slug] = true;
        update_option('klyverion_active_modules', $this->active_map, false);
        $this->guard->log_audit('module.activated', 'module', $slug, ['version' => $module->get_version()]);
        $this->events->dispatch('klyverion.module.activated', ['slug' => $slug]);

        return ['ok' => true];
    }

    /** @return array{ok: bool, error?: string, dependents?: string[]} */
    public function deactivate_module(string $slug, bool $purge_data = false): array
    {
        if (!isset($this->registered[$slug])) {
            return ['ok' => false, 'error' => 'Módulo não encontrado.'];
        }

        $dependents = [];
        foreach ($this->registered as $other_slug => $other) {
            if ($this->is_active($other_slug) && in_array($slug, $other->get_dependencies(), true)) {
                $dependents[] = $other_slug;
            }
        }
        if ($dependents !== []) {
            return ['ok' => false, 'error' => 'Outros módulos ativos dependem deste módulo.', 'dependents' => $dependents];
        }

        // Nunca apaga dados automaticamente na desativação padrão ($purge_data === false).
        $this->registered[$slug]->deactivate($purge_data);
        $this->active_map[$slug] = false;
        update_option('klyverion_active_modules', $this->active_map, false);
        $this->guard->log_audit('module.deactivated', 'module', $slug, ['purged' => $purge_data]);
        $this->events->dispatch('klyverion.module.deactivated', ['slug' => $slug, 'purged' => $purge_data]);

        return ['ok' => true];
    }
}
