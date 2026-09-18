import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = 4173;
const ROOT = normalize(join(dirname(fileURLToPath(import.meta.url)), '..'));

const MIMES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);
    let ruta = decodeURIComponent(url.pathname);
    if (ruta === '/') ruta = '/index.html';

    const archivo = normalize(join(ROOT, ruta));
    if (!archivo.startsWith(ROOT)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Acceso denegado');
      return;
    }

    const datos = await readFile(archivo);
    res.writeHead(200, {
      'Content-Type': MIMES[extname(archivo).toLowerCase()] || 'application/octet-stream',
    });
    res.end(datos);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('No encontrado');
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log(`Servidor estático en http://127.0.0.1:${PORT}`);
});
