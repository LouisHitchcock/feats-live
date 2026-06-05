import os, re, json, requests

BASE = r'C:\Users\Louis\Desktop\Code\Feats'
IMG_API = 'https://feats-api.fpvgate-analytics.workers.dev/images/articles'

def fetch_body(url_id):
    try:
        r = requests.get(f'https://feats.live/music/{url_id}?format=json-pretty', timeout=10)
        if r.status_code == 200:
            return r.json()['item']['body']
    except:
        pass
    return None

def convert(body):
    if not body:
        return ''
    parts = []
    pattern = r'<div class="sqs-block ([^"]*)"[^>]*id="[^"]*"[^>]*>(.*?)</div>\s*</div>'
    for m in re.finditer(pattern, body, re.DOTALL):
        classes = m.group(1)
        inner = m.group(2)
        if 'image-block' in classes:
            fc = ''
            if 'float-right' in classes:
                fc = 'img-wrap-right'
            elif 'float-left' in classes:
                fc = 'img-wrap-left'
            img = re.search(r'<img[^>]+src="([^"]+)"[^>]*>', inner)
            if img:
                src = img.group(1)
                if 'squarespace-cdn.com' in src:
                    fn = src.split('/')[-1].split('?')[0]
                    if os.path.exists(os.path.join(BASE, 'images', 'articles', fn)):
                        src = IMG_API + '/' + fn
                cap = re.search(r'<div class="image-caption"><p[^>]*>(.*?)</p>', inner)
                caption = re.sub(r'<[^>]+>', '', cap.group(1)).strip() if cap else ''
                st = 'width:100%;height:auto;display:block;margin:1.5rem 0;border-radius:4px'
                if fc == 'img-wrap-right':
                    st = 'width:45%;height:auto;float:right;margin:0.5rem 0 0.5rem 1.5rem;border-radius:4px'
                elif fc == 'img-wrap-left':
                    st = 'width:45%;height:auto;float:left;margin:0.5rem 1.5rem 0.5rem 0;border-radius:4px'
                out = f'<img src="{src}" alt="" style="{st}" loading="lazy">'
                if caption:
                    out += f'<p style="font-size:.85rem;opacity:.6;clear:both">{caption}</p>'
                parts.append(out)
        elif 'html-block' in classes or 'sqs-block-html' in classes:
            txt = re.search(r'<div class="sqs-html-content"[^>]*>(.*?)</div>', inner, re.DOTALL)
            if txt:
                t = txt.group(1)
                t = re.sub(r'<p class=""[^>]*>', '<p>', t)
                t = re.sub(r' style="[^"]*"', '', t)
                t = re.sub(r' data-[a-z-]+="[^"]*"', '', t)
                t = re.sub(r' class="[^"]*"', '', t)
                t = re.sub(r'<p>&nbsp;</p>', '', t)
                parts.append(t)
        elif 'horizontalrule' in classes:
            parts.append('<hr style="margin:2rem 0;border:none;border-top:1px solid rgba(0,0,0,.1)">')
    return '\n'.join(parts)

r = requests.get('https://feats-api.fpvgate-analytics.workers.dev/api/articles')
articles = r.json()['articles']
print(f'Loaded {len(articles)} articles')

count = 0
for i, a in enumerate(articles):
    body = fetch_body(a['url_id'])
    if body:
        cleaned = convert(body)
        if cleaned:
            a['body'] = cleaned
            count += 1
    if (i+1) % 10 == 0:
        print(f'  {i+1}/{len(articles)} ({count} bodies)')

print(f'Got {count} bodies with layout')

with open(os.path.join(BASE, 'api', 'articles_clean.json'), 'w', encoding='utf-8') as f:
    json.dump(articles, f, ensure_ascii=False, indent=2)

index = [{k: a[k] for k in ['url_id','title','excerpt','author','publish_date','categories','cover_url']} for a in articles]
with open(os.path.join(BASE, 'article_index.json'), 'w', encoding='utf-8') as f:
    json.dump(index, f, indent=2)

print('Done')
if count > 0:
    print('Sample:', articles[0].get('body','')[:300])
else:
    # Debug: show first article body raw
    b = fetch_body(articles[0]['url_id'])
    if b:
        print('Raw body first 500:', b[:500])
    else:
        print('Could not fetch any bodies')
