const fs = require('fs');
const path = require('path');

const musicDir = path.join(__dirname, '..', '..', 'music');
const dirs = fs.readdirSync(musicDir).filter(d => fs.statSync(path.join(musicDir, d)).isDirectory());

const writerCreditHtml = '      <div class="writer-credit hidden" id="writerCredit"><img class="writer-credit-photo" id="writerPhoto" src="" alt="" /><div class="writer-credit-info"><h4 id="writerName"></h4><p id="writerBio"></p></div></div>\n    </article>';

const writerCreditJs = "    // Fetch writer credit from API\n    (function() {\n      var slug = window.location.pathname.replace(/\\/$/, '').split('/').pop();\n      fetch('https://feats-api.fpvgate-analytics.workers.dev/api/articles/' + slug)\n        .then(function(r) { return r.json(); })\n        .then(function(data) {\n          var a = data.article;\n          if (!a) return;\n          var name = document.getElementById('writerName');\n          var bio = document.getElementById('writerBio');\n          var photo = document.getElementById('writerPhoto');\n          if (name) name.textContent = a.author || 'Feats.';\n          if (bio) bio.textContent = a.writer_bio || '';\n          if (photo && a.writer_photo_url) {\n            photo.src = a.writer_photo_url;\n            photo.alt = a.author || '';\n          }\n          var credit = document.getElementById('writerCredit');\n          if (credit && (a.writer_bio || a.writer_photo_url)) {\n            credit.classList.remove('hidden');\n          }\n        })\n        .catch(function() {});\n    })();\n\n    document.getElementById('navToggle').addEventListener";

let updated = 0;
let skipped = 0;

dirs.forEach(function(dir) {
  const htmlPath = path.join(musicDir, dir, 'index.html');
  if (!fs.existsSync(htmlPath)) { skipped++; return; }
  
  let html = fs.readFileSync(htmlPath, 'utf8');
  if (html.indexOf('writerCredit') !== -1) { skipped++; return; }
  
  html = html.replace('</article>', writerCreditHtml);
  html = html.replace("document.getElementById('navToggle').addEventListener", writerCreditJs);
  
  fs.writeFileSync(htmlPath, html, 'utf8');
  updated++;
});

console.log('Updated: ' + updated + ' articles');
console.log('Skipped: ' + skipped + ' articles');
