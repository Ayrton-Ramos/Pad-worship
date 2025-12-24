// Simple static file server for local development
// Usage:
//   node server.js               -> serves on port 8000
//   node server.js --port=5000   -> serves on port 5000
//   PORT=5000 node server.js     -> cross-platform via env var
// Serves files from the current working directory

const http = require('http');
const fs = require('fs');
const path = require('path');

const arg = (process.argv[2] || '').toString();
let argPort = null;
if (arg.startsWith('--port=')) argPort = parseInt(arg.split('=')[1], 10);
const port = argPort || (process.env.PORT && parseInt(process.env.PORT, 10)) || 8000;
const base = process.cwd();

const mime = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.webm': 'video/webm'
};

const server = http.createServer((req, res) => {
  try {
    let reqPath = decodeURIComponent(req.url.split('?')[0]);
    if (reqPath === '/') reqPath = '/index.html';
    // Prevent directory traversal
    const safePath = path.normalize(reqPath).replace(/^\.\.(\/|\\)/, '');
    const filePath = path.join(base, safePath);

    fs.stat(filePath, (err, stats) => {
      if (err) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end('404 Not Found');
        return;
      }

      // If directory, try to serve index.html or return a simple listing of files
      if (stats.isDirectory()) {
        const indexPath = path.join(filePath, 'index.html');
        fs.stat(indexPath, (ie, istats) => {
          if (!ie && istats.isFile()) {
            const ext = path.extname(indexPath).toLowerCase();
            res.setHeader('Content-Type', mime[ext] || 'application/octet-stream');
            fs.createReadStream(indexPath).pipe(res);
            return;
          }

          fs.readdir(filePath, { withFileTypes: true }, (re, items) => {
            if (re) { res.statusCode = 500; res.end('Server Error'); return; }
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            let html = `<!doctype html><html><head><meta charset="utf-8"><title>Index of ${reqPath}</title></head><body><h1>Index of ${reqPath}</h1><ul>`;
            items.forEach(dirent => {
              const name = dirent.name;
              const href = encodeURIComponent(name);
              html += `<li><a href="${href}">${name}${dirent.isDirectory() ? '/' : ''}</a></li>`;
            });
            html += '</ul></body></html>';
            res.end(html);
          });
        });
        return;
      }

      if (!stats.isFile()) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end('404 Not Found');
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      res.setHeader('Content-Type', mime[ext] || 'application/octet-stream');
      const stream = fs.createReadStream(filePath);
      stream.on('error', () => { res.statusCode = 500; res.end('Server Error'); });
      stream.pipe(res);
    });
  } catch (err) {
    res.statusCode = 500;
    res.end('Server Error');
  }
});

server.listen(port, () => {
  console.log(`Server running at http://localhost:${port} (serving ${base})`);
});
