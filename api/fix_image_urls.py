import os

BASE = r'C:\Users\Louis\Desktop\Code\Feats'
API = 'https://feats-api.fpvgate-analytics.workers.dev'

fixed = 0
for root, _, fs in os.walk(BASE):
    if '.git' in root or 'api' in root:
        continue
    for f in fs:
        if not f.endswith('.html'):
            continue
        path = os.path.join(root, f)
        c = open(path, encoding='utf-8').read()
        old = c
        c = c.replace('src="images/', 'src="' + API + '/images/')
        c = c.replace('url("images/', 'url("' + API + '/images/')
        c = c.replace('src="../images/', 'src="' + API + '/images/')
        c = c.replace('url("../images/', 'url("' + API + '/images/')
        if c != old:
            open(path, 'w', encoding='utf-8').write(c)
            fixed += 1

print(f'Fixed {fixed} files')
