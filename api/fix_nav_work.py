import os, re

BASE = r'C:\Users\Louis\Desktop\Code\Feats'

music_lis = os.path.join(BASE, 'music', 'index.html')
with open(music_lis, 'r', encoding='utf-8') as f:
    c = f.read()
old = c

c = c.replace('<a href="../music?offset=0" class="btn">Older Posts</a>\n      </div>', '')
c = c.replace('<div style="text-align:center;margin-top:3rem" id="load-more" style="display:none">', '<div style="text-align:center;margin-top:3rem" id="load-more">')

if c != old:
    open(music_lis, 'w', encoding='utf-8').write(c)
    print('Fixed music listing')
else:
    print('No music listing changes')

# Also fix nav in articles
for root, _, fs in os.walk(os.path.join(BASE, 'music')):
    for f in fs:
        if f != 'index.html':
            continue
        path = os.path.join(root, f)
        with open(path, 'r', encoding='utf-8') as fh:
            h = fh.read()
        old_h = h
        h = h.replace('<a href="/">Work</a>', '')
        h = h.replace('<a href="/">Work</a>\n      ', '')
        if h != old_h:
            open(path, 'w', encoding='utf-8').write(h)
            print('Fixed:', os.path.relpath(path, BASE))

# Fix index.html
idx = os.path.join(BASE, 'index.html')
with open(idx, 'r', encoding='utf-8') as f:
    c = f.read()
old = c
c = c.replace('<a href="/">Work</a>\n      ', '')
if c != old:
    open(idx, 'w', encoding='utf-8').write(c)
    print('Fixed index.html')

# Fix about and contact
for p in [os.path.join(BASE, 'about', 'index.html'), os.path.join(BASE, 'contact', 'index.html')]:
    if os.path.exists(p):
        with open(p, 'r', encoding='utf-8') as f:
            c = f.read()
        old = c
        c = c.replace('<a href="/">Work</a>\n      ', '')
        if c != old:
            open(p, 'w', encoding='utf-8').write(c)
            print('Fixed:', p)

print('Done')
