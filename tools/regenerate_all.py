from __future__ import annotations

import argparse
import html
import json
import re
import shutil
from datetime import datetime
from pathlib import Path

import requests

REPO_ROOT = Path(__file__).resolve().parents[1]
MUSIC_DIR = REPO_ROOT / "music"
INDEX_JSON_PATH = REPO_ROOT / "article_index.json"
API_ARTICLES_PATH = REPO_ROOT / "api" / "articles_clean.json"
DEFAULT_API_URL = "https://feats-api.fpvgate-analytics.workers.dev/api/articles"
DEFAULT_COVER = "https://feats-api.fpvgate-analytics.workers.dev/images/hero-3.jpg"

EXCLUDED_URL_IDS = {
    "about",
    "contact",
    "privacy-policy",
    "youth-development",
    "work-v2",
    "member-site-homepage-1",
    "membersite-home-page-1",
}

ARTICLE_STYLE = """  <style>
    .article-body{max-width:750px;margin:0 auto;padding:3rem 2rem}
    .article-body .featured-img{width:100%;height:auto;margin-bottom:2rem}
    .article-body h1{font-size:2.2rem;margin-bottom:.5rem;line-height:1.2}
    .article-body .meta{font-size:.8rem;opacity:.5;text-transform:uppercase;letter-spacing:1px;margin-bottom:2rem}
    .article-body p{font-size:1.05rem;opacity:.85;margin-bottom:1.5rem;line-height:1.8}
    .article-body img{max-width:100%;height:auto;border-radius:4px}
    .article-body a{text-decoration:underline;opacity:.8}
    .article-body a:hover{opacity:1}
    .img-wrap-right{float:right;width:45%;margin:0.5rem 0 0.5rem 1.5rem}
    .img-wrap-left{float:left;width:45%;margin:0.5rem 1.5rem 0.5rem 0}
    @media(max-width:600px){.img-wrap-right,.img-wrap-left{float:none;width:100%;margin:1rem 0}}
  </style>"""


def render_header(music_active: bool) -> str:
    music_link = '<a href="/music" class="active" aria-current="page">Music</a>' if music_active else '<a href="/music">Music</a>'
    return f"""<header class="site-header">
    <a href="/" class="site-logo">Feats.</a>
    <button class="nav-toggle" id="navToggle" aria-label="Toggle menu">&#9776;</button>
    <nav class="nav-links" id="navLinks">
      {music_link}
      <a href="/about">About</a>
      <a href="/contact">Contact</a>
      <div class="social-links">
        <a href="https://www.instagram.com/feats.live/" target="_blank" rel="noopener" aria-label="Instagram">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="#0a0a0a"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
        </a>
        <a href="https://www.youtube.com/@FeatsLive" target="_blank" rel="noopener" aria-label="YouTube">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="#0a0a0a"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
        </a>
      </div>
    </nav>
  </header>"""


FOOTER = """<footer class="site-footer">
    <div class="brand">Feats.</div>
    <div class="info"><a href="mailto:Info@Feats.Live">Info@Feats.Live</a> &nbsp;|&nbsp; <a href="https://www.instagram.com/feats.live/" target="_blank" rel="noopener">Instagram</a> &nbsp;|&nbsp; <a href="https://www.youtube.com/@FeatsLive" target="_blank" rel="noopener">YouTube</a></div>
    <div class="info">Brighton and London Based</div>
    <div class="info">&copy; 2026 FEATS LIVE CIC | Company Number: 16660624</div>
    <div class="footer-links">
      <a href="/youth-development">Youth Development Programme</a>
      <a href="/s/Feats-Contributor-Code-of-Conduct-V3.pdf">Contributor Code of Conduct</a>
      <a href="/privacy-policy">Privacy Policy</a>
      <a href="/sitemap.xml">Sitemap</a>
      <a href="/robots.txt">Robots.txt</a>
    </div>
  </footer>"""


def parse_publish_date(raw_value: str) -> datetime:
    value = str(raw_value or "").strip()
    if not value:
        return datetime.min
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(value[:19], fmt)
        except ValueError:
            continue
    return datetime.min


def normalize_publish_date(raw_value: str) -> str:
    value = str(raw_value or "").strip()
    if not value:
        return "1970-01-01 00:00:00"
    return value


def clean_body(raw_body: str) -> str:
    body = str(raw_body or "")
    if not body:
        return ""
    body = re.sub(r"\sdata-[a-z-]+=\"[^\"]*\"", "", body)
    body = re.sub(r"\sclass=\"\"", "", body)
    body = re.sub(r"\n{3,}", "\n\n", body)
    return body.strip()


def load_articles_from_local() -> list[dict]:
    if not API_ARTICLES_PATH.exists():
        raise FileNotFoundError(f"Missing local source file: {API_ARTICLES_PATH}")
    with API_ARTICLES_PATH.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def load_articles_from_api(api_url: str) -> list[dict]:
    response = requests.get(api_url, timeout=30)
    response.raise_for_status()
    payload = response.json()
    if not isinstance(payload, dict) or "articles" not in payload:
        raise ValueError("API response did not include an 'articles' key")
    return payload["articles"]


def normalize_articles(raw_articles: list[dict]) -> list[dict]:
    normalized = []
    for article in raw_articles:
        url_id = str(article.get("url_id", "")).strip().strip("/")
        title = str(article.get("title", "")).strip()
        if not url_id or not title or url_id in EXCLUDED_URL_IDS:
            continue
        normalized.append(
            {
                "url_id": url_id,
                "title": title,
                "excerpt": str(article.get("excerpt", "")).strip(),
                "author": str(article.get("author", "Feats.")).strip() or "Feats.",
                "publish_date": normalize_publish_date(article.get("publish_date", "")),
                "categories": str(article.get("categories", "")).strip(),
                "cover_url": str(article.get("cover_url", "")).strip() or DEFAULT_COVER,
                "body": clean_body(article.get("body", "")),
            }
        )

    normalized.sort(key=lambda item: parse_publish_date(item["publish_date"]), reverse=True)
    deduped = []
    seen = set()
    for article in normalized:
        if article["url_id"] in seen:
            continue
        seen.add(article["url_id"])
        deduped.append(article)
    return deduped


def write_article_index(articles: list[dict]) -> None:
    index_payload = [
        {
            "url_id": article["url_id"],
            "title": article["title"],
            "excerpt": article["excerpt"],
            "author": article["author"],
            "publish_date": article["publish_date"],
            "categories": article["categories"],
            "cover_url": article["cover_url"] or DEFAULT_COVER,
        }
        for article in articles
    ]
    INDEX_JSON_PATH.write_text(json.dumps(index_payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def render_article_page(article: dict) -> str:
    title = html.escape(article["title"], quote=True)
    excerpt = html.escape(article["excerpt"][:160], quote=True)
    author = html.escape(article["author"], quote=True)
    publish_day = html.escape(article["publish_date"][:10], quote=True)
    cats_raw = [part.strip() for part in str(article["categories"]).split(",") if part.strip()]
    cats = " &middot; ".join(html.escape(part, quote=True) for part in cats_raw[:5]) if cats_raw else "Article"
    cover = html.escape(article["cover_url"] or DEFAULT_COVER, quote=True)
    body = article["body"] or "<p></p>"

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title} &mdash; Feats.</title>
  <meta name="description" content="{excerpt}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Work+Sans:ital,wght@0,500;0,700;1,500;1,700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/css/style.css">
  <link rel="icon" type="image/x-icon" href="/favicon.ico">
{ARTICLE_STYLE}
</head>
<body>
{render_header(music_active=True)}
  <main class="page-wrap">
    <article class="article-body">
      <img class="featured-img" src="{cover}" alt="{title}" loading="lazy">
      <div class="meta">{cats} &middot; {author} &middot; {publish_day}</div>
      <h1>{title}</h1>
      {body}
    </article>
  </main>
{FOOTER}
  <script>
    document.getElementById('navToggle').addEventListener('click', function(){{
      document.getElementById('navLinks').classList.toggle('open');
    }});
  </script>
</body>
</html>
"""


def write_article_pages(articles: list[dict]) -> int:
    generated = 0
    MUSIC_DIR.mkdir(parents=True, exist_ok=True)
    for article in articles:
        if len(article["body"]) < 20:
            continue
        page_dir = MUSIC_DIR / article["url_id"]
        page_dir.mkdir(parents=True, exist_ok=True)
        (page_dir / "index.html").write_text(render_article_page(article), encoding="utf-8")
        generated += 1
    return generated


def render_music_listing() -> str:
    excluded_list = ", ".join(f'"{value}"' for value in sorted(EXCLUDED_URL_IDS))
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Music | Discover Gig Highlights &mdash; Feats.</title>
  <meta name="description" content="Browse Feats. music articles: live gig reviews, interviews, artist showcases, festival coverage, and editorial content.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Work+Sans:ital,wght@0,500;0,700;1,500;1,700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/css/style.css">
  <link rel="icon" type="image/x-icon" href="/favicon.ico">
</head>
<body>
{render_header(music_active=True)}
  <main class="page-wrap">
    <section class="section">
      <h1 class="section-title">Music</h1>
      <div class="music-grid" id="music-grid"></div>
      <div id="load-more" style="text-align:center;margin-top:3rem;display:none">
        <a href="#" class="btn" onclick="loadMore();return false">Older Posts</a>
      </div>
    </section>
  </main>
{FOOTER}
  <script>
    document.getElementById('navToggle').addEventListener('click', function(){{
      document.getElementById('navLinks').classList.toggle('open');
    }});
  </script>
  <script>
    const EXCLUDED_URL_IDS = new Set([{excluded_list}]);
    const PER_PAGE = 12;
    let allArticles = [];
    let currentPage = 0;

    function escapeHtml(value) {{
      return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }}

    function formatDate(raw) {{
      const value = String(raw || '');
      const pieces = value.split('-');
      if (pieces.length < 3) return value;
      const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      const monthIdx = parseInt(pieces[1], 10) - 1;
      const day = parseInt(pieces[2], 10);
      if (monthIdx < 0 || monthIdx > 11 || Number.isNaN(day)) return value;
      return day + ' ' + months[monthIdx] + ' ' + pieces[0];
    }}

    function normalizeArticles(data) {{
      if (!Array.isArray(data)) return [];
      return data
        .filter(a => a && typeof a === 'object')
        .filter(a => typeof a.url_id === 'string' && a.url_id.trim().length > 0)
        .filter(a => !EXCLUDED_URL_IDS.has(a.url_id.trim()));
    }}

    function renderArticles(articles) {{
      const grid = document.getElementById('music-grid');
      articles.forEach(function(a) {{
        const card = document.createElement('div');
        const slug = encodeURIComponent(String(a.url_id).trim());
        const title = escapeHtml(a.title);
        const author = escapeHtml(a.author || 'Feats.');
        const categories = escapeHtml(a.categories || 'Article');
        const description = escapeHtml((a.excerpt || '').substring(0, 200));
        const cover = escapeHtml(a.cover_url || '{DEFAULT_COVER}');
        const formattedDate = escapeHtml(formatDate(a.publish_date));
        card.className = 'music-card';
        card.innerHTML = '<a href="/music/' + slug + '">'
          + '<img src="' + cover + '" alt="' + title + '" loading="lazy">'
          + '<div class="meta"><span>' + categories + '</span><span>' + author + '</span><span>' + formattedDate + '</span></div>'
          + '<h2>' + title + '</h2>'
          + '<p>' + description + '</p>'
          + '<span class="read-more">Read More</span></a>';
        grid.appendChild(card);
      }});
    }}

    function loadMore() {{
      currentPage += 1;
      const start = currentPage * PER_PAGE;
      const end = start + PER_PAGE;
      renderArticles(allArticles.slice(start, end));
      if (end >= allArticles.length) {{
        document.getElementById('load-more').style.display = 'none';
      }}
    }}

    fetch('/article_index.json')
      .then(function(response) {{ return response.json(); }})
      .then(function(payload) {{
        allArticles = normalizeArticles(payload);
        renderArticles(allArticles.slice(0, PER_PAGE));
        if (allArticles.length > PER_PAGE) {{
          document.getElementById('load-more').style.display = 'block';
        }}
      }})
      .catch(function(error) {{
        console.error('Failed to load article_index.json', error);
      }});
  </script>
</body>
</html>
"""


def write_music_listing() -> None:
    MUSIC_DIR.mkdir(parents=True, exist_ok=True)
    (MUSIC_DIR / "index.html").write_text(render_music_listing(), encoding="utf-8")

def normalize_legacy_paths() -> int:
    updated_files = 0
    for html_file in MUSIC_DIR.rglob("index.html"):
        if not html_file.is_file():
            continue
        original = html_file.read_text(encoding="utf-8")
        updated = original
        updated = updated.replace("/feats-live/", "/")
        updated = updated.replace('href="youth-development/"', 'href="/youth-development"')
        updated = updated.replace('href="privacy-policy/"', 'href="/privacy-policy"')
        updated = updated.replace('href="mailto:Info@Feats.Live?"', 'href="mailto:Info@Feats.Live"')
        updated = re.sub(r'href="(?:\.\./)+sitemap\.xml"', 'href="/sitemap.xml"', updated)
        updated = re.sub(r'href="(?:\.\./)+robots\.txt"', 'href="/robots.txt"', updated)
        updated = re.sub(
            r'href="(?:\.\./)+s/Feats-Contributor-Code-of-Conduct-V3\.pdf"',
            'href="/s/Feats-Contributor-Code-of-Conduct-V3.pdf"',
            updated,
        )
        if updated != original:
            html_file.write_text(updated, encoding="utf-8")
            updated_files += 1
    return updated_files


def stale_article_dirs(valid_slugs: set[str]) -> list[Path]:
    if not MUSIC_DIR.exists():
        return []
    stale = []
    for child in MUSIC_DIR.iterdir():
        if not child.is_dir():
            continue
        if child.name in valid_slugs:
            continue
        stale.append(child)
    return sorted(stale, key=lambda path: path.name)


def main() -> int:
    parser = argparse.ArgumentParser(description="Regenerate article pages and listing from a single canonical source.")
    parser.add_argument(
        "--source",
        choices=["local", "api"],
        default="local",
        help="Load articles from local api/articles_clean.json (default) or from the API.",
    )
    parser.add_argument(
        "--api-url",
        default=DEFAULT_API_URL,
        help="API endpoint used when --source api is selected.",
    )
    parser.add_argument(
        "--prune",
        action="store_true",
        help="Delete stale /music/<slug>/ directories that are no longer present in the canonical article set.",
    )
    args = parser.parse_args()

    print(f"Repository root: {REPO_ROOT}")
    if args.source == "local":
        raw_articles = load_articles_from_local()
        print(f"Loaded {len(raw_articles)} raw articles from {API_ARTICLES_PATH}")
    else:
        raw_articles = load_articles_from_api(args.api_url)
        print(f"Loaded {len(raw_articles)} raw articles from {args.api_url}")

    articles = normalize_articles(raw_articles)
    print(f"Normalized to {len(articles)} published article records")

    write_article_index(articles)
    print(f"Wrote {INDEX_JSON_PATH}")

    generated = write_article_pages(articles)
    print(f"Generated {generated} article pages under {MUSIC_DIR}")

    write_music_listing()
    print(f"Wrote {MUSIC_DIR / 'index.html'}")

    normalized = normalize_legacy_paths()
    print(f"Normalized legacy routes in {normalized} existing music pages")

    valid_slugs = {article["url_id"] for article in articles}
    stale_dirs = stale_article_dirs(valid_slugs)
    if stale_dirs and args.prune:
        for path in stale_dirs:
            shutil.rmtree(path)
            print(f"Pruned stale directory: {path}")
    elif stale_dirs:
        print("Stale directories detected (not removed):")
        for path in stale_dirs:
            print(f"  - {path}")
        print("Run with --prune to remove stale directories.")

    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())