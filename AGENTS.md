# AGENTS.md

`wellmanifest/www` is the org hub at `www.wellmanifest.com`.
It is **not** a second webpage SSOT and **not** a wellmanifest daemon.

| Field | Value |
| --- | --- |
| home | `wellmanifest` |
| shape | `domain_pack` |
| runtimeOwner | `wellmanifest` |
| adopt | `wellmanifest/webpage`, `wellmanifest/gui`, `wellmanifest/brand` |

`shape=runtime_service` must not use `home=wellmanifest`. This checkout is a
static/PHP facade over those packs. Product runtimes (e.g.
`subactor/www-sub-actor`) stay `home=subactor`.

## Rules

1. ADOPT `webpage` for sitemap, robots, and site-audit. Do not invent a
   parallel site-UX standard here.
2. ADOPT `gui` `page/v1` for kind, landmarks and visual budgets. Record the
   page in `schemas/page.home.json`.
3. ADOPT `brand` as a pointer: product tokens HOME in `subactor/brand`.
   Do not add a second palette in a new ticket unless an integration
   workstream re-pins the brand profile.
4. Do not grow `index.php` into another engine. New public routes belong in
   static files (`sitemap.xml`, `robots.txt`) or a dedicated include, not
   more inline discovery logic.
5. No wellmanifest-hosted overlap daemon. Use the adopted
   `worktree-guard` from `wellmanifest/new-project`.
