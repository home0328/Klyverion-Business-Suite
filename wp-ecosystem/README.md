# Klyverion Business Suite — Pacote WordPress (Fase 1)

**Slogan:** One Platform. Every Business Operation.

## Conteúdo do Pacote

- `klyverion-core/` — Plugin núcleo obrigatório (`wp-content/plugins/klyverion-core/`)
- `klyverion-crm/` — Módulo 01 independente implementando `ModuleContract` (`wp-content/plugins/klyverion-crm/`)
- `klyverion-theme/` — Tema desacoplado com Design System Light/Dark (`wp-content/themes/klyverion-theme/`)

## Requisitos

- WordPress 6.4 ou superior
- PHP 8.2 ou superior
- MySQL 8.0+ / MariaDB 10.6+

## Instalação no WordPress

1. Copie `klyverion-core/` e `klyverion-crm/` para `wp-content/plugins/`.
2. Copie `klyverion-theme/` para `wp-content/themes/`.
3. No painel administrativo do WordPress (**Plugins**), ative primeiro **Klyverion Core** e em seguida **Klyverion CRM**.
4. Em **Aparência → Temas**, ative **Klyverion Business Theme**.
5. Acesse o menu **Klyverion → App Center** para gerenciar módulos.
