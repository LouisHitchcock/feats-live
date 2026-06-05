# Article Pipeline Hardening
This repo now uses a single canonical script for article/listing generation:
- `tools/regenerate_all.py`

## What changed
- Consolidated article generation and listing generation into one pipeline.
- Standardized routes to root-relative paths (for example `/music/<slug>`, `/about`, `/contact`).
- Added built-in exclusion of non-article slugs (such as `about`, `contact`, `privacy-policy`, `work-v2`, `member-site-homepage-1`).
- Added automatic deduplication by `url_id`.
- Added stale directory detection and optional prune mode.
- Added legacy route normalization pass for older static article pages.

## Canonical workflow
Use local cleaned article data as source:
```powershell
python tools/regenerate_all.py --source local
```

Regenerate and remove stale directories:
```powershell
python tools/regenerate_all.py --source local --prune
```

Use API data directly:
```powershell
python tools/regenerate_all.py --source api
```

## Current source of truth
- Input source: `api/articles_clean.json` (or API when `--source api` is used)
- Generated outputs:
  - `article_index.json`
  - `music/index.html`
  - `music/<slug>/index.html`

## Removed obsolete tools
The following scripts were deleted because they were legacy wrappers/placeholders and are replaced by the canonical pipeline:
- `tools/gen_pages.py`
- `tools/fix_music_listing.py`
- `tools/fix_paths.py`
- `tools/clean_articles.py`
- `tools/migrate_articles.py`

## Still available tools
- `tools/filter_articles.py` for explicit index filtering and optional API/static cleanup flags.
- `tools/download_all_images.py` and `tools/upload_r2.py` for image migration/upload workflows.
