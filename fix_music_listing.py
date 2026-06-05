import os, re

BASE = r'C:\Users\Louis\Desktop\Code\Feats'
path = os.path.join(BASE, 'music', 'index.html')

with open(path, 'r', encoding='utf-8') as f:
    html = f.read()

new_grid = '''<div class="music-grid" id="music-grid">
      </div>
      <div style="text-align:center;margin-top:3rem" id="load-more" style="display:none">
        <a href="#" class="btn" onclick="loadMore();return false">Older Posts</a>
      </div>'''

old_grid_match = re.search(r'<div class="music-grid">.*?<div style="text-align:center;margin-top:3rem">', html, re.DOTALL)
if old_grid_match:
    before = html[:old_grid_match.start()]
    after = html[old_grid_match.end():]
    new_html = before + new_grid + after
    with open(path, 'w', encoding='utf-8') as f:
        f.write(new_html)
    print('Replaced grid section')
else:
    print('Could not find grid section')

with open(path, 'r', encoding='utf-8') as f:
    html = f.read()

if '</body>' in html:
    js = '''
<script>
let allArticles = [];
let currentPage = 0;
const PER_PAGE = 12;

function formatDate(d) {
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return parseInt(d.split('-')[2]) + ' ' + months[parseInt(d.split('-')[1])-1] + ' ' + d.split('-')[0];
}

function renderArticles(articles) {
  const grid = document.getElementById('music-grid');
  articles.forEach(function(a) {
    const col = document.createElement('div');
    col.className = 'music-card';
    const cover = a.cover_url || '/images/hero-3.jpg';
    const safeTitle = a.title.replace(/"/g, '&quot;');
    const cats = a.categories || 'Article';
    const desc = (a.excerpt || '').substring(0, 200);
    col.innerHTML = '<a href="/music/' + a.url_id + '">'
      + '<img src="' + cover + '" alt="' + safeTitle + '" loading="lazy">'
      + '<div class="meta"><span>' + cats + '</span><span>' + a.author + '</span><span>' + formatDate(a.publish_date) + '</span></div>'
      + '<h2>' + a.title + '</h2>'
      + '<p>' + desc + '</p>'
      + '<span class="read-more">Read More</span></a>';
    grid.appendChild(col);
  });
}

function loadMore() {
  currentPage++;
  var start = currentPage * PER_PAGE;
  var end = start + PER_PAGE;
  renderArticles(allArticles.slice(start, end));
  if (end >= allArticles.length) {
    document.getElementById('load-more').style.display = 'none';
  }
}

fetch('/article_index.json')
  .then(function(r) { return r.json(); })
  .then(function(data) {
    allArticles = data;
    renderArticles(allArticles.slice(0, PER_PAGE));
    if (allArticles.length > PER_PAGE) {
      document.getElementById('load-more').style.display = 'block';
    }
  });
</script>'''
    html = html.replace('</body>', js + '</body>')
    with open(path, 'w', encoding='utf-8') as f:
        f.write(html)
    print('Added JS block')
else:
    print('No </body> found')

print('Done!')
