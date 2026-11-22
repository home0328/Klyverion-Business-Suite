<?php
declare(strict_types=1);

namespace Klyverion\Core;

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Barramento desacoplado de eventos entre módulos independentes.
 */
final class EventBus
{
    /** @var array<string, array<int, callable>> */
    private array $listeners = [];

    public function subscribe(string $event_name, callable $handler, int $priority = 10): void
    {
        $this->listeners[$event_name][] = $handler;
        add_action('klyv_event_' . sanitize_key($event_name), $handler, $priority, 1);
    }

    /** @param array<string, mixed> $payload */
    public function dispatch(string $event_name, array $payload = []): void
    {
        $envelope = [
            'event'      => $event_name,
            'timestamp'  => gmdate('c'),
            'company_id' => (int) ($payload['company_id'] ?? 1),
            'payload'    => $payload,
        ];

        do_action('klyv_event_' . sanitize_key($event_name), $envelope);
    }
}
