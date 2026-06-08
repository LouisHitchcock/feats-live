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
