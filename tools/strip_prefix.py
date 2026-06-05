import os, re

BASE = r'C:\Users\Louis\Desktop\Code\Feats'

# Files to fix
files = []
for root, _, fs in os.walk(BASE):
    if '.git' in root or 'api' in root or 'tools' in root:
        continue
    for f in fs:
        if f.endswith('.html'):
            files.append(os.path.join(root, f))

# Also fix sitemap, robots
files.append(os.path.join(BASE, 'sitemap.xml'))

count = 0
for p in files:
    with open(p, 'r', encoding='utf-8') as fh:
        c = fh.read()
    old = c
    c = c.replace('/feats-live/', '/')
    c = c.replace('/feats-live"', '/')
    if c != old:
        with open(p, 'w', encoding='utf-8') as fh:
            fh.write(c)
        count += 1
        print('Fixed:', os.path.relpath(p, BASE))

print(f'\n{count} files updated. Paths now serve from domain root.')
