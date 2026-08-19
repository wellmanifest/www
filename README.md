# wellmanifest — Projects Hub

Org hub for [www.wellmanifest.com](https://www.wellmanifest.com/).
Single-file PHP facade. Standards live in adopted packs, not in this engine.

| Field | Value |
| --- | --- |
| home | `wellmanifest` |
| shape | `domain_pack` |
| adopt | `wellmanifest/webpage`, `wellmanifest/gui`, `wellmanifest/brand` |

See [AGENTS.md](AGENTS.md) and [docs/ADOPT.md](docs/ADOPT.md).

## Quickstart

```bash
php -S 127.0.0.1:8099 -t .
```

- `/` — hub
- `/sitemap.xml`, `/robots.txt` — webpage adopt (static)
- `/?org=wellmanifest` — org selector
