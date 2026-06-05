import os, re, json, xml.etree.ElementTree as ET
from datetime import datetime

BASE = r'C:\Users\Louis\Desktop\Code\Feats'
XML_PATH = r'C:\Users\Louis\Downloads\Squarespace-Wordpress-Export-06-05-2026.xml'
API_DIR = os.path.join(BASE, 'api')

# Re-parse the XML for clean data
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
    publish_date = dt.strftime('%Y-%m-%d %H:%M:%S')
    cats = [c.text for c in item.findall('category') if c.get('domain') == 'category' and c.text]
    categories = ', '.join(cats)
    m = re.search(r'<img[^>]+src="([^"]+)"', body)
    cover_url = m.group(1) if m else ''
    # Convert image URLs to local paths
    if cover_url:
        fname = cover_url.rstrip('/').split('/')[-1].split('?')[0]
        local = f'/images/articles/{fname}'
        if os.path.exists(os.path.join(BASE, 'images', 'articles', fname)):
            cover_url = local
    articles.append({
        'url_id': url_id,
        'title': title,
        'body': body,
        'excerpt': excerpt,
        'author': author,
        'publish_date': publish_date,
        'categories': categories,
        'cover_url': cover_url,
        'status': 'publish',
    })

print(f'Parsed {len(articles)} articles')

# Generate the seed SQL
sql_lines = [
    '-- Seed data for feats-db',
    '',
    'DELETE FROM articles;',
    '',
]

def escape_sql(val):
    return "'" + val.replace("'", "''") + "'"

for a in articles:
    sql_lines.append(f"INSERT INTO articles (title, url_id, body, excerpt, author, publish_date, categories, cover_url, status) VALUES (")
    sql_lines.append(f"  {escape_sql(a['title'])},")
    sql_lines.append(f"  {escape_sql(a['url_id'])},")
    sql_lines.append(f"  {escape_sql(a['body'])},")
    sql_lines.append(f"  {escape_sql(a['excerpt'])},")
    sql_lines.append(f"  {escape_sql(a['author'])},")
    sql_lines.append(f"  {escape_sql(a['publish_date'])},")
    sql_lines.append(f"  {escape_sql(a['categories'])},")
    sql_lines.append(f"  {escape_sql(a['cover_url'])},")
    sql_lines.append(f"  {escape_sql(a['status'])}")
    sql_lines.append(");")
    sql_lines.append('')

# Also generate a JSON index for the frontend (no network dependency)
articles_for_index = []
for a in articles:
    articles_for_index.append({
        'url_id': a['url_id'],
        'title': a['title'],
        'excerpt': a['excerpt'],
        'author': a['author'],
        'publish_date': a['publish_date'][:10],
        'categories': a['categories'],
        'cover_url': a['cover_url'],
    })

index_path = os.path.join(BASE, 'article_index.json')
with open(index_path, 'w', encoding='utf-8') as f:
    json.dump(articles_for_index, f, ensure_ascii=False, indent=2)
print(f'Written index: {index_path} ({len(articles_for_index)} articles)')

# Write seed SQL file
sql_path = os.path.join(API_DIR, 'src', 'seed.sql')
with open(sql_path, 'w', encoding='utf-8') as f:
    f.write('\n'.join(sql_lines))
print(f'Written seed SQL: {sql_path}')

print('Done!')
