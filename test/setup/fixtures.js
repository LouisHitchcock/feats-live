const defaultDashboard = {
  totalArticles: 5, publishedArticles: 4, totalWriters: 2,
  totalViews: 12450, uniqueVisitors: 8720, storageMB: 42.3,
};

const defaultWriters = [
  { name: 'Louis Hitchcock' }, { name: 'Jane Doe' },
];

const defaultArticles = [
  {
    id: 1, title: 'Kids in Glass Houses Live Review',
    url_id: 'kids-in-glass-houses-review', author: 'Louis Hitchcock',
    excerpt: 'A night to remember at Shepherds Bush.',
    body: '<h2>Review</h2><p>When <strong>Kids in Glass Houses</strong> hit the stage...</p><p>The band delivered an outstanding night.</p>',
    categories: 'Live Music, Gig Review', tags: 'review',
    publish_date: '2026-01-03T00:00', status: 'publish',
  },
  {
    id: 2, title: 'Turnstile at Depot Mayfield',
    url_id: 'turnstile-manchester-review', author: 'Louis Hitchcock',
    excerpt: 'Hardcore takeover of Depot Mayfield.',
    body: '<p>The hardcore takeover of Depot Mayfield was exciting.</p>',
    categories: 'Live Music', tags: 'turnstile, manchester',
    publish_date: '2025-11-24T00:00', status: 'publish',
  },
  {
    id: 3, title: 'Draft Article', url_id: 'draft-article',
    author: 'Louis Hitchcock', excerpt: '',
    body: '<p>Work in progress...</p>',
    categories: '', tags: '',
    publish_date: '2026-02-01T12:00', status: 'draft',
  },
];

module.exports = { defaultDashboard, defaultWriters, defaultArticles };
