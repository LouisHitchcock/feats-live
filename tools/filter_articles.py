import os, requests, json

BASE = r'C:\Users\Louis\Desktop\Code\Feats'
API = 'https://feats-api.fpvgate-analytics.workers.dev/api/articles'

bad_urls = {'about', 'contact', 'workv2', 'privacy-policy', 'youth-development', 'membersite-home-page-1'}

with open(os.path.join(BASE, 'api', 'articles_clean.json'), 'r', encoding='utf-8') as f:
    articles = json.load(f)

filtered = [a for a in articles if a['url_id'] not in bad_urls]
print(f'Filtered: {len(filtered)} articles (removed {len(articles) - len(filtered)})')

# Update article_index.json
index = [{k: a[k] for k in ['url_id','title','excerpt','author','publish_date','categories','cover_url']} for a in filtered]
with open(os.path.join(BASE, 'article_index.json'), 'w', encoding='utf-8') as f:
    json.dump(index, f, indent=2)

# Re-seed via API
ok = 0
for a in filtered:
    r = requests.post(API, json=a, timeout=30)
    if r.status_code == 201:
        ok += 1

print(f'Seeded {ok} articles')

# Remove static article directories for deleted articles
import shutil
deleted = 0
for url_id in bad_urls:
    dir_path = os.path.join(BASE, 'music', url_id)
    if os.path.exists(dir_path):
        shutil.rmtree(dir_path)
        deleted += 1

print(f'Removed {deleted} static directories')
