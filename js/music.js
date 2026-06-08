const ARTICLE_API_BASE = 'https://feats-live.louishitchcock.xyz';
const ARTICLE_FALLBACK_COVER = 'https://feats-live.louishitchcock.xyz/images/hero-3.jpg';
const MUSIC_PAGE_TITLE = 'Music | Discover Gig Highlights - Feats.';
const MUSIC_PAGE_DESCRIPTION = 'Browse Feats. music articles: live gig reviews, interviews, artist showcases, festival coverage, and editorial content.';
const EXCLUDED_URL_IDS = new Set(["about", "contact", "member-site-homepage-1", "membersite-home-page-1", "privacy-policy", "work-v2", "youth-development"]);
const PER_PAGE = 12;
let allArticles = [];
let currentPage = 0;

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(raw) {
  const value = String(raw || '');
  const pieces = value.split('-');
  if (pieces.length < 3) return value;
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const monthIdx = parseInt(pieces[1], 10) - 1;
  const day = parseInt(pieces[2], 10);
  if (monthIdx < 0 || monthIdx > 11 || Number.isNaN(day)) return value;
  return day + ' ' + months[monthIdx] + ' ' + pieces[0];
}

function normalizeSlug(raw) {
  return String(raw || '').trim().replace(/^[/]+/g, '').replace(/[/]+$/g, '');
}

function getRequestedArticleSlug() {
  const searchParams = new URLSearchParams(window.location.search || '');
  return normalizeSlug(searchParams.get('article') || '');
}

function getLegacyRequestedArticleSlug() {
  const searchParams = new URLSearchParams(window.location.search || '');
  return normalizeSlug(searchParams.get('slug') || searchParams.get('') || '');
}

function normalizeLegacyArticleQuery(articleSlug) {
  const normalizedSlug = normalizeSlug(articleSlug);
  if (!normalizedSlug) return;
  const nextUrl = '/music/?article=' + encodeURIComponent(normalizedSlug);
  const currentUrl = window.location.pathname + window.location.search;
  if (currentUrl !== nextUrl) {
    history.replaceState(null, '', nextUrl);
  }
}

function normalizeArticles(data) {
  if (!Array.isArray(data)) return [];
  return data
    .filter(a => a && typeof a === 'object')
    .filter(a => typeof a.url_id === 'string' && a.url_id.trim().length > 0)
    .filter(a => !EXCLUDED_URL_IDS.has(a.url_id.trim()));
}

function fetchLocalArticleFallback(slug) {
  return fetch('/api/articles_clean.json', { cache: 'no-store' })
    .then(function(response) {
      if (!response.ok) throw new Error('Local fallback fetch failed: ' + response.status);
      return response.json();
    })
    .then(function(rows) {
      if (!Array.isArray(rows)) return null;
      const normalizedSlug = normalizeSlug(slug);
      for (let i = 0; i < rows.length; i += 1) {
        const candidate = rows[i] || {};
        if (normalizeSlug(candidate.url_id || '') === normalizedSlug) return candidate;
      }
      return null;
    });
}

function renderArticles(articles) {
  const grid = document.getElementById('music-grid');
  if (!grid) return;
  articles.forEach(function(article) {
    const slug = escapeHtml(article.url_id || '');
    const title = escapeHtml(article.title || 'Untitled');
    let categories = String(article.categories || '').split(',').map(function(p) { return p.trim(); }).filter(Boolean).slice(0, 3).join(', ');
    if (!categories) categories = 'Article';
    const author = escapeHtml(article.author || 'Feats.');
    const description = escapeHtml((article.excerpt || '').slice(0, 150));
    const cover = escapeHtml(article.cover_url || ARTICLE_FALLBACK_COVER);
    const rawDate = (article.publish_date || '').slice(0, 10);
    const formattedDate = escapeHtml(formatDate(rawDate));
    const card = document.createElement('div');
    card.className = 'music-card';
    card.innerHTML = '<a href="/music/?article=' + slug + '">'
      + '<img src="' + cover + '" alt="' + title + '" loading="lazy">'
      + '<div class="meta"><span>' + categories + '</span><span>' + author + '</span><span>' + formattedDate + '</span></div>'
      + '<h2>' + title + '</h2>'
      + '<p>' + description + '</p>'
      + '<span class="read-more">Read More</span></a>';
    grid.appendChild(card);
  });
  setTimeout(function() {
    grid.querySelectorAll('.music-card:not(.visible)').forEach(function(el) {
      cardsObserver.observe(el);
    });
  }, 50);
}

var cardsObserver = new IntersectionObserver(function(entries) {
  entries.forEach(function(entry) {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      cardsObserver.unobserve(entry.target);
    }
  });
}, { rootMargin: '0px 0px 80px 0px' });

function getCarouselNodes(carousel) {
  return {
    slides: carousel ? carousel.querySelectorAll('.carousel-slide') : [],
    thumbs: carousel ? carousel.querySelectorAll('.carousel-thumb') : []
  };
}

function setCarouselSlideByElement(carousel, nextIndex) {
  if (!carousel) return;
  const nodes = getCarouselNodes(carousel);
  if (!nodes.slides.length) return;
  let safeIndex = parseInt(nextIndex, 10);
  if (Number.isNaN(safeIndex)) safeIndex = 0;
  if (safeIndex < 0) safeIndex = nodes.slides.length - 1;
  if (safeIndex >= nodes.slides.length) safeIndex = 0;
  carousel.setAttribute('data-current-slide', String(safeIndex));
  nodes.slides.forEach(function(slide, index){
    const active = index === safeIndex;
    slide.classList.toggle('is-active', active);
    slide.classList.toggle('active', active);
  });
  nodes.thumbs.forEach(function(thumb, index){
    const active = index === safeIndex;
    thumb.classList.toggle('is-active', active);
    thumb.classList.toggle('active', active);
  });
}

function initSingleCarousel(carousel) {
  if (!carousel || carousel.dataset.bound === '1') return;
  carousel.dataset.bound = '1';
  const prevButton = carousel.querySelector('.carousel-nav.prev, .carousel-nav-prev');
  const nextButton = carousel.querySelector('.carousel-nav.next, .carousel-nav-next');
  if (prevButton) {
    prevButton.addEventListener('click', function(event){
      event.preventDefault();
      let current = parseInt(carousel.getAttribute('data-current-slide') || '0', 10);
      if (Number.isNaN(current)) current = 0;
      setCarouselSlideByElement(carousel, current - 1);
    });
  }
  if (nextButton) {
    nextButton.addEventListener('click', function(event){
      event.preventDefault();
      let current = parseInt(carousel.getAttribute('data-current-slide') || '0', 10);
      if (Number.isNaN(current)) current = 0;
      setCarouselSlideByElement(carousel, current + 1);
    });
  }
  const thumbs = carousel.querySelectorAll('.carousel-thumb');
  thumbs.forEach(function(button, index){
    if (button.dataset.bound === '1') return;
    button.dataset.bound = '1';
    button.addEventListener('click', function(event){
      event.preventDefault();
      setCarouselSlideByElement(carousel, index);
    });
  });
  let initial = parseInt(carousel.getAttribute('data-current-slide') || '0', 10);
  if (Number.isNaN(initial)) initial = 0;
  setCarouselSlideByElement(carousel, initial);
}

function initArticleCarousels(root) {
  const scope = root || document;
  const carousels = scope.querySelectorAll('[data-article-carousel], .article-carousel');
  carousels.forEach(initSingleCarousel);
}

function showListingMode() {
  const listingSection = document.getElementById('musicListingSection');
  const articleBody = document.getElementById('articleBody');
  if (listingSection) listingSection.style.display = '';
  if (articleBody) articleBody.style.display = 'none';
  document.title = MUSIC_PAGE_TITLE;
  const description = document.querySelector('meta[name="description"]');
  if (description) {
    description.setAttribute('content', MUSIC_PAGE_DESCRIPTION);
  }
}

function showArticleMode(articleSlug) {
  const listingSection = document.getElementById('musicListingSection');
  const loadMoreButton = document.getElementById('load-more');
  const articleBody = document.getElementById('articleBody');
  if (!articleBody) return;

  if (listingSection) listingSection.style.display = 'none';
  if (loadMoreButton) loadMoreButton.style.display = 'none';
  articleBody.style.display = '';
  articleBody.setAttribute('data-article-slug', articleSlug);
  articleBody.innerHTML = '<p>Loading article...</p>';

  fetch(ARTICLE_API_BASE + '/api/articles/' + encodeURIComponent(articleSlug), { cache: 'no-store' })
    .then(function(response) {
      if (!response.ok) throw new Error('Article API request failed: ' + response.status);
      return response.json();
    })
    .then(function(payload) {
      const article = payload && payload.article ? payload.article : null;
      if (!article) throw new Error('Article payload missing');
      return fetchLocalArticleFallback(articleSlug)
        .then(function(localArticle) {
          if (localArticle && String(localArticle.body || '').trim()) {
            article.body = localArticle.body;
            if (!article.excerpt && localArticle.excerpt) article.excerpt = localArticle.excerpt;
            if (!article.cover_url && localArticle.cover_url) article.cover_url = localArticle.cover_url;
            if (!article.categories && localArticle.categories) article.categories = localArticle.categories;
            if (!article.publish_date && localArticle.publish_date) article.publish_date = localArticle.publish_date;
            if ((!article.author || article.author === 'Feats.') && localArticle.author) article.author = localArticle.author;
          }
          return article;
        })
        .catch(function() { return article; });
    })
    .then(function(article) {
      if (!article) return;
      const articleTitle = escapeHtml(article.title || 'Untitled Article');
      const articleAuthor = escapeHtml(article.author || 'Feats.');
      let categories = String(article.categories || '')
        .split(',')
        .map(function(part) { return part.trim(); })
        .filter(Boolean)
        .slice(0, 5)
        .map(escapeHtml)
        .join(' &middot; ');
      if (!categories) categories = 'Article';
      const publishDate = escapeHtml(formatDate(String(article.publish_date || '').slice(0, 10)));
      const bodyHtml = article.body || '<p></p>';
      const writerPhotoUrl = escapeHtml(article.writer_photo_url || '');
      const writerBio = escapeHtml(article.writer_bio || '');
      const writerCreditHtml = '<div class="writer-credit" id="writerCredit">'
        + (writerPhotoUrl ? '<img class="writer-credit-photo" src="' + writerPhotoUrl + '" alt="' + articleAuthor + '" loading="lazy">' : '')
        + '<div class="writer-credit-info"><h4>Written by ' + articleAuthor + '</h4>'
        + (writerBio ? '<p>' + writerBio + '</p>' : '')
        + '</div></div>';
      articleBody.innerHTML =
        '<div class=\"meta\">' + categories + ' &middot; ' + articleAuthor + ' &middot; ' + publishDate + '</div>' +
        '<h1>' + articleTitle + '</h1>' +
        bodyHtml +
        writerCreditHtml;
      document.title = (article.title || 'Article') + ' - Feats.';
      const description = document.querySelector('meta[name="description"]');
      if (description) {
        const excerpt = String(article.excerpt || '').slice(0, 160);
        description.setAttribute('content', excerpt || MUSIC_PAGE_DESCRIPTION);
      }
      initArticleCarousels(articleBody);
    })
    .catch(function(error) {
      console.warn('Unable to hydrate article for', articleSlug, error);
      articleBody.innerHTML = '<h1>Article unavailable</h1><p>We could not load that article right now.</p><p><a href="/music/">Back to music</a></p>';
      document.title = 'Article unavailable - Feats.';
    });
}

function loadMore() {
  currentPage += 1;
  const start = currentPage * PER_PAGE;
  const end = start + PER_PAGE;
  renderArticles(allArticles.slice(start, end));
  if (end >= allArticles.length) {
    document.getElementById('load-more').style.display = 'none';
  }
}

function loadArticles() {
  return fetch(ARTICLE_API_BASE + '/api/articles', { cache: 'no-store' })
    .then(function(response) {
      if (!response.ok) throw new Error('API request failed: ' + response.status);
      return response.json();
    })
    .then(function(payload) {
      return payload && Array.isArray(payload.articles) ? payload.articles : [];
    })
    .catch(function(apiError) {
      console.warn('Falling back to static article_index.json', apiError);
      return fetch('/article_index.json')
        .then(function(response) { return response.json(); });
    });
}

// Bootstrap
(function() {
  const requestedArticleSlug = getRequestedArticleSlug();
  const legacyRequestedArticleSlug = getLegacyRequestedArticleSlug();
  const canonicalArticleSlug = requestedArticleSlug || legacyRequestedArticleSlug;
  if (canonicalArticleSlug) {
    normalizeLegacyArticleQuery(canonicalArticleSlug);
    showArticleMode(canonicalArticleSlug);
  } else {
    showListingMode();
    loadArticles()
      .then(function(payload) {
        allArticles = normalizeArticles(payload);
        renderArticles(allArticles.slice(0, PER_PAGE));
        if (allArticles.length > PER_PAGE) {
          document.getElementById('load-more').style.display = 'block';
        }
      })
      .catch(function(error) {
        console.error('Failed to load articles', error);
      });
  }
})();
