const fs = require('fs');
const path = require('path');
const musicDir = 'C:\Users\Louis\Desktop\Code\Feats\music';
const dirs = fs.readdirSync(musicDir).filter(function(d) { return fs.statSync(path.join(musicDir, d)).isDirectory(); });
var updated = 0;
dirs.forEach(function(dir) {
  var htmlPath = path.join(musicDir, dir, 'index.html');
  if (!fs.existsSync(htmlPath)) return;
  var html = fs.readFileSync(htmlPath, 'utf8');
  var nl = html.indexOf('\r\n') !== -1 ? '\r\n' : '\n';
  var oldCode = "document.getElementById('navLinks').classList.toggle('open');" + nl + "    });";
  var newCode = "this.classList.toggle('open');" + nl + "      document.getElementById('navLinks').classList.toggle('open');" + nl + "      document.body.style.overflow = document.getElementById('navLinks').classList.contains('open') ? 'hidden' : '';" + nl + "    });";
  if (html.indexOf(oldCode) !== -1) {
    html = html.split(oldCode).join(newCode);
    fs.writeFileSync(htmlPath, html, 'utf8');
    updated++;
  }
});
console.log('Updated: ' + updated + ' article pages');