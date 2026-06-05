import os
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed

BASE = r'C:\Users\Louis\Desktop\Code\Feats'
API = 'https://feats-api.fpvgate-analytics.workers.dev'

files = []
img_dir = os.path.join(BASE, 'images')
for root, _, fs in os.walk(img_dir):
    for f in fs:
        if f.endswith('.jpg') or f.endswith('.png') or f.endswith('.ico'):
            full = os.path.join(root, f)
            rel = os.path.relpath(full, BASE)
            key = rel.replace('\\', '/')
            files.append((key, full))

print(f'Uploading {len(files)} images...')

def upload(key, full):
    try:
        r = requests.put(f'{API}/{key}', data=open(full, 'rb'), timeout=60)
        if r.status_code == 200:
            return ('ok', key)
        elif r.status_code == 409:
            return ('skip', key)
        else:
            return ('fail', f'{key}: {r.status_code}')
    except Exception as e:
        return ('fail', f'{key}: {e}')

ok = 0
skip = 0
fail = 0
with ThreadPoolExecutor(max_workers=10) as ex:
    fut = {ex.submit(upload, k, f): k for k, f in files}
    for f in as_completed(fut):
        status, msg = f.result()
        if status == 'ok':
            ok += 1
        elif status == 'skip':
            skip += 1
        else:
            fail += 1
            print(f'FAILED: {msg}')
        total = ok + skip + fail
        if total % 200 == 0:
            print(f'  {total}/{len(files)} ({ok} new, {skip} existing, {fail} fail)')

print(f'Done! {ok} uploaded, {skip} skipped, {fail} failed')
