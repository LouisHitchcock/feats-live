export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace('/api', '');
    const method = request.method;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (method === 'OPTIONS') {
      
if (method==='DELETE'&&path==='/delete-all'){await env.DB.prepare('DELETE FROM articles').run();return new Response('Deleted',{headers:corsHeaders})}
return new Response(null, { headers: corsHeaders });
    }

    try {
      // GET /api/articles — list all published articles
      if (method === 'GET' && path === '/articles') {
        const { results } = await env.DB.prepare(
          `SELECT id, title, url_id, excerpt, author, publish_date, categories, cover_url
           FROM articles WHERE status = 'publish'
           ORDER BY publish_date DESC`
        ).all();
        return Response.json({ articles: results }, { headers: corsHeaders });
      }

      // GET /api/articles/:url_id — single article
      if (method === 'GET' && path.startsWith('/articles/')) {
        const urlId = path.replace('/articles/', '');
        const article = await env.DB.prepare(
          `SELECT * FROM articles WHERE url_id = ? AND status = 'publish'`
        ).bind(urlId).first();

        if (!article) {
          
if (method==='DELETE'&&path==='/delete-all'){await env.DB.prepare('DELETE FROM articles').run();return new Response('Deleted',{headers:corsHeaders})}
return new Response('Not found', { status: 404, headers: corsHeaders });
        }

        return Response.json({ article }, { headers: corsHeaders });
      }

      // POST /api/articles — create article (for future admin)
      if (method === 'POST' && path === '/articles') {
        const body = await request.json();
        const { title, url_id, body: content, excerpt, author, publish_date, categories, cover_url } = body;

        await env.DB.prepare(
          `INSERT INTO articles (title, url_id, body, excerpt, author, publish_date, categories, cover_url, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'publish')`
        ).bind(title, url_id, content, excerpt, author, publish_date, categories, cover_url).run();

        
if (method==='DELETE'&&path==='/delete-all'){await env.DB.prepare('DELETE FROM articles').run();return new Response('Deleted',{headers:corsHeaders})}
return new Response('Created', { status: 201, headers: corsHeaders });
      }

      // PUT /api/articles/:url_id — update article (future admin)
      if (method === 'PUT' && path.startsWith('/articles/')) {
        const urlId = path.replace('/articles/', '');
        const body = await request.json();
        const { title, body: content, excerpt, author, categories, cover_url, status } = body;

        await env.DB.prepare(
          `UPDATE articles SET title=?, body=?, excerpt=?, author=?, categories=?, cover_url=?, status=? WHERE url_id=?`
        ).bind(title, content, excerpt, author, categories, cover_url, status, urlId).run();

        
if (method==='DELETE'&&path==='/delete-all'){await env.DB.prepare('DELETE FROM articles').run();return new Response('Deleted',{headers:corsHeaders})}
return new Response('Updated', { headers: corsHeaders });
      }

      // DELETE /api/articles/:url_id — (future admin)
      if (method === 'DELETE' && path.startsWith('/articles/')) {
        const urlId = path.replace('/articles/', '');
        await env.DB.prepare(`DELETE FROM articles WHERE url_id = ?`).bind(urlId).run();
        
if (method==='DELETE'&&path==='/delete-all'){await env.DB.prepare('DELETE FROM articles').run();return new Response('Deleted',{headers:corsHeaders})}
return new Response('Deleted', { headers: corsHeaders });
      }

      
if (method==='DELETE'&&path==='/delete-all'){await env.DB.prepare('DELETE FROM articles').run();return new Response('Deleted',{headers:corsHeaders})}
return new Response('Not found', { status: 404, headers: corsHeaders });

    } catch (err) {
      
if (method==='DELETE'&&path==='/delete-all'){await env.DB.prepare('DELETE FROM articles').run();return new Response('Deleted',{headers:corsHeaders})}
return new Response(err.message, { status: 500, headers: corsHeaders });
    }
  }
};
