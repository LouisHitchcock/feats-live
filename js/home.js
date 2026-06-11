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

  fetch('https://feats-live.louishitchcock.xyz/api/articles')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var articles = (data.articles || []).slice(0, 5);
      if (!articles.length) { grid.innerHTML = fallbackHtml; return; }

      var html = '';
      articles.forEach(function(a) {
        var img = a.cover_url || '';
        var href = '/music/' + (a.url_id || '');
        var title = escapeHtml(a.title || 'Untitled');
        var excerpt = escapeHtml((a.excerpt || '').substring(0, 200));
        var date = formatDate(a.publish_date);

        html += '<article class="recent-card reveal">' +
          '<a href="' + href + '">' +
          (img ? '<img src="' + img + '" alt="' + title + '" loading="lazy">' : '') +
          '<h3>' + title + '</h3>' +
          '<p class="excerpt">' + excerpt + '</p>' +
          '<span class="read-more">Read more</span>' +
          '<div class="date">' + date + '</div>' +
          '</a></article>';
      });

      grid.innerHTML = html;
      if (window.observeReveals) window.observeReveals(grid.querySelectorAll('.reveal'));
    })
    .catch(function() {
      grid.innerHTML = fallbackHtml;
    });
})();
