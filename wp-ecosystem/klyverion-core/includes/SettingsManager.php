<?php
declare(strict_types=1);

namespace Klyverion\Core;

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Gerenciador de configurações globais e parâmetros multiempresa do Core.
 */
final class SettingsManager
{
    private const OPTION_KEY = 'klyverion_global_settings';

    /** @return array<string, mixed> */
    public function all(): array
    {
        $defaults = [
            'platform_name'       => 'Klyverion Business Suite',
            'platform_slogan'     => 'One Platform. Every Business Operation.',
            'default_currency'    => 'BRL',
            'default_timezone'    => 'America/Sao_Paulo',
            'data_retention_days' => 1825,
            'default_theme'       => 'light',
        ];

        $saved = get_option(self::OPTION_KEY, []);
        return is_array($saved) ? array_merge($defaults, $saved) : $defaults;
    }

    public function get(string $key, mixed $default = null): mixed
    {
        $all = $this->all();
        return $all[$key] ?? $default;
    }

    /** @param array<string, mixed> $values */
    public function update(array $values): bool
    {
        $current = $this->all();
        $sanitized = [
            'platform_name'       => sanitize_text_field((string) ($values['platform_name'] ?? $current['platform_name'])),
            'platform_slogan'     => sanitize_text_field((string) ($values['platform_slogan'] ?? $current['platform_slogan'])),
            'default_currency'    => in_array($values['default_currency'] ?? '', ['BRL', 'USD', 'EUR'], true)
                ? $values['default_currency']
                : $current['default_currency'],
            'default_timezone'    => sanitize_text_field((string) ($values['default_timezone'] ?? $current['default_timezone'])),
            'data_retention_days' => max(30, min(3650, (int) ($values['data_retention_days'] ?? $current['data_retention_days']))),
            'default_theme'       => in_array($values['default_theme'] ?? '', ['light', 'dark'], true)
                ? $values['default_theme']
                : $current['default_theme'],
        ];

        return update_option(self::OPTION_KEY, $sanitized, false);
    }
}
