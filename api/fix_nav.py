import os

BASE = r'C:\Users\Louis\Desktop\Code\Feats'

fixes = {
    'href="music/"': 'href="/feats-live/music"',
    'href="about/"': 'href="/feats-live/about"',
    'href="contact/"': 'href="/feats-live/contact"',
}

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
        for s, r in fixes.items():
            c = c.replace(s, r)
        if c != old:
            open(path, 'w', encoding='utf-8').write(c)
            fixed += 1
            print('Fixed:', os.path.relpath(path, BASE))

print(f'\nFixed {fixed} files')
