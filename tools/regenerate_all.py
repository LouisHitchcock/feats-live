from __future__ import annotations

import argparse
import html
import json
import re
import sqlite3
import shutil
from datetime import datetime
from pathlib import Path
from urllib.parse import urlsplit

import requests
from bs4 import BeautifulSoup

REPO_ROOT = Path(__file__).resolve().parents[1]
MUSIC_DIR = REPO_ROOT / "music"
INDEX_JSON_PATH = REPO_ROOT / "article_index.json"
API_ARTICLES_PATH = REPO_ROOT / "api" / "articles_clean.json"
WRITER_SEED_PATH = REPO_ROOT / "api" / "src" / "seed_writers.sql"
WRITER_PHOTOS_SEED_PATH = REPO_ROOT / "api" / "src" / "seed_writer_photos.sql"
PUBLIC_API_BASE = "https://feats-live.louishitchcock.xyz"
DEFAULT_API_URL = PUBLIC_API_BASE + "/api/articles"
DEFAULT_COVER = PUBLIC_API_BASE + "/images/hero-3.jpg"
IMAGE_PROXY_BASE = PUBLIC_API_BASE + "/images/articles/"
LEGACY_LAYOUT_URL_TEMPLATE = "https://feats.live/music/{url_id}?format=json-pretty"
DUPLICATE_SUFFIX_PATTERN = re.compile(r"^(?P<base>.+)-(?P<suffix>[a-z0-9]{5})$")

EXCLUDED_URL_IDS = {
    "about",
    "contact",
    "privacy-policy",
    "youth-development",
    "work-v2",
    "member-site-homepage-1",
    "membersite-home-page-1",
}
DYNAMIC_ARTICLE_ROUTE_SEGMENT = "article"
RESERVED_MUSIC_DIRS = {DYNAMIC_ARTICLE_ROUTE_SEGMENT}

ARTICLE_STYLE = """  <style>
    .article-body{max-width:750px;margin:0 auto;padding:3rem 2rem}
    .article-body::after{content:'';display:block;clear:both}
    .article-body .featured-img{width:100%;height:auto;margin-bottom:2rem}
    .article-body h1{font-size:2.2rem;margin-bottom:.5rem;line-height:1.2}
    .article-body .meta{font-size:.8rem;opacity:.5;text-transform:uppercase;letter-spacing:1px;margin-bottom:2rem}
    .article-body p{font-size:1.05rem;opacity:.85;margin-bottom:1.5rem;line-height:1.8}
    .article-body a{text-decoration:underline;opacity:.8}
    .article-body a:hover{opacity:1}
    .article-media{margin:1.5rem 0}
    .article-media--full{width:100%;clear:both}
    .article-media--float-right{float:right;width:45%;margin:0.5rem 0 1.2rem 1.5rem}
    .article-media--float-left{float:left;width:45%;margin:0.5rem 1.5rem 1.2rem 0}
    .article-media img{width:100%;height:auto;display:block;border-radius:4px}
    .article-media figcaption{font-size:.82rem;opacity:.62;line-height:1.45;margin-top:.5rem}
    .article-rule{margin:2.3rem 0;border:none;border-top:1px solid rgba(0,0,0,.18);clear:both}
    .article-divider{margin:2.3rem 0;border:none;border-top:1px solid rgba(0,0,0,.18);clear:both}
    .article-pullquote{margin:1.8rem 0;padding:1rem 1.25rem;border-left:4px solid #0a0a0a;background:#f6f6f6;font-size:1.18rem;line-height:1.5;font-style:italic}
    .article-pullquote p{margin:0}
    .article-callout{margin:1.8rem 0;padding:1rem 1.1rem;border-left:4px solid rgba(0,0,0,.42);background:#f4f4f4}
    .article-callout p{margin:0}
    .article-spacer{display:block;width:100%}
    .article-spacer--sm{height:22px}
    .article-spacer--md{height:42px}
    .article-spacer--lg{height:66px}
    .article-cta{display:inline-block;padding:.6rem 1.1rem;border:1px solid #0a0a0a;color:#0a0a0a;text-decoration:none;font-size:.79rem;font-weight:700;letter-spacing:.6px;text-transform:uppercase}
    .article-cta:hover{background:#0a0a0a;color:#fff}
    .article-carousel{position:relative}
    .article-carousel-main{position:relative;background:#0a0a0a;overflow:hidden}
    .article-carousel-slides{position:relative}
    .article-carousel .carousel-slide{display:none}
    .article-carousel .carousel-slide.is-active{display:block}
    .article-carousel .carousel-nav{position:absolute;top:50%;transform:translateY(-50%);z-index:3;width:42px;height:42px;border:none;background:rgba(0,0,0,.33);color:#fff;font-size:2rem;line-height:1;cursor:pointer}
    .article-carousel .carousel-nav.prev{left:0.65rem}
    .article-carousel .carousel-nav.next{right:0.65rem}
    .article-carousel.is-single .carousel-nav{display:none}
    .article-carousel-thumbs{display:flex;gap:2px;overflow-x:auto;margin-top:.55rem;padding-bottom:2px}
    .article-carousel .carousel-thumb{border:none;padding:0;background:transparent;opacity:.52;cursor:pointer;flex:0 0 auto}
    .article-carousel .carousel-thumb.is-active{opacity:1}
    .article-carousel .carousel-thumb img{width:58px;height:40px;object-fit:cover;border-radius:0}
    .article-embed iframe{display:block;width:100%;min-height:320px;border:0}
    @media(max-width:600px){
      .article-media--float-right,.article-media--float-left{float:none;width:100%;margin:1rem 0}
      .article-carousel .carousel-nav{width:36px;height:36px;font-size:1.65rem}
      .article-embed iframe{min-height:220px}
    }
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


def extract_author_name(raw_author) -> str:
    if isinstance(raw_author, dict):
        display_name = str(raw_author.get("displayName", "")).strip()
        if display_name:
            return display_name
        first_name = str(raw_author.get("firstName", "")).strip()
        last_name = str(raw_author.get("lastName", "")).strip()
        combined = " ".join(part for part in [first_name, last_name] if part).strip()
        return combined
    return str(raw_author or "").strip()


def normalize_author_key(author_name: str) -> str:
    return re.sub(r"\s+", " ", str(author_name or "").strip()).lower()


def load_writer_profiles() -> dict[str, dict[str, str]]:
    if not WRITER_SEED_PATH.exists():
        return {}

    connection = sqlite3.connect(":memory:")
    try:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS writers (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT UNIQUE NOT NULL,
              photo_url TEXT DEFAULT '',
              bio TEXT DEFAULT '',
              created_at TEXT DEFAULT (datetime('now'))
            );
            """
        )
        connection.executescript(WRITER_SEED_PATH.read_text(encoding="cp1252", errors="ignore"))
        if WRITER_PHOTOS_SEED_PATH.exists():
            connection.executescript(WRITER_PHOTOS_SEED_PATH.read_text(encoding="cp1252", errors="ignore"))

        cursor = connection.execute("SELECT name, photo_url, bio FROM writers")
        profiles: dict[str, dict[str, str]] = {}
        for name, photo_url, bio in cursor.fetchall():
            author_name = str(name or "").strip()
            if not author_name:
                continue
            profiles[normalize_author_key(author_name)] = {
                "name": author_name,
                "photo_url": str(photo_url or "").strip(),
                "bio": str(bio or "").strip(),
            }
        return profiles
    except Exception:
        return {}
    finally:
        connection.close()


def clean_body(raw_body: str) -> str:
    body = str(raw_body or "")
    if not body:
        return ""
    body = re.sub(r'\sclass=""', "", body)
    body = re.sub(r"\n{3,}", "\n\n", body)
    return body.strip()


def normalize_image_url(src: str) -> str:
    value = str(src or "").strip()
    if not value:
        return value
    if "squarespace-cdn.com" in value:
        filename = urlsplit(value).path.rsplit("/", 1)[-1].split("?")[0]
        if filename:
            return IMAGE_PROXY_BASE + filename
    return value


def extract_float_direction(classes: set[str]) -> str | None:
    if "float-left" in classes:
        return "left"
    if "float-right" in classes:
        return "right"
    return None


def media_class(float_direction: str | None) -> str:
    base = "article-media"
    if float_direction == "left":
        return base + " article-media--float-left"
    if float_direction == "right":
        return base + " article-media--float-right"
    return base + " article-media--full"


def sanitize_fragment_html(fragment: str) -> str:
    soup = BeautifulSoup(fragment, "html.parser")

    for invalid in soup.find_all(["script", "style"]):
        invalid.decompose()

    allowed_attrs = {
        "class",
        "style",
        "id",
        "href",
        "target",
        "rel",
        "src",
        "srcset",
        "sizes",
        "alt",
        "title",
        "loading",
        "width",
        "height",
        "frameborder",
        "allow",
        "allowfullscreen",
        "referrerpolicy",
    }

    for tag in soup.find_all(True):
        cleaned_attrs = {}
        for key, value in tag.attrs.items():
            normalized_key = key.lower()
            if normalized_key.startswith("on"):
                continue
            if normalized_key == "href" and str(value).strip().lower().startswith("javascript:"):
                continue
            if normalized_key.startswith("data-"):
                if normalized_key.startswith("data-article-"):
                    cleaned_attrs[normalized_key] = value
                continue
            if normalized_key in allowed_attrs:
                cleaned_attrs[normalized_key] = value
        tag.attrs = cleaned_attrs

    for paragraph in soup.find_all("p"):
        text = paragraph.get_text(" ", strip=True).replace("\xa0", "").strip()
        if not text and not paragraph.find(["img", "iframe", "video"]):
            paragraph.decompose()

    for anchor in soup.find_all("a"):
        href = str(anchor.get("href", "")).strip()
        anchor_text = anchor.get_text(" ", strip=True)
        has_media = bool(anchor.find(["img", "svg"]))
        if href and (anchor_text or has_media):
            continue
        if href and not anchor_text and not has_media:
            anchor.replace_with(" ")
            continue
        if anchor_text or has_media:
            anchor.unwrap()
        else:
            anchor.decompose()

    for wrapper in soup.find_all(["div", "span"]):
        wrapper_text = wrapper.get_text(" ", strip=True)
        if wrapper_text:
            continue
        if wrapper.find(["img", "iframe", "video", "hr", "br", "p", "figure", "ul", "ol", "blockquote"]):
            continue
        wrapper.decompose()

    return str(soup).strip()


def convert_html_block(block) -> str:
    content = block.select_one(".sqs-html-content") or block.select_one(".sqs-block-content")
    if not content:
        return ""
    fragment = "".join(str(child) for child in content.contents)
    return sanitize_fragment_html(fragment)


def extract_iframe_html(block) -> str:
    iframe = block.find("iframe")
    if iframe is not None:
        return sanitize_fragment_html(str(iframe))

    video_wrapper = block.select_one(".sqs-video-wrapper")
    encoded_html = str(video_wrapper.get("data-html", "")).strip() if video_wrapper is not None else ""
    if encoded_html:
        decoded = html.unescape(encoded_html)
        decoded_soup = BeautifulSoup(decoded, "html.parser")
        decoded_iframe = decoded_soup.find("iframe")
        if decoded_iframe is not None:
            return sanitize_fragment_html(str(decoded_iframe))

    return ""


def convert_embed_block(block) -> str:
    classes = set(block.get("class", []))
    float_direction = extract_float_direction(classes)
    iframe_html = extract_iframe_html(block)
    if not iframe_html:
        return convert_html_block(block)
    return "\n".join(
        [
            f'<div class="{media_class(float_direction)} article-embed">',
            f"  {iframe_html}",
            "</div>",
        ]
    )


def convert_image_block(block) -> str:
    classes = set(block.get("class", []))
    float_direction = extract_float_direction(classes)

    src = ""
    alt = ""
    for img in block.find_all("img"):
        src = img.get("data-src") or img.get("data-image") or img.get("src") or ""
        alt = img.get("alt", "") or ""
        if src:
            break
    if not src:
        return ""

    src = normalize_image_url(src)
    caption_node = block.select_one(".image-caption-wrapper p, .image-caption p, .image-caption")
    caption = caption_node.get_text(" ", strip=True) if caption_node else ""

    output = [
        f'<figure class="{media_class(float_direction)}">',
        f'  <img src="{html.escape(src, quote=True)}" alt="{html.escape(alt, quote=True)}" loading="lazy">',
    ]
    if caption:
        output.append(f"  <figcaption>{html.escape(caption)}</figcaption>")
    output.append("</figure>")
    return "\n".join(output)


def convert_gallery_block(block, carousel_id: str) -> str:
    classes = set(block.get("class", []))
    float_direction = extract_float_direction(classes)

    slides = []
    seen = set()
    for slide in block.select(".slide"):
        img = slide.find("img")
        if img is None:
            noscript = slide.find("noscript")
            if noscript is not None:
                noscript_soup = BeautifulSoup(noscript.decode_contents(), "html.parser")
                img = noscript_soup.find("img")
        if img is None:
            continue
        src = img.get("data-src") or img.get("data-image") or img.get("src") or ""
        if not src:
            continue
        src = normalize_image_url(src)
        if src in seen:
            continue
        seen.add(src)
        slides.append(
            {
                "src": src,
                "alt": img.get("alt", "") or "",
            }
        )

    if not slides:
        for img in block.find_all("img"):
            src = img.get("data-src") or img.get("data-image") or img.get("src") or ""
            if not src:
                continue
            src = normalize_image_url(src)
            if src in seen:
                continue
            seen.add(src)
            slides.append(
                {
                    "src": src,
                    "alt": img.get("alt", "") or "",
                }
            )

    if not slides:
        return ""

    wrapper_class = "article-carousel " + media_class(float_direction)
    if len(slides) <= 1:
        wrapper_class += " is-single"

    output = [
        f'<div class="{wrapper_class}" data-article-carousel="{carousel_id}">',
        '  <div class="article-carousel-main">',
        '    <button type="button" class="carousel-nav prev" aria-label="Previous image">&#10094;</button>',
        '    <div class="article-carousel-slides">',
    ]

    for index, slide in enumerate(slides):
        active = " is-active" if index == 0 else ""
        output.append(
            f'      <img class="carousel-slide{active}" src="{html.escape(slide["src"], quote=True)}" '
            f'alt="{html.escape(slide["alt"], quote=True)}" loading="lazy">'
        )

    output.extend(
        [
            "    </div>",
            '    <button type="button" class="carousel-nav next" aria-label="Next image">&#10095;</button>',
            "  </div>",
        ]
    )

    if len(slides) > 1:
        output.append('  <div class="article-carousel-thumbs">')
        for index, slide in enumerate(slides):
            active = " is-active" if index == 0 else ""
            output.extend(
                [
                    f'    <button type="button" class="carousel-thumb{active}" data-slide-index="{index}" aria-label="View image {index + 1}">',
                    f'      <img src="{html.escape(slide["src"], quote=True)}" alt="" loading="lazy">',
                    "    </button>",
                ]
            )
        output.append("  </div>")

    output.append("</div>")
    return "\n".join(output)


def convert_legacy_squarespace_body(body_html: str) -> str:
    if "sqs-block" not in body_html:
        return clean_body(body_html)

    soup = BeautifulSoup(body_html, "html.parser")
    blocks = soup.select("div.sqs-block")
    if not blocks:
        return clean_body(body_html)

    converted_parts = []
    gallery_counter = 0
    for block in blocks:
        classes = set(block.get("class", []))
        converted = ""
        if "gallery-block" in classes or "sqs-block-gallery" in classes:
            gallery_counter += 1
            converted = convert_gallery_block(block, f"carousel-{gallery_counter}")
        elif "image-block" in classes or "sqs-block-image" in classes:
            converted = convert_image_block(block)
        elif "embed-block" in classes or "sqs-block-embed" in classes:
            converted = convert_embed_block(block)
        elif "video-block" in classes or "sqs-block-video" in classes:
            converted = convert_embed_block(block)
        elif "horizontalrule-block" in classes or "sqs-block-horizontalrule" in classes:
            converted = '<hr class="article-rule">'
        elif "html-block" in classes or "sqs-block-html" in classes:
            converted = convert_html_block(block)
        else:
            converted = convert_html_block(block)

        if converted:
            converted_parts.append(converted)

    if not converted_parts:
        return clean_body(body_html)
    return "\n".join(converted_parts).strip()


def fetch_legacy_layout_record(url_id: str) -> dict | None:
    try:
        response = requests.get(LEGACY_LAYOUT_URL_TEMPLATE.format(url_id=url_id), timeout=20)
        if response.status_code != 200:
            return None
        payload = response.json()
        item = payload.get("item", {}) if isinstance(payload, dict) else {}
        body = item.get("body", "")
        author = extract_author_name(item.get("author", ""))
        return {
            "body": body if isinstance(body, str) else "",
            "author": author,
        }
    except Exception:
        return None


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


def duplicate_variant_base_slug(url_id: str) -> str | None:
    match = DUPLICATE_SUFFIX_PATTERN.match(url_id)
    if not match:
        return None
    return match.group("base")


def normalize_articles(raw_articles: list[dict], writer_profiles: dict[str, dict[str, str]] | None = None) -> list[dict]:
    profiles = writer_profiles or {}
    normalized = []
    for article in raw_articles:
        url_id = str(article.get("url_id", "")).strip().strip("/")
        title = str(article.get("title", "")).strip()
        if not url_id or not title or url_id in EXCLUDED_URL_IDS:
            continue
        if title.lower().endswith("(copy)"):
            continue
        author_name = extract_author_name(article.get("author", "Feats.")) or "Feats."
        writer_profile = profiles.get(normalize_author_key(author_name), {})
        normalized.append(
            {
                "url_id": url_id,
                "title": title,
                "excerpt": str(article.get("excerpt", "")).strip(),
                "author": author_name,
                "publish_date": normalize_publish_date(article.get("publish_date", "")),
                "categories": str(article.get("categories", "")).strip(),
                "cover_url": str(article.get("cover_url", "")).strip() or DEFAULT_COVER,
                "body": clean_body(article.get("body", "")),
                "writer_photo_url": str(writer_profile.get("photo_url", "")).strip(),
                "writer_bio": str(writer_profile.get("bio", "")).strip(),
            }
        )

    normalized.sort(key=lambda item: parse_publish_date(item["publish_date"]), reverse=True)
    all_slugs = {article["url_id"] for article in normalized}
    deduped = []
    seen = set()
    for article in normalized:
        base_slug = duplicate_variant_base_slug(article["url_id"])
        if base_slug and base_slug in all_slugs:
            continue
        if article["url_id"] in seen:
            continue
        seen.add(article["url_id"])
        deduped.append(article)
    return deduped


def enrich_articles_with_legacy_layouts(
    articles: list[dict], writer_profiles: dict[str, dict[str, str]] | None = None
) -> int:
    profiles = writer_profiles or {}
    updated = 0
    for index, article in enumerate(articles, 1):
        legacy_record = fetch_legacy_layout_record(article["url_id"])
        if not legacy_record:
            continue
        legacy_body = str(legacy_record.get("body", "") or "")
        converted = convert_legacy_squarespace_body(legacy_body) if legacy_body else ""
        legacy_author = extract_author_name(legacy_record.get("author", ""))
        changed = False
        if not converted:
            converted = article.get("body", "")
        if converted and converted != article.get("body", ""):
            article["body"] = converted
            changed = True
        if legacy_author and legacy_author != article.get("author", ""):
            article["author"] = legacy_author
            changed = True
        writer_profile = profiles.get(normalize_author_key(article.get("author", "")), {})
        writer_photo_url = str(writer_profile.get("photo_url", "")).strip()
        writer_bio = str(writer_profile.get("bio", "")).strip()
        if writer_photo_url != article.get("writer_photo_url", ""):
            article["writer_photo_url"] = writer_photo_url
            changed = True
        if writer_bio != article.get("writer_bio", ""):
            article["writer_bio"] = writer_bio
            changed = True
        if changed:
            updated += 1
        if index % 20 == 0:
            print(f"  scraped layouts {index}/{len(articles)} ({updated} updated)")
    return updated


def persist_scraped_layouts(raw_articles: list[dict], normalized_articles: list[dict]) -> int:
    updated = 0
    body_by_slug = {article["url_id"]: article.get("body", "") for article in normalized_articles if article.get("body")}
    author_by_slug = {article["url_id"]: article.get("author", "") for article in normalized_articles if article.get("author")}

    for raw in raw_articles:
        slug = str(raw.get("url_id", "")).strip().strip("/")
        changed = False
        if slug in body_by_slug and body_by_slug[slug]:
            if raw.get("body", "") != body_by_slug[slug]:
                raw["body"] = body_by_slug[slug]
                changed = True
        if slug in author_by_slug and author_by_slug[slug]:
            normalized_raw_author = extract_author_name(raw.get("author", ""))
            if normalized_raw_author != author_by_slug[slug]:
                raw["author"] = author_by_slug[slug]
                changed = True
        if changed:
            updated += 1

    API_ARTICLES_PATH.write_text(json.dumps(raw_articles, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return updated


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
    slug = html.escape(article["url_id"], quote=True)
    cats_raw = [part.strip() for part in str(article["categories"]).split(",") if part.strip()]
    cats = " &middot; ".join(html.escape(part, quote=True) for part in cats_raw[:5]) if cats_raw else "Article"
    cover = html.escape(article["cover_url"] or DEFAULT_COVER, quote=True)
    body = article["body"] or "<p></p>"
    writer_photo_url = html.escape(str(article.get("writer_photo_url", "")).strip(), quote=True)
    writer_bio = html.escape(str(article.get("writer_bio", "")).strip())
    writer_photo_markup = f'<img class="writer-credit-photo" src="{writer_photo_url}" alt="{author}" loading="lazy">' if writer_photo_url else ""
    writer_bio_markup = f"<p>{writer_bio}</p>" if writer_bio else ""
    writer_credit_markup = (
        '<div class="writer-credit" id="writerCredit">'
        + writer_photo_markup
        + '<div class="writer-credit-info"><h4>Written by '
        + author
        + "</h4>"
        + writer_bio_markup
        + "</div></div>"
    )
    hydrate_from_api = "1" if body.strip() in {"<p></p>", "<p>Loading article...</p>"} else "0"

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
    <article class="article-body" id="articleBody" data-article-slug="{slug}" data-hydrate-from-api="{hydrate_from_api}">
      <img class="featured-img" src="{cover}" alt="{title}" loading="lazy">
      <div class="meta">{cats} &middot; {author} &middot; {publish_day}</div>
      <h1>{title}</h1>
      {body}
      {writer_credit_markup}
    </article>
  </main>
{FOOTER}
  <script>
    const ARTICLE_API_BASE = '{PUBLIC_API_BASE}';
    const ARTICLE_FALLBACK_COVER = '{DEFAULT_COVER}';
    (function enforceCanonicalArticlePath() {{
      var container = document.getElementById('articleBody');
      if (!container) return;
      var slug = String(container.getAttribute('data-article-slug') || '').trim().replace(/^[/]+/g, '').replace(/[/]+$/g, '');
      if (!slug) return;
      var canonicalUrl = '/music/?article=' + encodeURIComponent(slug);
      var currentUrl = window.location.pathname + window.location.search;
      if (currentUrl !== canonicalUrl) {{
        window.location.replace(canonicalUrl);
      }}
    }})();
    document.getElementById('navToggle').addEventListener('click', function(){{
      document.getElementById('navLinks').classList.toggle('open');
    }});
    function escapeHtml(value) {{
      return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }}


    function formatDate(raw) {{
      var value = String(raw || '');
      var pieces = value.split('-');
      if (pieces.length < 3) return value;
      var months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      var monthIdx = parseInt(pieces[1], 10) - 1;
      var day = parseInt(pieces[2], 10);
      if (monthIdx < 0 || monthIdx > 11 || Number.isNaN(day)) return value;
      return day + ' ' + months[monthIdx] + ' ' + pieces[0];
    }}
    function fetchLocalArticleFallback(slug) {{
      return fetch('/api/articles_clean.json', {{ cache: 'no-store' }})
        .then(function(response) {{
          if (!response.ok) throw new Error('Local fallback fetch failed: ' + response.status);
          return response.json();
        }})
        .then(function(rows) {{
          if (!Array.isArray(rows)) return null;
          var normalizedSlug = String(slug || '').trim().replace(/^[/]+/g, '').replace(/[/]+$/g, '');
          for (var i = 0; i < rows.length; i++) {{
            var candidate = rows[i] || {{}};
            var candidateSlug = String(candidate.url_id || '').trim().replace(/^[/]+/g, '').replace(/[/]+$/g, '');
            if (candidateSlug === normalizedSlug) return candidate;
          }}
          return null;
        }});
    }}

    function getCarouselNodes(carousel) {{
      return {{
        slides: carousel ? carousel.querySelectorAll('.carousel-slide') : [],
        thumbs: carousel ? carousel.querySelectorAll('.carousel-thumb') : []
      }};
    }}

    function setCarouselSlideByElement(carousel, nextIndex) {{
      if (!carousel) return;
      var nodes = getCarouselNodes(carousel);
      if (!nodes.slides.length) return;
      var safeIndex = parseInt(nextIndex, 10);
      if (Number.isNaN(safeIndex)) safeIndex = 0;
      if (safeIndex < 0) safeIndex = nodes.slides.length - 1;
      if (safeIndex >= nodes.slides.length) safeIndex = 0;
      carousel.setAttribute('data-current-slide', String(safeIndex));
      nodes.slides.forEach(function(slide, index){{
        var active = index === safeIndex;
        slide.classList.toggle('is-active', active);
        slide.classList.toggle('active', active);
      }});
      nodes.thumbs.forEach(function(thumb, index){{
        var active = index === safeIndex;
        thumb.classList.toggle('is-active', active);
        thumb.classList.toggle('active', active);
      }});
    }}

    function initSingleCarousel(carousel) {{
      if (!carousel || carousel.dataset.bound === '1') return;
      carousel.dataset.bound = '1';
      var prevButton = carousel.querySelector('.carousel-nav.prev, .carousel-nav-prev');
      var nextButton = carousel.querySelector('.carousel-nav.next, .carousel-nav-next');
      if (prevButton) {{
        prevButton.addEventListener('click', function(event){{
          event.preventDefault();
          var current = parseInt(carousel.getAttribute('data-current-slide') || '0', 10);
          if (Number.isNaN(current)) current = 0;
          setCarouselSlideByElement(carousel, current - 1);
        }});
      }}
      if (nextButton) {{
        nextButton.addEventListener('click', function(event){{
          event.preventDefault();
          var current = parseInt(carousel.getAttribute('data-current-slide') || '0', 10);
          if (Number.isNaN(current)) current = 0;
          setCarouselSlideByElement(carousel, current + 1);
        }});
      }}
      var thumbs = carousel.querySelectorAll('.carousel-thumb');
      thumbs.forEach(function(button, index){{
        if (button.dataset.bound === '1') return;
        button.dataset.bound = '1';
        button.addEventListener('click', function(event){{
          event.preventDefault();
          setCarouselSlideByElement(carousel, index);
        }});
      }});
      var initial = parseInt(carousel.getAttribute('data-current-slide') || '0', 10);
      if (Number.isNaN(initial)) initial = 0;
      setCarouselSlideByElement(carousel, initial);
    }}

    function initArticleCarousels(root) {{
      var scope = root || document;
      var carousels = scope.querySelectorAll('[data-article-carousel], .article-carousel');
      carousels.forEach(initSingleCarousel);
    }}

    function changeCarouselSlide(carouselId, newIndex) {{
      var carousel = document.getElementById(carouselId);
      if (!carousel) return;
      setCarouselSlideByElement(carousel, newIndex);
    }}

    function moveCarouselSlide(carouselId, delta) {{
      var carousel = document.getElementById(carouselId);
      if (!carousel) return;
      var current = parseInt(carousel.getAttribute('data-current-slide') || '0', 10);
      if (Number.isNaN(current)) current = 0;
      setCarouselSlideByElement(carousel, current + parseInt(delta || 0, 10));
    }}

    function hydrateArticleFromApi() {{
      var container = document.getElementById('articleBody');
      if (!container) return;
      if (container.getAttribute('data-hydrate-from-api') !== '1') return;
      var currentSlug = container.getAttribute('data-article-slug');
      if (!currentSlug) return;
      fetch(ARTICLE_API_BASE + '/api/articles/' + encodeURIComponent(currentSlug), {{ cache: 'no-store' }})
        .then(function(response){{
          if (!response.ok) throw new Error('Article API request failed: ' + response.status);
          return response.json();
        }})
        .then(function(payload){{
          var article = payload && payload.article ? payload.article : null;
          if (!article) return;
          return fetchLocalArticleFallback(currentSlug)
            .then(function(localArticle) {{
              if (localArticle && String(localArticle.body || '').trim()) {{
                article.body = localArticle.body;
                if (!article.excerpt && localArticle.excerpt) article.excerpt = localArticle.excerpt;
                if (!article.cover_url && localArticle.cover_url) article.cover_url = localArticle.cover_url;
                if (!article.categories && localArticle.categories) article.categories = localArticle.categories;
                if (!article.publish_date && localArticle.publish_date) article.publish_date = localArticle.publish_date;
                if ((!article.author || article.author === 'Feats.') && localArticle.author) article.author = localArticle.author;
              }}
              return article;
            }})
            .catch(function() {{ return article; }});
        }})
        .then(function(article){{
          if (!article) return;
          var articleTitle = escapeHtml(article.title || 'Untitled Article');
          var articleAuthor = escapeHtml(article.author || 'Feats.');
          var categories = String(article.categories || '')
            .split(',')
            .map(function(part) {{ return part.trim(); }})
            .filter(Boolean)
            .slice(0, 5)
            .map(escapeHtml)
            .join(' &middot; ');
          if (!categories) categories = 'Article';
          var publishDate = escapeHtml(formatDate(String(article.publish_date || '').slice(0, 10)));
          var coverUrl = escapeHtml(article.cover_url || ARTICLE_FALLBACK_COVER);
          var bodyHtml = article.body || '<p></p>';
          var writerPhotoUrl = escapeHtml(article.writer_photo_url || '');
          var writerBio = escapeHtml(article.writer_bio || '');
          var writerCreditHtml = '<div class=\\\"writer-credit\\\" id=\\\"writerCredit\\\">'
            + (writerPhotoUrl ? '<img class=\\\"writer-credit-photo\\\" src=\\\"' + writerPhotoUrl + '\\\" alt=\\\"' + articleAuthor + '\\\" loading=\\\"lazy\\\">' : '')
            + '<div class=\\\"writer-credit-info\\\"><h4>Written by ' + articleAuthor + '</h4>'
            + (writerBio ? '<p>' + writerBio + '</p>' : '')
            + '</div></div>';
          container.innerHTML =
            '<img class=\"featured-img\" src=\"' + coverUrl + '\" alt=\"' + articleTitle + '\" loading=\"lazy\">' +
            '<div class=\"meta\">' + categories + ' &middot; ' + articleAuthor + ' &middot; ' + publishDate + '</div>' +
            '<h1>' + articleTitle + '</h1>' +
            bodyHtml +
            writerCreditHtml;
          document.title = (article.title || 'Article') + ' — Feats.';
          var description = document.querySelector('meta[name=\"description\"]');
          if (description) {{
            description.setAttribute('content', String(article.excerpt || '').slice(0, 160));
          }}
          initArticleCarousels(container);
        }})
        .catch(function(error){{
          console.warn('Using static article fallback for', currentSlug, error);
        }});
    }}

    initArticleCarousels(document);
    hydrateArticleFromApi();
  </script>
</body>
</html>
"""

def render_music_listing_query_mode() -> str:
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
{ARTICLE_STYLE}
</head>
<body>
{render_header(music_active=True)}
  <main class="page-wrap">
    <section class="section" id="musicListingSection">
      <h1 class="section-title">Music</h1>
      <div class="music-grid" id="music-grid"></div>
      <div id="load-more" style="text-align:center;margin-top:3rem;display:none">
        <a href="#" class="btn" onclick="loadMore();return false">Older Posts</a>
      </div>
    </section>
    <article class="article-body" id="articleBody" data-article-slug="" style="display:none"></article>
  </main>
{FOOTER}
  <script>
    document.getElementById('navToggle').addEventListener('click', function(){{
      document.getElementById('navLinks').classList.toggle('open');
    }});
  </script>
  <script>
    const ARTICLE_API_BASE = '{PUBLIC_API_BASE}';
    const ARTICLE_FALLBACK_COVER = '{DEFAULT_COVER}';
    const MUSIC_PAGE_TITLE = 'Music | Discover Gig Highlights - Feats.';
    const MUSIC_PAGE_DESCRIPTION = 'Browse Feats. music articles: live gig reviews, interviews, artist showcases, festival coverage, and editorial content.';
    const EXCLUDED_URL_IDS = new Set([{excluded_list}]);
    const PER_PAGE = 12;
    let allArticles = [];
    let currentPage = 0;
    function escapeHtml(value) {{
      return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
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

    function normalizeSlug(raw) {{
      return String(raw || '').trim().replace(/^[/]+/g, '').replace(/[/]+$/g, '');
    }}

    function getRequestedArticleSlug() {{
      const searchParams = new URLSearchParams(window.location.search || '');
      return normalizeSlug(searchParams.get('article') || '');
    }}

    function getLegacyRequestedArticleSlug() {{
      const searchParams = new URLSearchParams(window.location.search || '');
      return normalizeSlug(searchParams.get('slug') || searchParams.get('') || '');
    }}

    function normalizeLegacyArticleQuery(articleSlug) {{
      const normalizedSlug = normalizeSlug(articleSlug);
      if (!normalizedSlug) return;
      const nextUrl = '/music/?article=' + encodeURIComponent(normalizedSlug);
      const currentUrl = window.location.pathname + window.location.search;
      if (currentUrl !== nextUrl) {{
        history.replaceState(null, '', nextUrl);
      }}
    }}

    function normalizeArticles(data) {{
      if (!Array.isArray(data)) return [];
      return data
        .filter(a => a && typeof a === 'object')
        .filter(a => typeof a.url_id === 'string' && a.url_id.trim().length > 0)
        .filter(a => !EXCLUDED_URL_IDS.has(a.url_id.trim()));
    }}

    function fetchLocalArticleFallback(slug) {{
      return fetch('/api/articles_clean.json', {{ cache: 'no-store' }})
        .then(function(response) {{
          if (!response.ok) throw new Error('Local fallback fetch failed: ' + response.status);
          return response.json();
        }})
        .then(function(rows) {{
          if (!Array.isArray(rows)) return null;
          const normalizedSlug = normalizeSlug(slug);
          for (let i = 0; i < rows.length; i += 1) {{
            const candidate = rows[i] || {{}};
            if (normalizeSlug(candidate.url_id || '') === normalizedSlug) return candidate;
          }}
          return null;
        }});
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
        card.innerHTML = '<a href=\\\"/music/?article=' + slug + '\\\">'
          + '<img src="' + cover + '" alt="' + title + '" loading="lazy">'
          + '<div class="meta"><span>' + categories + '</span><span>' + author + '</span><span>' + formattedDate + '</span></div>'
          + '<h2>' + title + '</h2>'
          + '<p>' + description + '</p>'
          + '<span class=\"read-more\">Read More</span></a>';
        grid.appendChild(card);
      }});
      setTimeout(function() {{
        grid.querySelectorAll('.music-card:not(.visible)').forEach(function(el) {{
          cardsObserver.observe(el);
        }});
      }}, 50);
    }}

    var cardsObserver = new IntersectionObserver(function(entries) {{
      entries.forEach(function(entry) {{
        if (entry.isIntersecting) {{
          entry.target.classList.add('visible');
          cardsObserver.unobserve(entry.target);
        }}
      }});
    }}, {{ rootMargin: '0px 0px 80px 0px' }});

    function getCarouselNodes(carousel) {{
      return {{
        slides: carousel ? carousel.querySelectorAll('.carousel-slide') : [],
        thumbs: carousel ? carousel.querySelectorAll('.carousel-thumb') : []
      }};
    }}

    function setCarouselSlideByElement(carousel, nextIndex) {{
      if (!carousel) return;
      const nodes = getCarouselNodes(carousel);
      if (!nodes.slides.length) return;
      let safeIndex = parseInt(nextIndex, 10);
      if (Number.isNaN(safeIndex)) safeIndex = 0;
      if (safeIndex < 0) safeIndex = nodes.slides.length - 1;
      if (safeIndex >= nodes.slides.length) safeIndex = 0;
      carousel.setAttribute('data-current-slide', String(safeIndex));
      nodes.slides.forEach(function(slide, index){{
        const active = index === safeIndex;
        slide.classList.toggle('is-active', active);
        slide.classList.toggle('active', active);
      }});
      nodes.thumbs.forEach(function(thumb, index){{
        const active = index === safeIndex;
        thumb.classList.toggle('is-active', active);
        thumb.classList.toggle('active', active);
      }});
    }}

    function initSingleCarousel(carousel) {{
      if (!carousel || carousel.dataset.bound === '1') return;
      carousel.dataset.bound = '1';
      const prevButton = carousel.querySelector('.carousel-nav.prev, .carousel-nav-prev');
      const nextButton = carousel.querySelector('.carousel-nav.next, .carousel-nav-next');
      if (prevButton) {{
        prevButton.addEventListener('click', function(event){{
          event.preventDefault();
          let current = parseInt(carousel.getAttribute('data-current-slide') || '0', 10);
          if (Number.isNaN(current)) current = 0;
          setCarouselSlideByElement(carousel, current - 1);
        }});
      }}
      if (nextButton) {{
        nextButton.addEventListener('click', function(event){{
          event.preventDefault();
          let current = parseInt(carousel.getAttribute('data-current-slide') || '0', 10);
          if (Number.isNaN(current)) current = 0;
          setCarouselSlideByElement(carousel, current + 1);
        }});
      }}
      const thumbs = carousel.querySelectorAll('.carousel-thumb');
      thumbs.forEach(function(button, index){{
        if (button.dataset.bound === '1') return;
        button.dataset.bound = '1';
        button.addEventListener('click', function(event){{
          event.preventDefault();
          setCarouselSlideByElement(carousel, index);
        }});
      }});
      let initial = parseInt(carousel.getAttribute('data-current-slide') || '0', 10);
      if (Number.isNaN(initial)) initial = 0;
      setCarouselSlideByElement(carousel, initial);
    }}

    function initArticleCarousels(root) {{
      const scope = root || document;
      const carousels = scope.querySelectorAll('[data-article-carousel], .article-carousel');
      carousels.forEach(initSingleCarousel);
    }}

    function showListingMode() {{
      const listingSection = document.getElementById('musicListingSection');
      const articleBody = document.getElementById('articleBody');
      if (listingSection) listingSection.style.display = '';
      if (articleBody) articleBody.style.display = 'none';
      document.title = MUSIC_PAGE_TITLE;
      const description = document.querySelector('meta[name=\"description\"]');
      if (description) {{
        description.setAttribute('content', MUSIC_PAGE_DESCRIPTION);
      }}
    }}

    function showArticleMode(articleSlug) {{
      const listingSection = document.getElementById('musicListingSection');
      const loadMoreButton = document.getElementById('load-more');
      const articleBody = document.getElementById('articleBody');
      if (!articleBody) return;

      if (listingSection) listingSection.style.display = 'none';
      if (loadMoreButton) loadMoreButton.style.display = 'none';
      articleBody.style.display = '';
      articleBody.setAttribute('data-article-slug', articleSlug);
      articleBody.innerHTML = '<p>Loading article...</p>';

      fetch(ARTICLE_API_BASE + '/api/articles/' + encodeURIComponent(articleSlug), {{ cache: 'no-store' }})
        .then(function(response) {{
          if (!response.ok) throw new Error('Article API request failed: ' + response.status);
          return response.json();
        }})
        .then(function(payload) {{
          const article = payload && payload.article ? payload.article : null;
          if (!article) throw new Error('Article payload missing');
          return fetchLocalArticleFallback(articleSlug)
            .then(function(localArticle) {{
              if (localArticle && String(localArticle.body || '').trim()) {{
                article.body = localArticle.body;
                if (!article.excerpt && localArticle.excerpt) article.excerpt = localArticle.excerpt;
                if (!article.cover_url && localArticle.cover_url) article.cover_url = localArticle.cover_url;
                if (!article.categories && localArticle.categories) article.categories = localArticle.categories;
                if (!article.publish_date && localArticle.publish_date) article.publish_date = localArticle.publish_date;
                if ((!article.author || article.author === 'Feats.') && localArticle.author) article.author = localArticle.author;
              }}
              return article;
            }})
            .catch(function() {{ return article; }});
        }})
        .then(function(article) {{
          if (!article) return;
          const articleTitle = escapeHtml(article.title || 'Untitled Article');
          const articleAuthor = escapeHtml(article.author || 'Feats.');
          let categories = String(article.categories || '')
            .split(',')
            .map(function(part) {{ return part.trim(); }})
            .filter(Boolean)
            .slice(0, 5)
            .map(escapeHtml)
            .join(' &middot; ');
          if (!categories) categories = 'Article';
          const publishDate = escapeHtml(formatDate(String(article.publish_date || '').slice(0, 10)));
          const coverUrl = escapeHtml(article.cover_url || ARTICLE_FALLBACK_COVER);
          const bodyHtml = article.body || '<p></p>';
          const writerPhotoUrl = escapeHtml(article.writer_photo_url || '');
          const writerBio = escapeHtml(article.writer_bio || '');
          const writerCreditHtml = '<div class=\"writer-credit\" id=\"writerCredit\">'
            + (writerPhotoUrl ? '<img class=\"writer-credit-photo\" src=\"' + writerPhotoUrl + '\" alt=\"' + articleAuthor + '\" loading=\"lazy\">' : '')
            + '<div class=\"writer-credit-info\"><h4>Written by ' + articleAuthor + '</h4>'
            + (writerBio ? '<p>' + writerBio + '</p>' : '')
            + '</div></div>';
          articleBody.innerHTML =
            '<img class=\\\"featured-img\\\" src=\\\"' + coverUrl + '\\\" alt=\\\"' + articleTitle + '\\\" loading=\\\"lazy\\\">' +
            '<div class=\\\"meta\\\">' + categories + ' &middot; ' + articleAuthor + ' &middot; ' + publishDate + '</div>' +
            '<h1>' + articleTitle + '</h1>' +
            bodyHtml +
            writerCreditHtml;
          document.title = (article.title || 'Article') + ' - Feats.';
          const description = document.querySelector('meta[name=\\\"description\\\"]');
          if (description) {{
            const excerpt = String(article.excerpt || '').slice(0, 160);
            description.setAttribute('content', excerpt || MUSIC_PAGE_DESCRIPTION);
          }}
          initArticleCarousels(articleBody);
        }})
        .catch(function(error) {{
          console.warn('Unable to hydrate article for', articleSlug, error);
          articleBody.innerHTML = '<h1>Article unavailable</h1><p>We could not load that article right now.</p><p><a href=\"/music/\">Back to music</a></p>';
          document.title = 'Article unavailable - Feats.';
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

    function loadArticles() {{
      return fetch(ARTICLE_API_BASE + '/api/articles', {{ cache: 'no-store' }})
        .then(function(response) {{
          if (!response.ok) throw new Error('API request failed: ' + response.status);
          return response.json();
        }})
        .then(function(payload) {{
          return payload && Array.isArray(payload.articles) ? payload.articles : [];
        }})
        .catch(function(apiError) {{
          console.warn('Falling back to static article_index.json', apiError);
          return fetch('/article_index.json')
            .then(function(response) {{ return response.json(); }});
        }});
    }}

    const requestedArticleSlug = getRequestedArticleSlug();
    const legacyRequestedArticleSlug = getLegacyRequestedArticleSlug();
    const canonicalArticleSlug = requestedArticleSlug || legacyRequestedArticleSlug;
    if (canonicalArticleSlug) {{
      normalizeLegacyArticleQuery(canonicalArticleSlug);
      showArticleMode(canonicalArticleSlug);
    }} else {{
      showListingMode();
      loadArticles()
        .then(function(payload) {{
          allArticles = normalizeArticles(payload);
          renderArticles(allArticles.slice(0, PER_PAGE));
          if (allArticles.length > PER_PAGE) {{
            document.getElementById('load-more').style.display = 'block';
          }}
        }})
        .catch(function(error) {{
          console.error('Failed to load articles', error);
        }});
    }}
  </script>
</body>
</html>
"""


def write_article_pages(articles: list[dict]) -> int:
    generated = 0
    MUSIC_DIR.mkdir(parents=True, exist_ok=True)
    for article in articles:
        page_dir = MUSIC_DIR / article["url_id"]
        page_dir.mkdir(parents=True, exist_ok=True)
        (page_dir / "index.html").write_text(render_article_page(article), encoding="utf-8")
        generated += 1
    return generated

def render_dynamic_article_shell() -> str:
    return """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Redirecting…</title>
</head>
<body>
  <script>
    (function() {
      function normalizeSlug(raw) {
        return String(raw || '').trim().replace(/^[/]+/g, '').replace(/[/]+$/g, '');
      }
      var searchParams = new URLSearchParams(window.location.search || '');
      var slug = normalizeSlug(searchParams.get('article') || searchParams.get('slug') || searchParams.get('') || '');
      if (slug) {
        window.location.replace('/music/?article=' + encodeURIComponent(slug));
      } else {
        window.location.replace('/music/');
      }
    })();
  </script>
</body>
</html>
"""


def write_dynamic_article_shell() -> Path:
    dynamic_dir = MUSIC_DIR / DYNAMIC_ARTICLE_ROUTE_SEGMENT
    dynamic_dir.mkdir(parents=True, exist_ok=True)
    destination = dynamic_dir / "index.html"
    destination.write_text(render_dynamic_article_shell(), encoding="utf-8")
    return destination


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
    const ARTICLE_API_BASE = '{PUBLIC_API_BASE}';
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
        card.innerHTML = '<a href=\\\"/music/?article=' + slug + '\\\">'
          + '<img src="' + cover + '" alt="' + title + '" loading="lazy">'
          + '<div class="meta"><span>' + categories + '</span><span>' + author + '</span><span>' + formattedDate + '</span></div>'
          + '<h2>' + title + '</h2>'
          + '<p>' + description + '</p>'
          + '<span class="read-more">Read More</span></a>';
        grid.appendChild(card);
      }});
      setTimeout(function() {{
        grid.querySelectorAll('.music-card:not(.visible)').forEach(function(el) {{
          cardsObserver.observe(el);
        }});
      }}, 50);
    }}

    var cardsObserver = new IntersectionObserver(function(entries) {{
      entries.forEach(function(entry) {{
        if (entry.isIntersecting) {{
          entry.target.classList.add('visible');
          cardsObserver.unobserve(entry.target);
        }}
      }});
    }}, {{ rootMargin: '0px 0px 80px 0px' }});

    function loadMore() {{
      currentPage += 1;
      const start = currentPage * PER_PAGE;
      const end = start + PER_PAGE;
      renderArticles(allArticles.slice(start, end));
      if (end >= allArticles.length) {{
        document.getElementById('load-more').style.display = 'none';
      }}
    }}

    function loadArticles() {{
      return fetch(ARTICLE_API_BASE + '/api/articles', {{ cache: 'no-store' }})
        .then(function(response) {{
          if (!response.ok) throw new Error('API request failed: ' + response.status);
          return response.json();
        }})
        .then(function(payload) {{
          return payload && Array.isArray(payload.articles) ? payload.articles : [];
        }})
        .catch(function(apiError) {{
          console.warn('Falling back to static article_index.json', apiError);
          return fetch('/article_index.json')
            .then(function(response) {{ return response.json(); }});
        }});
    }}

    loadArticles()
      .then(function(payload) {{
        allArticles = normalizeArticles(payload);
        renderArticles(allArticles.slice(0, PER_PAGE));
        if (allArticles.length > PER_PAGE) {{
          document.getElementById('load-more').style.display = 'block';
        }}
      }})
      .catch(function(error) {{
        console.error('Failed to load articles', error);
      }});
  </script>
</body>
</html>
"""


def write_music_listing() -> None:
    MUSIC_DIR.mkdir(parents=True, exist_ok=True)
    (MUSIC_DIR / "index.html").write_text(render_music_listing_query_mode(), encoding="utf-8")


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
        if child.name in RESERVED_MUSIC_DIRS:
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
        "--scrape-layouts",
        action="store_true",
        help="Scrape legacy Squarespace body layouts and convert side image/gallery blocks.",
    )
    parser.add_argument(
        "--persist-scraped-layouts",
        action="store_true",
        help="When using --source local with --scrape-layouts, write converted bodies back to api/articles_clean.json.",
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

    writer_profiles = load_writer_profiles()
    print(f"Loaded {len(writer_profiles)} writer manager profiles")

    articles = normalize_articles(raw_articles, writer_profiles=writer_profiles)
    print(f"Normalized to {len(articles)} published article records")

    if args.scrape_layouts:
        updated_layouts = enrich_articles_with_legacy_layouts(articles, writer_profiles=writer_profiles)
        print(f"Applied scraped layouts to {updated_layouts} articles")
        if args.persist_scraped_layouts and args.source == "local":
            persisted = persist_scraped_layouts(raw_articles, articles)
            print(f"Persisted converted bodies to {API_ARTICLES_PATH} for {persisted} records")

    write_article_index(articles)
    print(f"Wrote {INDEX_JSON_PATH}")

    generated = write_article_pages(articles)
    print(f"Generated {generated} article pages under {MUSIC_DIR}")

    write_music_listing()
    print(f"Wrote {MUSIC_DIR / 'index.html'}")
    dynamic_shell = write_dynamic_article_shell()
    print(f"Wrote {dynamic_shell}")

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