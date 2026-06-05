import os

BASE = r'C:\Users\Louis\Desktop\Code\Feats'
p = os.path.join(BASE, 'index.html')
with open(p, 'r', encoding='utf-8') as f:
    c = f.read()
old = c

recent_js = '''
    // Load recent articles
    fetch("/feats-live/article_index.json")
      .then(function(r) { return r.json(); })
      .then(function(data) {
        var grid = document.getElementById("recent-grid");
        var recent = data.slice(0, 4);
        var months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
        recent.forEach(function(a) {
          var card = document.createElement("article");
          card.className = "recent-card";
          var cover = a.cover_url || "https://feats-api.fpvgate-analytics.workers.dev/images/hero-3.jpg";
          var safe = a.title.replace(/"/g, "&quot;");
          var parts = a.publish_date.split("-");
          var dateStr = parseInt(parts[2]) + " " + months[parseInt(parts[1]) - 1] + " " + parts[0];
          card.innerHTML = "<a href=\"/feats-live/music/" + a.url_id + "\">"
            + "<img src=\"" + cover + "\" alt=\"" + safe + "\" loading=\"lazy\">"
            + "<div class=\"date\">" + dateStr + "</div>"
            + "<h3>" + a.title + "</h3>"
            + "<p class=\"excerpt\">" + (a.excerpt || "").substring(0, 150) + "</p>"
            + "<span class=\"read-more\">Read more →</span></a>";
          grid.appendChild(card);
        });
      });
  </script>'''

c = c.replace('  </script>', recent_js)

if c != old:
    with open(p, 'w', encoding='utf-8') as f:
        f.write(c)
    print('Fixed index.html with recent articles JS')
else:
    print('No changes')
