from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path

import requests

REPO_ROOT = Path(__file__).resolve().parents[1]
API_ARTICLES_PATH = REPO_ROOT / "api" / "articles_clean.json"
INDEX_PATH = REPO_ROOT / "article_index.json"
MUSIC_DIR = REPO_ROOT / "music"
API_URL = "https://feats-api.fpvgate-analytics.workers.dev/api/articles"

EXCLUDED_URL_IDS = {
    "about",
    "contact",
    "privacy-policy",
    "youth-development",
    "work-v2",
    "workv2",
    "member-site-homepage-1",
    "membersite-home-page-1",
}


def main() -> int:
    parser = argparse.ArgumentParser(description="Filter non-article pages out of article_index.json.")
    parser.add_argument("--seed-api", action="store_true", help="POST filtered articles back to the remote API.")
    parser.add_argument("--delete-static", action="store_true", help="Delete excluded /music/<slug>/ directories.")
    args = parser.parse_args()

    with API_ARTICLES_PATH.open("r", encoding="utf-8") as handle:
        articles = json.load(handle)

    filtered = [article for article in articles if article.get("url_id") not in EXCLUDED_URL_IDS]
    print(f"Filtered: {len(filtered)} articles (removed {len(articles) - len(filtered)})")

    index = []
    for article in filtered:
        index.append(
            {
                "url_id": article.get("url_id", ""),
                "title": article.get("title", ""),
                "excerpt": article.get("excerpt", ""),
                "author": article.get("author", "Feats."),
                "publish_date": article.get("publish_date", ""),
                "categories": article.get("categories", ""),
                "cover_url": article.get("cover_url", ""),
            }
        )
    INDEX_PATH.write_text(json.dumps(index, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {INDEX_PATH}")

    if args.seed_api:
        seeded = 0
        for article in filtered:
            response = requests.post(API_URL, json=article, timeout=30)
            if response.status_code == 201:
                seeded += 1
        print(f"Seeded {seeded} filtered articles to API")

    if args.delete_static:
        deleted = 0
        for url_id in EXCLUDED_URL_IDS:
            dir_path = MUSIC_DIR / url_id
            if dir_path.exists():
                shutil.rmtree(dir_path)
                deleted += 1
        print(f"Removed {deleted} static directories")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
