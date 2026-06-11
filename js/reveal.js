(function() {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var io = ('IntersectionObserver' in window) ? new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        io.unobserve(entry.target);
      }
    });
  }, { rootMargin: '0px 0px 80px 0px' }) : null;

  window.observeReveals = function(list) {
    var els = Array.prototype.slice.call(list || document.querySelectorAll('.reveal:not(.visible)'));
    els.forEach(function(el, i) {
      if (reduce || !io) { el.classList.add('visible'); return; }
      el.style.transitionDelay = Math.min((i % 6) * 70, 350) + 'ms';
      io.observe(el);
    });
  };

  if (document.readyState !== 'loading') window.observeReveals();
  else document.addEventListener('DOMContentLoaded', function() { window.observeReveals(); });
})();
