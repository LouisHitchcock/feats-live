const fs = require('fs');
const path = require('path');

// Update homepage
var home = fs.readFileSync('index.html', 'utf8');
home = home.replace(
  '<button class="nav-toggle" id="navToggle" aria-label="Toggle menu">☰</button>',
  '<button class="nav-toggle" id="navToggle" aria-label="Toggle menu"><span></span><span></span><span></span></button>'
);
home = home.replace(
  "document.getElementById('navToggle').addEventListener('click', function(){",
  "document.getElementById('navToggle').addEventListener('click', function(){"
);

// Find and replace the old toggle logic
var oldToggle = "      document.getElementById('navLinks').classList.toggle('open');\n    });";
var newToggle = "      this.classList.toggle('open');\n      document.getElementById('navLinks').classList.toggle('open');\n      document.body.style.overflow = document.getElementById('navLinks').classList.contains('open') ? 'hidden' : '';\n    });";
home = home.replace(oldToggle, newToggle);
fs.writeFileSync('index.html', home, 'utf8');
console.log('Homepage updated');

// Update all article pages
var musicDir = 'C:\\Users\\Louis\\Desktop\\Code\\Feats\\music';
var dirs = fs.readdirSync(musicDir).filter(function(d) { return fs.statSync(path.join(musicDir, d)).isDirectory(); });

var updated = 0;
dirs.forEach(function(dir) {
  var htmlPath = path.join(musicDir, dir, 'index.html');
  if (!fs.existsSync(htmlPath)) return;
  var html = fs.readFileSync(htmlPath, 'utf8');

  // Replace hamburger char with spans (check both ☰ and &#9776;)
  var hadToggle = false;
  if (html.indexOf('☰') !== -1) {
    html = html.replace('☰', '<span></span><span></span><span></span>');
    hadToggle = true;
  }
  if (html.indexOf('&#9776;') !== -1) {
    html = html.replace('&#9776;', '<span></span><span></span><span></span>');
    hadToggle = true;
  }

  // Update toggle JS
  var oldJs = "document.getElementById('navLinks').classList.toggle('open');\n    });";
  if (html.indexOf('this.classList.toggle') === -1 && html.indexOf(oldJs) !== -1) {
    // Find the exact line - it should be right after the navToggle click listener
    html = html.replace(
      "document.getElementById('navLinks').classList.toggle('open');",
      "this.classList.toggle('open');\n      document.getElementById('navLinks').classList.toggle('open');\n      document.body.style.overflow = document.getElementById('navLinks').classList.contains('open') ? 'hidden' : '';"
    );
    hadToggle = true;
  }

  fs.writeFileSync(htmlPath, html, 'utf8');
  if (hadToggle) updated++;
});

console.log('Article pages updated: ' + updated);
