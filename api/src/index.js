export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // GET /images/* — serve from R2
      if (method === 'GET' && path.startsWith('/images/')) {
        const key = path.replace('/images/', '');
        const obj = await env.IMAGES.get(key);
        if (!obj) {
          return new Response('Not found', { status: 404 });
        }
        const headers = new Headers();
        obj.writeHttpMetadata(headers);
        headers.set('Cache-Control', 'public, max-age=31536000');
        headers.set('Access-Control-Allow-Origin', '*');
        return new Response(obj.body, { headers });
      }

      // PUT /images/* — upload to R2
      if (method === 'PUT' && path.startsWith('/images/')) {
        const key = path.replace('/images/', '');
        const existing = await env.IMAGES.get(key);
        if (existing) {
          return new Response('Already exists', { status: 409 });
        }
        await env.IMAGES.put(key, request.body, {
          httpMetadata: { contentType: key.endsWith('.png') ? 'image/png' : 'image/jpeg' }
        });
        return new Response('OK', { headers: corsHeaders });
      }

      // GET /api/articles — list all published
      if (method === 'GET' && path === '/api/articles') {
        const { results } = await env.DB.prepare(
          `SELECT a.id, a.title, a.url_id, a.excerpt, a.author, a.publish_date, a.categories, a.cover_url,
                  w.photo_url AS writer_photo_url, w.bio AS writer_bio
           FROM articles a
           LEFT JOIN writers w ON a.author = w.name
           WHERE a.status = 'publish'
           ORDER BY a.publish_date DESC`
        ).all();
        return Response.json({ articles: results }, { headers: corsHeaders });
      }

      // GET /api/articles/:url_id — single article with full body
      if (method === 'GET' && path.startsWith('/api/articles/')) {
        const urlId = path.replace('/api/articles/', '');
        const article = await env.DB.prepare(
          `SELECT a.*, w.photo_url AS writer_photo_url, w.bio AS writer_bio
           FROM articles a
           LEFT JOIN writers w ON a.author = w.name
           WHERE a.url_id = ? AND a.status = 'publish'`
        ).bind(urlId).first();
        if (!article) {
          return new Response('Not found', { status: 404, headers: corsHeaders });
        }
        return Response.json({ article }, { headers: corsHeaders });
      }

      // POST /api/articles — create
      if (method === 'POST' && path === '/api/articles') {
        const body = await request.json();
        const { title, url_id, body: content, excerpt, author, publish_date, categories, cover_url } = body;
        await env.DB.prepare(
          `INSERT INTO articles (title, url_id, body, excerpt, author, publish_date, categories, cover_url, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'publish')`
        ).bind(title, url_id, content, excerpt, author, publish_date, categories, cover_url).run();
        return new Response('Created', { status: 201, headers: corsHeaders });
      }

      // PUT /api/articles/:url_id — update
      if (method === 'PUT' && path.startsWith('/api/articles/')) {
        const urlId = path.replace('/api/articles/', '');
        const body = await request.json();
        const { title, body: content, excerpt, author, categories, cover_url, status } = body;
        await env.DB.prepare(
          `UPDATE articles SET title=?, body=?, excerpt=?, author=?, categories=?, cover_url=?, status=? WHERE url_id=?`
        ).bind(title, content, excerpt, author, categories, cover_url, status, urlId).run();
        return new Response('Updated', { headers: corsHeaders });
      }

      // DELETE /api/articles/:url_id
      if (method === 'DELETE' && path.startsWith('/api/articles/')) {
        const urlId = path.replace('/api/articles/', '');
        if (urlId === 'delete-all') {
          await env.DB.prepare('DELETE FROM articles').run();
          return new Response('All deleted', { headers: corsHeaders });
        }
        await env.DB.prepare('DELETE FROM articles WHERE url_id = ?').bind(urlId).run();
        return new Response('Deleted', { headers: corsHeaders });
      }

      // GET /api/writers — list all
      if (method === 'GET' && path === '/api/writers') {
        const { results } = await env.DB.prepare('SELECT * FROM writers ORDER BY name ASC').all();
        return Response.json({ writers: results }, { headers: corsHeaders });
      }

      // GET /api/writers/:name
      if (method === 'GET' && path.startsWith('/api/writers/')) {
        const writerName = decodeURIComponent(path.replace('/api/writers/', ''));
        const writer = await env.DB.prepare('SELECT * FROM writers WHERE name = ?').bind(writerName).first();
        if (!writer) return new Response('Not found', { status: 404, headers: corsHeaders });
        return Response.json({ writer }, { headers: corsHeaders });
      }

      // POST /api/writers
      if (method === 'POST' && path === '/api/writers') {
        const { name, photo_url, bio } = await request.json();
        await env.DB.prepare('INSERT INTO writers (name, photo_url, bio) VALUES (?, ?, ?)')
          .bind(name, photo_url || '', bio || '').run();
        return new Response('Created', { status: 201, headers: corsHeaders });
      }

      // PUT /api/writers/:name
      if (method === 'PUT' && path.startsWith('/api/writers/')) {
        const writerName = decodeURIComponent(path.replace('/api/writers/', ''));
        const { name, photo_url, bio } = await request.json();
        await env.DB.prepare('UPDATE writers SET name=?, photo_url=?, bio=? WHERE name=?')
          .bind(name || writerName, photo_url || '', bio || '', writerName).run();
        return new Response('Updated', { headers: corsHeaders });
      }

      // DELETE /api/writers/:name
      if (method === 'DELETE' && path.startsWith('/api/writers/')) {
        const writerName = decodeURIComponent(path.replace('/api/writers/', ''));
        await env.DB.prepare('DELETE FROM writers WHERE name = ?').bind(writerName).run();
        return new Response('Deleted', { headers: corsHeaders });
      }

      return new Response('Not found', { status: 404, headers: corsHeaders });

    } catch (err) {
      return new Response(err.message, { status: 500, headers: corsHeaders });
    }
  }
};
