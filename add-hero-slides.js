const fs = require('fs');
var html = fs.readFileSync('index.html', 'utf8');

var newSlides = '';
for (var i = 5; i <= 14; i++) {
  var names = [null,null,null,null,null,'Singer with dreadlocks on stage','YungBlud performing','Black and white concert photo','Concert crowd','Tyler Joseph performing','Singer performing with microphone','NOISY performing','VLURE performing','TRASH BOAT performing','TOP concert'];
  newSlides += '        <div class="carousel-slide">\n';
  newSlides += '          <img src="https://feats-live.louishitchcock.xyz/images/hero-' + i + '.jpg" alt="' + names[i] + '" loading="lazy">\n';
  newSlides += '        </div>\n';
}

html = html.replace('</section>', newSlides + '  </section>');
fs.writeFileSync('index.html', html, 'utf8');
console.log('Added hero slides 5-14');
