const fixtures = require('./fixtures');

async function setupApiMocks(page, options = {}) {
  const {
    articles = fixtures.defaultArticles,
    writers = fixtures.defaultWriters,
    dashboard = fixtures.defaultDashboard,
  } = options;

  await page.route('**/admin/dashboard', route => {
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(dashboard) });
  });

  await page.route('**/admin/articles', route => {
    if (route.request().method() === 'POST') {
      route.fulfill({ contentType: 'application/json', body: JSON.stringify({ article: { id: 999, status: 'draft' } }) });
    } else {
      route.fulfill({ contentType: 'application/json', body: JSON.stringify({ articles }) });
    }
  });

  await page.route(/\/admin\/articles\/\d+$/, (route, request) => {
    const id = parseInt(new URL(request.url()).pathname.split('/').pop(), 10);
    const article = articles.find(a => a.id === id);
    if (article) {
      if (request.method() === 'PUT' || request.method() === 'DELETE') {
        route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true }) });
      } else {
        route.fulfill({ contentType: 'application/json', body: JSON.stringify({ article }) });
      }
    } else {
      route.fulfill({ status: 404, body: 'Not found' });
    }
  });

  await page.route('**/admin/writers', route => {
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ writers }) });
  });
}

module.exports = { setupApiMocks };
