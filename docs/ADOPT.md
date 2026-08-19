# ADOPT — wellmanifest/www

This checkout **ADOPT**s pack contracts. It does not HOME them.

| Pack | What this repo takes | What stays in the pack |
| --- | --- | --- |
| `wellmanifest/webpage` | `/sitemap.xml`, `/robots.txt`, site-audit input | Lenses, auditor, propose-only reports |
| `wellmanifest/gui` | `schemas/page.home.json` (`page/v1`, kind `landing`) | Kind enum, visual budgets |
| `wellmanifest/brand` | No second token file | Pointer to `subactor/brand` for product kits |

`index.php` stays a facade. Do not add a wellmanifest daemon here.
Worktree overlap is already covered by `wellmanifest/new-project`
`worktree-guard`.
