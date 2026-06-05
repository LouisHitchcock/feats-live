# Feats Static Site
This repository contains the static rebuild of the Feats website, including:
- public site pages (`index.html`, `about/`, `contact/`)
- generated article pages (`music/<slug>/index.html`)
- article index data (`article_index.json`)
- helper scripts for content pipeline and image migration (`tools/`)

## Canonical article pipeline
Use `tools/regenerate_all.py` as the single source of generation for article pages and the listing page.

Generate from local cleaned data:
```powershell
python tools/regenerate_all.py --source local
```

Generate and prune stale article directories:
```powershell
python tools/regenerate_all.py --source local --prune
```

Generate directly from API:
```powershell
python tools/regenerate_all.py --source api
```

## Source of truth
- Input: `api/articles_clean.json` (or API when using `--source api`)
- Output:
  - `article_index.json`
  - `music/index.html`
  - `music/<slug>/index.html`

## Additional tools
- `tools/filter_articles.py`: explicit index filtering and optional API/static cleanup flags.
- `tools/download_all_images.py`: download and localize article-related images from source exports.
- `tools/upload_r2.py`: bulk upload images to the configured R2-backed endpoint.

## Docs
- Detailed pipeline notes: `docs/article-pipeline.md`
