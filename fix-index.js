const fs = require('fs');
var h = fs.readFileSync('index.html', 'utf8');

// Find the duplicate slides sitting between carousel-controls and WHAT WE DO
var start = h.indexOf('      <div class="carousel-controls"');
var end = h.indexOf('    <!-- WHAT WE DO -->');
var between = h.substring(start, end);

if (between.indexOf('carousel-slide') !== -1) {
  // Has dupes, trim everything after controls div close to WHAT WE DO
  var controlsEnd = h.indexOf('</div>', start) + 6;
  // Find the second </div> that closes the controls div (there are 2 buttons + controls div)
  var secondClose = h.indexOf('</div>', controlsEnd);
  var thirdClose = h.indexOf('</div>', secondClose + 1);
  h = h.substring(0, thirdClose + 6) + '\n' + h.substring(end);
  fs.writeFileSync('index.html', h, 'utf8');
  console.log('Fixed - removed duplicate slides outside carousel');
} else {
  console.log('No duplicates found');
}
