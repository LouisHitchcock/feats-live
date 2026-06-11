(function() {
  var btn = document.getElementById('themeToggle');
  if (btn) {
    btn.addEventListener('click', function() {
      var d = document.documentElement;
      var cur = d.getAttribute('data-theme') ||
        (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      var next = cur === 'dark' ? 'light' : 'dark';
      d.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) {}
    });
  }

  // Scroll-to-top button
  var top = document.createElement('button');
  top.className = 'to-top';
  top.setAttribute('aria-label', 'Back to top');
  top.textContent = '\u2191';
  top.addEventListener('click', function() { window.scrollTo({ top: 0 }); });
  document.body.appendChild(top);
  var ticking = false;
  window.addEventListener('scroll', function() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function() {
      top.classList.toggle('show', window.scrollY > 600);
      ticking = false;
    });
  }, { passive: true });
})();
