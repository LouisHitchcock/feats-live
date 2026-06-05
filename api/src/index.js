export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

    try {
      // ===== IMAGE ROUTES =====
      if (method === 'GET' && path.startsWith('/images/')) {
        const key = path.replace('/images/', '');
        const obj = await env.IMAGES.get(key);
        if (!obj) return new Response('Not found', { status: 404 });
        const headers = new Headers();
        obj.writeHttpMetadata(headers);
        headers.set('Cache-Control', 'public, max-age=31536000');
        headers.set('Access-Control-Allow-Origin', '*');
        return new Response(obj.body, { headers });
      }

      if (method === 'PUT' && path.startsWith('/images/')) {
        const key = path.replace('/images/', '');
        const existing = await env.IMAGES.get(key);
        if (existing) return new Response('Already exists', { status: 409 });
        await env.IMAGES.put(key, request.body, {
          httpMetadata: { contentType: key.endsWith('.png') ? 'image/png' : 'image/jpeg' }
        });
        return new Response('OK', { headers: corsHeaders });
      }

      // ===== PUBLIC API =====
      if (method === 'GET' && path === '/api/articles') {
        const { results } = await env.DB.prepare(
          `SELECT a.id, a.title, a.url_id, a.excerpt, a.author, a.publish_date, a.categories, a.cover_url,
                  w.photo_url AS writer_photo_url, w.bio AS writer_bio
           FROM articles a LEFT JOIN writers w ON a.author = w.name
           WHERE a.status = 'publish' ORDER BY a.publish_date DESC`
        ).all();
        return Response.json({ articles: results }, { headers: corsHeaders });
      }

      if (method === 'GET' && path.startsWith('/api/articles/')) {
        const urlId = path.replace('/api/articles/', '');
        const article = await env.DB.prepare(
          `SELECT a.*, w.photo_url AS writer_photo_url, w.bio AS writer_bio
           FROM articles a LEFT JOIN writers w ON a.author = w.name
           WHERE a.url_id = ? AND a.status = 'publish'`
        ).bind(urlId).first();
        if (!article) return new Response('Not found', { status: 404, headers: corsHeaders });
        return Response.json({ article }, { headers: corsHeaders });
      }

      // ===== AUTH =====
      if (path === '/auth/google') {
        const clientId = env.GOOGLE_CLIENT_ID;
        const redirectUri = 'https://feats-live.louishitchcock.xyz/auth/callback';
        const params = new URLSearchParams({
          client_id: clientId,
          redirect_uri: redirectUri,
          response_type: 'code',
          scope: 'openid email profile',
          access_type: 'offline'
        });
        return Response.redirect('https://accounts.google.com/o/oauth2/v2/auth?' + params, 302);
      }

      if (path === '/auth/callback') {
        const code = url.searchParams.get('code');
        if (!code) return new Response('No authorization code', { status: 400 });

        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: env.GOOGLE_CLIENT_ID,
            client_secret: env.GOOGLE_CLIENT_SECRET,
            redirect_uri: 'https://feats-live.louishitchcock.xyz/auth/callback',
            grant_type: 'authorization_code'
          })
        });
        const tokenData = await tokenRes.json();
        if (!tokenData.access_token) return new Response('OAuth failed: ' + JSON.stringify(tokenData), { status: 400 });

        const googleRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { 'Authorization': 'Bearer ' + tokenData.access_token }
        });
        const googleUser = await googleRes.json();

        const existing = await env.DB.prepare(
          'SELECT * FROM admin_users WHERE email = ?'
        ).bind(googleUser.email).first();

        if (!existing) {
          return new Response('Unauthorized: ' + googleUser.email + ' is not an admin user', { status: 403 });
        }

        await env.DB.prepare(
          "UPDATE admin_users SET last_login = datetime('now'), google_id = ?, avatar_url = ? WHERE email = ?"
        ).bind(googleUser.id, googleUser.picture, googleUser.email).run();

        const token = btoa(JSON.stringify({
          id: existing.id,
          email: googleUser.email,
          name: existing.name,
          role: existing.role,
          exp: Date.now() + 86400000
        }));

        return Response.redirect('https://louishitchcock.xyz/admin?token=' + token, 302);
      }

      // ===== AUTH MIDDLEWARE =====
      const getAuthUser = () => {
        const auth = request.headers.get('Authorization');
        if (!auth || !auth.startsWith('Bearer ')) return null;
        try {
          const data = JSON.parse(atob(auth.slice(7)));
          if (data.exp < Date.now()) return null;
          return data;
        } catch { return null; }
      };

      // ===== ADMIN API =====
      if (path.startsWith('/admin/')) {
        const user = getAuthUser();
        if (!user) return new Response('Unauthorized', { status: 401, headers: corsHeaders });

        if (path === '/admin/me') return Response.json(user, { headers: corsHeaders });

        if (path === '/admin/dashboard') {
          const [ac, pc, wc, vc, uc] = await Promise.all([
            env.DB.prepare('SELECT COUNT(*) as c FROM articles').first(),
            env.DB.prepare("SELECT COUNT(*) as c FROM articles WHERE status = 'publish'").first(),
            env.DB.prepare('SELECT COUNT(*) as c FROM writers').first(),
            env.DB.prepare('SELECT COUNT(*) as c FROM page_views').first(),
            env.DB.prepare('SELECT COUNT(DISTINCT visitor_ip) as c FROM page_views').first()
          ]);
          return Response.json({ totalArticles: ac.c, publishedArticles: pc.c, totalWriters: wc.c, totalViews: vc.c, uniqueVisitors: uc.c, storageMB: 'N/A' }, { headers: corsHeaders });
        }

        if (path === '/admin/articles' && method === 'GET') {
          const { results } = await env.DB.prepare(
            'SELECT id, title, url_id, author, publish_date, status FROM articles ORDER BY publish_date DESC'
          ).all();
          return Response.json({ articles: results }, { headers: corsHeaders });
        }

        if (path === '/admin/articles' && method === 'POST') {
          const b = await request.json();
          await env.DB.prepare(
            `INSERT INTO articles (title, url_id, body, excerpt, author, publish_date, categories, tags, cover_url, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            b.title,
            b.url_id,
            b.body || '',
            b.excerpt || '',
            b.author || 'Feats.',
            b.publish_date,
            b.categories || '',
            b.tags || '',
            b.cover_url || '',
            b.status || 'publish'
          ).run();
          return new Response('Created', { status: 201, headers: corsHeaders });
        }

        const artMatch = path.match(/^\/admin\/articles\/(\d+)$/);
        if (artMatch) {
          const id = parseInt(artMatch[1]);
          if (method === 'GET') {
            const a = await env.DB.prepare('SELECT * FROM articles WHERE id = ?').bind(id).first();
            return a ? Response.json({ article: a }, { headers: corsHeaders }) : new Response('Not found', { status: 404 });
          }
          if (method === 'PUT') {
            const b = await request.json();
            await env.DB.prepare(
              'UPDATE articles SET title=?, url_id=?, body=?, excerpt=?, author=?, categories=?, tags=?, cover_url=?, publish_date=?, status=? WHERE id=?'
            ).bind(b.title, b.url_id, b.body, b.excerpt, b.author, b.categories, b.tags || '', b.cover_url, b.publish_date, b.status || 'publish', id).run();
            return new Response('Updated', { headers: corsHeaders });
          }
          if (method === 'DELETE') {
            await env.DB.prepare('DELETE FROM articles WHERE id = ?').bind(id).run();
            return new Response('Deleted', { headers: corsHeaders });
          }
        }

        if (path === '/admin/writers' && method === 'GET') {
          const { results } = await env.DB.prepare('SELECT * FROM writers ORDER BY name ASC').all();
          return Response.json({ writers: results }, { headers: corsHeaders });
        }

        if (path === '/admin/writers' && method === 'POST') {
          const b = await request.json();
          await env.DB.prepare('INSERT INTO writers (name, photo_url, bio) VALUES (?, ?, ?)')
            .bind(b.name, b.photo_url || '', b.bio || '').run();
          return new Response('Created', { status: 201, headers: corsHeaders });
        }

        const wrMatch = path.match(/^\/admin\/writers\/(\d+)$/);
        if (wrMatch) {
          const id = parseInt(wrMatch[1]);
          if (method === 'GET') {
            const w = await env.DB.prepare('SELECT * FROM writers WHERE id = ?').bind(id).first();
            return w ? Response.json({ writer: w }, { headers: corsHeaders }) : new Response('Not found', { status: 404 });
          }
          if (method === 'PUT') {
            const b = await request.json();
            await env.DB.prepare('UPDATE writers SET name=?, photo_url=?, bio=? WHERE id=?')
              .bind(b.name, b.photo_url || '', b.bio || '', id).run();
            return new Response('Updated', { headers: corsHeaders });
          }
          if (method === 'DELETE') {
            await env.DB.prepare('DELETE FROM writers WHERE id = ?').bind(id).run();
            return new Response('Deleted', { headers: corsHeaders });
          }
        }

        if (user.role === 'superadmin') {
          if (path === '/admin/users' && method === 'GET') {
            const { results } = await env.DB.prepare('SELECT id, email, name, role, avatar_url, last_login FROM admin_users ORDER BY role DESC, name ASC').all();
            return Response.json({ users: results }, { headers: corsHeaders });
          }
          if (path === '/admin/users' && method === 'POST') {
            const b = await request.json();
            await env.DB.prepare('INSERT INTO admin_users (email, name, role) VALUES (?, ?, ?)')
              .bind(b.email, b.name, b.role || 'admin').run();
            return new Response('Created', { status: 201, headers: corsHeaders });
          }
          const uMatch = path.match(/^\/admin\/users\/(\d+)$/);
          if (uMatch && method === 'DELETE') {
            await env.DB.prepare('DELETE FROM admin_users WHERE id = ? AND role != ?').bind(parseInt(uMatch[1]), 'superadmin').run();
            return new Response('Deleted', { headers: corsHeaders });
          }
        }

        if (path === '/admin/analytics') {
          const [tv, uc, top] = await Promise.all([
            env.DB.prepare('SELECT COUNT(*) as c FROM page_views').first(),
            env.DB.prepare('SELECT COUNT(DISTINCT visitor_ip) as c FROM page_views').first(),
            env.DB.prepare(
              `SELECT a.title, COALESCE(ae.views,0) as views, COALESCE(ae.unique_visitors,0) as uv
               FROM articles a LEFT JOIN article_engagement ae ON a.id = ae.article_id AND ae.date = date('now')
               ORDER BY views DESC LIMIT 10`
            ).all()
          ]);
          return Response.json({ totalViews: tv.c, uniqueVisitors: uc.c, countries: 0, topArticles: top.results || [] }, { headers: corsHeaders });
        }

        if (path === '/admin/tech') {
          let r2Count = 0, r2Size = 0;
          try { const o = await env.IMAGES.list(); r2Count = o.objects.length; r2Size = o.objects.reduce((s, o) => s + o.size, 0); } catch {}
          return Response.json({
            r2ImageCount: r2Count,
            r2StorageMB: Math.round(r2Size / (1024 * 1024) * 10) / 10,
            dbSizeMB: '0.6',
            bandwidthGB: 'N/A',
            env: { worker: 'feats-live', domain: 'feats-live.louishitchcock.xyz', r2: 'feats-images', db: 'feats-db' }
          }, { headers: corsHeaders });
        }

        return new Response('Not found', { status: 404, headers: corsHeaders });
      }


      return new Response('Not found', { status: 404, headers: corsHeaders });

    } catch (err) {
      return new Response(err.message, { status: 500, headers: corsHeaders });
    }
  }
};
