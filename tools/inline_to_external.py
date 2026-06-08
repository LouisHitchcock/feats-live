import sys

with open(sys.argv[1], 'r', encoding='utf-8') as f:
    content = f.read()

style_start = '<style>'
style_end = '</style>'

idx = content.find(style_start)
end_idx = content.find(style_end, idx)

if idx > 0 and end_idx > idx:
    new_content = content[:idx] + '<link rel="stylesheet" href="/css/admin.css">\n' + content[end_idx+len(style_end):]
    with open(sys.argv[1], 'w', encoding='utf-8') as g:
        g.write(new_content)
    print('Admin HTML updated')
else:
    print('Style boundaries not found')
