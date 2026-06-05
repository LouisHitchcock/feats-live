import os, re, requests, xml.etree.ElementTree as ET
from urllib.parse import urlparse
from datetime import datetime

BASE = r'C:\Users\Louis\Desktop\Code\Feats'
XML_PATH = r'C:\Users\Louis\Downloads\Squarespace-Wordpress-Export-06-05-2026.xml'
IMAGES_DIR = os.path.join(BASE, 'images', 'articles')

print('Parsing XML...')
tree = ET.parse(XML_PATH)
channel = tree.getroot().find('channel')

NS = {
    'content': 'http://purl.org/rss/1.0/modules/content/',
    'wp': 'http://wordpress.org/export/1.2/',
}

articles = []
for item in channel.findall('item'):
    if item.findtext('wp:status', '', NS) != 'publish':
        continue
    link = item.findtext('link', '')
    url_id = link.split('/')[-1] if '/' in link else ''
    if not url_id:
        continue
    title = item.findtext('title', 'Untitled')
    body = item.findtext('content:encoded', '', NS) or ''
    excerpt_raw = item.findtext('{http://wordpress.org/export/1.2/excerpt/}encoded', '', NS) or ''
    excerpt = re.sub(r'<[^>]+>', '', excerpt_raw)[:300]
    author = (item.findtext('dc:creator', 'Feats.') or 'Feats.').strip()
    dt = datetime.now()
    try:
        dt = datetime.strptime(item.findtext('wp:post_date', '', NS)[:19], '%Y-%m-%d %H:%M:%S')
    except:
        pass
    date_str = dt.strftime('%d %B %Y').lstrip('0')
    cats = [c.text for c in item.findall('category') if c.get('domain') == 'category' and c.text]
    m = re.search(r'<img[^>]+src="([^"]+)"', body)
    first_img = m.group(1) if m else ''
    articles.append({
        'title': title, 'url_id': url_id, 'body': body,
        'excerpt': excerpt, 'author': author, 'date_str': date_str,
        'cats': cats, 'cover': first_img,
    })

print(f'Loaded {len(articles)} articles')
os.makedirs(IMAGES_DIR, exist_ok=True)

# Collect all image URLs
all_urls = set()
for a in articles:
    if a['cover']:
        all_urls.add(a['cover'])
    for m in re.finditer(r'<img[^>]+src="([^"]+)"', a['body']):
        url = m.group(1)
        if 'squarespace-cdn.com' in url or 'images.squarespace-cdn.com' in url:
            all_urls.add(url)

print(f'Found {len(all_urls)} unique image URLs to download')

# Download images
downloaded = 0
failed = 0
for url in sorted(all_urls):
    parsed = urlparse(url)
    fname = parsed.path.rstrip('/').split('/')[-1].split('?')[0]
    if not fname or '.' not in fname:
        fname = 'image.jpg'
    filepath = os.path.join(IMAGES_DIR, fname)
    if os.path.exists(filepath):
        continue
    try:
        dl_url = url.split('?')[0] + '?format=original'
        r = requests.get(dl_url, timeout=15, headers={'User-Agent': 'Mozilla/5.0'})
        if r.status_code == 200:
            with open(filepath, 'wb') as f:
                f.write(r.content)
            downloaded += 1
            print(f'  OK: {fname}')
        else:
            failed += 1
    except Exception as e:
        failed += 1

print(f'Downloaded {downloaded} new images, {failed} failed')
total = len([f for f in os.listdir(IMAGES_DIR) if os.path.isfile(os.path.join(IMAGES_DIR, f))])
print(f'Total images in /images/articles/: {total}')

# Build URL -> local path map
print('Building replacement map...')
def url_to_local(url):
    parsed = urlparse(url)
    fname = parsed.path.rstrip('/').split('/')[-1].split('?')[0]
    if not fname or '.' not in fname:
        fname = 'image.jpg'
    local = f'/images/articles/{fname}'
    if os.path.exists(os.path.join(IMAGES_DIR, fname)):
        return local
    return None

# Replace image URLs in article pages
print('Updating article pages...')
updated_articles = 0
for a in articles:
    url_id = a['url_id']
    page_path = os.path.join(BASE, 'music', url_id, 'index.html')
    if not os.path.exists(page_path):
        continue
    with open(page_path, 'r', encoding='utf-8') as f:
        html = f.read()
    
    changed = False
    # Body images
    for m in re.finditer(r'<img[^>]+src="([^"]+)"', a['body']):
        orig = m.group(1)
        local = url_to_local(orig)
        if local and orig in html:
            html = html.replace(orig, local)
            changed = True
    # Cover image
    if a['cover']:
        local = url_to_local(a['cover'])
        if local and a['cover'] in html:
            html = html.replace(a['cover'], local)
            changed = True
    
    if changed:
        with open(page_path, 'w', encoding='utf-8') as f:
            f.write(html)
        updated_articles += 1

print(f'Updated {updated_articles} article pages with local image references')

# Update music listing
print('Updating music listing...')
listing_path = os.path.join(BASE, 'music', 'index.html')
with open(listing_path, 'r', encoding='utf-8') as f:
    listing = f.read()

for a in articles[:20]:
    if a['cover']:
        local = url_to_local(a['cover'])
        if local and a['cover'] in listing:
            listing = listing.replace(a['cover'], local)

with open(listing_path, 'w', encoding='utf-8') as f:
    f.write(listing)

# Also update index.html and about page
for page in [os.path.join(BASE, 'index.html'), os.path.join(BASE, 'about', 'index.html')]:
    if os.path.exists(page):
        with open(page, 'r', encoding='utf-8') as f:
            html = f.read()
        # Replace any squarespace-cdn URLs
        for m in re.finditer(r'src="([^"]*squarespace-cdn[^"]+)"', html):
            orig = m.group(1)
            local = url_to_local(orig)
            if local:
                html = html.replace(orig, local)
        with open(page, 'w', encoding='utf-8') as f:
            f.write(html)

print('Done! All images localised.')
