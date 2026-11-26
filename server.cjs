// No dependencies. Only allowlisted public demo files are served.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const files = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/styles.css': ['styles.css', 'text/css; charset=utf-8'],
  '/model.js': ['model.js', 'text/javascript; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/pet.html': ['pet.html', 'text/html; charset=utf-8'],
  '/tasks.html': ['tasks.html', 'text/html; charset=utf-8'],
  '/pet.css': ['pet.css', 'text/css; charset=utf-8'],
  '/pet.js': ['pet.js', 'text/javascript; charset=utf-8']
};
files['/shop.html']=['shop.html','text/html; charset=utf-8'];
files['/wardrobe.css']=['wardrobe.css','text/css; charset=utf-8'];
for(const item of ['beret','cape']) files['/kitten/'+item+'.webp']=['kitten/'+item+'.webp','image/webp'];
for (const script of ['language.js','english.js','wardrobe.js','shop.js']) files['/'+script]=[script,'text/javascript; charset=utf-8'];
for (const mood of ['idle','wave','stretch','sleep']) {
  for (const suffix of ['','-still']) {
    for(const prefix of ['', 'beret-', 'cape-']){
      const file='kitten/'+prefix+mood+suffix+'.webp';
      files['/'+file]=[file,'image/webp'];
    }
  }
}
const server = http.createServer((req, res) => {
  if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' }); res.end(); return; }
  const requested = (req.url || '/').split('?')[0];
  const file = Object.hasOwn(files, requested) ? files[requested] : null;
  if (!file) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Not found'); return; }
  fs.readFile(path.join(__dirname, 'dist', file[0]), (error, data) => {
    if (error) { res.writeHead(500); res.end('Demo file unavailable'); return; }
    res.writeHead(200, {
      'Content-Type': file[1], 'Content-Length': data.length,
      'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
    });
    res.end(req.method === 'HEAD' ? undefined : data);
  });
});
const port = Number(process.env.PORT || 53300);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('PORT must be between 1 and 65535');
server.on('error', error => {
  console.error(error.code === 'EADDRINUSE' ? `Port ${port} is in use. Choose another PORT or use dist/index.html.` : error.message);
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => console.log(`One Step demo: http://127.0.0.1:${port}/\nPress Ctrl+C to stop. Local only; no external AI or services.`));
