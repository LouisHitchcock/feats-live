const fs = require('fs');
var c = fs.readFileSync('api/src/index.js', 'utf8');
c = c.replace("const html = await env.ADMIN_HTML || '';", 'const html = await env.admin_html.get("admin_index");');
fs.writeFileSync('api/src/index.js', c, 'utf8');
console.log('fixed');
