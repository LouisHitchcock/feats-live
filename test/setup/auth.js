async function setupAuth(page) {
  await page.addInitScript(() => {
    localStorage.setItem('feats_admin_token', 'test-token-12345');
  });
  await page.route('**/admin/me', route => {
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ name: 'Test User', email: 'test@feats.live', role: 'admin' }),
    });
  });
}

module.exports = { setupAuth };
