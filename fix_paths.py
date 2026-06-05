import os, xml.etree.ElementTree as ET

BASE = r'C:\Users\Louis\Desktop\Code\Feats'
XML = r'C:\Users\Louis\Downloads\Squarespace-Wordpress-Export-06-05-2026.xml'

NS = {'wp': 'http://wordpress.org/export/1.2/'}
tree = ET.parse(XML)
channel = tree.getroot().find('channel')

articles = []
for item in channel.findall('item'):
    if item.findtext('wp:status', '', NS) != 'publish':
        continue
    link = item.findtext('link', '')
    url_id = link.split('/')[-1] if '/' in link else ''
    if url_id:
        articles.append(url_id)

print(f'Article count: {len(articles)}')

fixes = []
for root, _, files in os.walk(BASE):
    for fn in files:
        if not fn.endswith('.html'):
            continue
        path = os.path.join(root, fn)
        with open(path, 'r', encoding='utf-8') as f:
            html = f.read()

        old = html

        # Fix /css/ -> css/
        html = html.replace('href="/css/', 'href="css/')
        html = html.replace('src="/css/', 'src="css/')

        # Fix nav links
        html = html.replace('href="/music"', 'href="music/"')
        html = html.replace('href="/about"', 'href="about/"')
        html = html.replace('href="/contact"', 'href="contact/"')

        # Fix /images/ -> images/
        html = html.replace('src="/images/', 'src="images/')
        html = html.replace('url("/images/', 'url("images/')

        # Fix /favicon.ico -> favicon.ico
        html = html.replace('href="/favicon.ico"', 'href="favicon.ico"')

        # Fix /music/xxx links -> music/xxx
        for a in articles:
            html = html.replace('href="/music/' + a + '"', 'href="music/' + a + '"')
            html = html.replace('href="/music/' + a + '#"', 'href="music/' + a + '#"')

        # Fix /music or /music? -> music/?
        html = html.replace('href="/music?', 'href="music?')

        # Fix /s/ links
        html = html.replace('href="/s/', 'href="s/')
        html = html.replace('href="/youth-development"', 'href="youth-development/"')
        html = html.replace('href="/privacy-policy"', 'href="privacy-policy/"')
        html = html.replace('href="/sitemap.xml"', 'href="sitemap.xml"')
        html = html.replace('href="/robots.txt"', 'href="robots.txt"')

        if html != old:
            with open(path, 'w', encoding='utf-8') as f:
                f.write(html)
            fixes.append(path)

print(f'Fixed: {len(fixes)} files')
for p in fixes:
    print(f'  {p}')
