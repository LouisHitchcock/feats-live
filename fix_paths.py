import os

BASE = r'C:\Users\Louis\Desktop\Code\Feats'

fixes = []
for root, _, files in os.walk(BASE):
    if '.git' in root or 'api' in root:
        continue
    for fn in files:
        if not fn.endswith('.html'):
            continue
        path = os.path.join(root, fn)

        rel = os.path.relpath(path, BASE)
        depth = rel.count(os.sep)
        prefix = '../' * depth if depth > 0 else ''

        with open(path, 'r', encoding='utf-8') as f:
            html = f.read()
        old = html

        for tgt in ['css/', 'images/', 'favicon.ico', 'article_index.json']:
            expected = prefix + tgt
            html = html.replace('href="' + tgt, 'href="' + expected)
            html = html.replace('src="' + tgt, 'src="' + expected)
            html = html.replace('url("' + tgt, 'url("' + expected)
            html = html.replace('fetch("' + tgt, 'fetch("' + expected)

        for nav in ['music', 'about', 'contact']:
            expected = prefix + nav
            html = html.replace('href="' + nav + '"', 'href="' + expected + '"')

        for f_link in ['youth-development', 'privacy-policy', 'sitemap.xml', 'robots.txt']:
            expected = prefix + f_link
            html = html.replace('href="' + f_link + '"', 'href="' + expected + '"')

        html = html.replace('href="s/', 'href="' + prefix + 's/')
        html = html.replace('href="music?', 'href="' + prefix + 'music?')

        if depth == 1:
            html = html.replace('href="../../', 'href="../')
            html = html.replace('src="../../', 'src="../')
            html = html.replace('fetch("../../', 'fetch("../')
        elif depth >= 2:
            html = html.replace('href="../../', 'href="../')
            html = html.replace('src="../../', 'src="../')
            html = html.replace('fetch("../../', 'fetch("../')
            html = html.replace('href="../../../', 'href="../../')
            html = html.replace('src="../../../', 'src="../../')
            html = html.replace('fetch("../../../', 'fetch("../../')

        if html != old:
            with open(path, 'w', encoding='utf-8') as f:
                f.write(html)
            fixes.append(rel)

print(f'Fixed: {len(fixes)} files')
for p in fixes:
    print(f'  {p}')
