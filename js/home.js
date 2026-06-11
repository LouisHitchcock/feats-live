var fadeObserver = new IntersectionObserver(function(entries) {
  entries.forEach(function(entry) {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      fadeObserver.unobserve(entry.target);
    }
  });
}, { rootMargin: '0px 0px 80px 0px' });

document.querySelectorAll('.recent-card').forEach(function(card) {
  fadeObserver.observe(card);
});


(function() {
  var grid = document.getElementById('recentGrid');
  if (!grid) return;

  var months = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  function formatDate(dateStr) {
    if (!dateStr) return '';
    var d = new Date(dateStr.replace(' ', 'T'));
    if (isNaN(d.getTime())) return '';
    return d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
  }

  function escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  var fallbackHtml = grid.innerHTML;

  var apiUrl = 'https://feats-live.louishitchcock.xyz/api/articles';
  fetch(apiUrl)
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var articles = (data.articles || []).slice(0, 4);
      if (!articles.length) { grid.innerHTML = fallbackHtml; return; }

      var html = '';
      articles.forEach(function(a) {
        var img = a.cover_url || '';
        var href = '/music/' + (a.url_id || '');
        var title = escapeHtml(a.title || 'Untitled');
        var excerpt = escapeHtml((a.excerpt || '').substring(0, 200));
        var date = formatDate(a.publish_date);

        html += '<article class="recent-card">' +
          '<a href="' + href + '">' +
          (img ? '<img src="' + img + '" alt="' + title + '" loading="lazy">' : '') +
          '<h3>' + title + '</h3>' +
          '<p class="excerpt">' + excerpt + '</p>' +
          '<span class="read-more">Read more →</span>' +
          '<div class="date">' + date + '</div>' +
          '</a></article>';
      });

      grid.innerHTML = html;

      grid.querySelectorAll('.recent-card').forEach(function(card) {
        fadeObserver.observe(card);
      });
    })
    .catch(function() {
      grid.innerHTML = fallbackHtml;
    });
})();
