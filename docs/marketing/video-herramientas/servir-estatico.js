const http = require('http'), fs = require('fs'), path = require('path');
const root = process.argv[2];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.wasm': 'application/wasm' };
http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const cands = [u, u + '.html', path.join(u, 'index.html')];
  for (const c of cands) { const f = path.join(root, c); if (f.startsWith(root) && fs.existsSync(f) && fs.statSync(f).isFile()) { res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); return fs.createReadStream(f).pipe(res); } }
  // rutas dinámicas: la plantilla [param].html más cercana, o la portada
  res.writeHead(200, { 'content-type': 'text/html' }); fs.createReadStream(path.join(root, 'index.html')).pipe(res);
}).listen(8090, '127.0.0.1');
