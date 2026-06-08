const carousel = document.getElementById('carousel');
const slides = carousel ? carousel.querySelectorAll('.carousel-slide') : [];
const dotsContainer = document.getElementById('carouselDots');
let currentIndex = 0;

if (carousel && slides.length && dotsContainer) {
  slides.forEach(function(_, i) {
    const dot = document.createElement('div');
    dot.className = 'dot' + (i === 0 ? ' active' : '');
    dot.addEventListener('click', function() { goToSlide(i); });
    dotsContainer.appendChild(dot);
  });

  function goToSlide(index) {
    currentIndex = index;
    carousel.style.transform = 'translateX(-' + (index * 100) + '%)';
    dotsContainer.querySelectorAll('.dot').forEach(function(d, i) { d.classList.toggle('active', i === index); });
  }

  setInterval(function() {
    goToSlide((currentIndex + 1) % slides.length);
  }, 5000);
}
