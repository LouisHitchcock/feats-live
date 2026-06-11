(function() {
  var root = document.documentElement;
  var accentPalette = [
    '#9fb8ff', '#b9f2d0', '#d8f5a2', '#6185fa',
    '#b7c4ff', '#d7b8ff', '#67c26e', '#9267b5'
  ];
  var accentTargets = [
    '.hero-kicker',
    '.btn',
    '.nav-links > a',
    '.section-title',
    '.mq-dot',
    '.dot',
    '.recent-card h3',
    '.music-card h2',
    '.contact-group h3',
    '.contact-social a',
    '.team-card img'
  ].join(',');

  function getAccentInk(hex) {
    var value = (hex || '').replace('#', '');
    if (value.length !== 6) return '#fff';
    var r = parseInt(value.slice(0, 2), 16);
    var g = parseInt(value.slice(2, 4), 16);
    var b = parseInt(value.slice(4, 6), 16);
    var yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return yiq >= 150 ? '#141414' : '#fff';
  }
  function randomAccent() {
    return accentPalette[Math.floor(Math.random() * accentPalette.length)];
  }

  function applyAccentToElement(el) {
    if (!el || el.getAttribute('data-accentized') === 'true') return;
    var accent = randomAccent();
    el.style.setProperty('--accent', accent);
    el.style.setProperty('--accent-ink', getAccentInk(accent));
    el.setAttribute('data-accentized', 'true');
  }

  function applyAccentPalette(scope) {
    var ctx = scope && scope.querySelectorAll ? scope : document;
    var elements = ctx.querySelectorAll(accentTargets);
    for (var i = 0; i < elements.length; i++) {
      applyAccentToElement(elements[i]);
    }
  }

  root.style.setProperty('--accent', accentPalette[0]);
  root.style.setProperty('--accent-ink', getAccentInk(accentPalette[0]));
  applyAccentPalette(document);
  window.applyAccentPalette = applyAccentPalette;
  var btn = document.getElementById('themeToggle');
  if (!btn) return;
  btn.addEventListener('click', function() {
    var cur = root.getAttribute('data-theme') ||
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    var next = cur === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch (e) {}
  });
})();
