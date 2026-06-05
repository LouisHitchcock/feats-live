import os, re, xml.etree.ElementTree as ET
from datetime import datetime

XML = r'C:\Users\Louis\Downloads\Squarespace-Wordpress-Export-06-05-2026.xml'
NS = {
    'content': 'http://purl.org/rss/1.0/modules/content/',
    'wp': 'http://wordpress.org/export/1.2/',
}

OUT = r'C:\Users\Louis\Desktop\Code\Feats\api\src\seed_batch.sql'

tree = ET.parse(XML)
channel = tree.getroot().find('channel')

def esc(s):
    return s.replace("'", "''")

with open(OUT, 'w', encoding='utf-8') as f:
    f.write('DELETE FROM articles;\n')

count = 0
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
    cats = ', '.join(c.text for c in item.findall('category') if c.get('domain') == 'category' and c.text)
    m = re.search(r'<img[^>]+src="([^"]+)"', body)
    cover = m.group(1) if m else ''

    stmt = (f"INSERT INTO articles (title,url_id,body,excerpt,author,publish_date,categories,cover_url,status) VALUES("
        f"'{esc(title)}','{esc(url_id)}','{esc(body)}','{esc(excerpt)}','{esc(author)}',"
        f"'{esc(publish_date)}','{esc(cats)}','{esc(cover)}','publish');\n")

    with open(OUT, 'a', encoding='utf-8') as f:
        f.write(stmt)
    count += 1
    if count % 20 == 0:
        is_kb = os.path.getsize(OUT) / 1024
        print(f'  {count} articles written ({is_kb:.0f} KB)...')

print(f'Done! {count} INSERT statements written to {OUT}')
