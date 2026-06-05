const fs = require('fs');
var h = fs.readFileSync('index.html', 'utf8');
var start = h.indexOf('            <div class="carousel-slide">');
var end = h.indexOf('    <!-- WHAT WE DO -->');
if (start !== -1 && end !== -1 && start < end) {
  h = h.substring(0, start) + h.substring(end);
  fs.writeFileSync('index.html', h, 'utf8');
  console.log('Removed orphaned slides');
} else {
  console.log('Not found');
}
