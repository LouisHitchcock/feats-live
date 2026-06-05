const fs = require('fs');
const path = require('path');

const musicDir = path.join(__dirname, '..', '..', 'music');
const dirs = fs.readdirSync(musicDir).filter(function(d) { return fs.statSync(path.join(musicDir, d)).isDirectory(); });

let updated = 0;

dirs.forEach(function(dir) {
  var htmlPath = path.join(musicDir, dir, 'index.html');
  if (!fs.existsSync(htmlPath)) return;
  var html = fs.readFileSync(htmlPath, 'utf8');

  var oldCode = "var apiUrl = window.location.pathname.replace(/\\/$/, '');\n      var slug = window.location.pathname.replace(/\\/$/, '').split('/').pop();\n      fetch('https://feats-api.fpvgate-analytics.workers.dev/api/articles/' + slug)\n        .then(function(data) {";

  var newCode = "var slug = window.location.pathname.replace(/\\/$/, '').split('/').pop();\n      fetch('https://feats-api.fpvgate-analytics.workers.dev/api/articles/' + slug)\n        .then(function(r) { return r.json(); })\n        .then(function(data) {";

  if (html.indexOf('var apiUrl') !== -1) {
    html = html.split(oldCode).join(newCode);
    fs.writeFileSync(htmlPath, html, 'utf8');
    updated++;
  }
});

console.log('Fixed: ' + updated + ' articles');
