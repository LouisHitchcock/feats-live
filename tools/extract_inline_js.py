import sys

with open(sys.argv[1], 'r', encoding='utf-8') as f:
    content = f.read()

# After replacing CSS, there should be an inline <script> block
# Find the first <script> that is NOT external (starts with <script> with no src)
import re

# Find script tags
pattern = r'<script>(.*?)</script>'
match = re.search(pattern, content, re.DOTALL)
if match:
    js_code = match.group(1)
    # Write to js/admin.js
    with open(sys.argv[2], 'w', encoding='utf-8') as g:
        g.write(js_code)
    print(f'Wrote {len(js_code)} chars to {sys.argv[2]}')
    # Replace inline script with external reference
    new_content = content[:match.start()] + '<script src="/js/admin.js"></script>' + content[match.end():]
    with open(sys.argv[1], 'w', encoding='utf-8') as g:
        g.write(new_content)
    print('Admin HTML updated')
else:
    print('No inline script found')
    print(content[:2000])
