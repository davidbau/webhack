// test/e2e/serve.js -- Simple static file server for E2E testing
// Serves the game files on a random port, returns the port number.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const MIME_TYPES = {
    '.html': 'text/html',
    '.js':   'text/javascript',
    '.css':  'text/css',
    '.json': 'application/json',
    '.png':  'image/png',
    '.svg':  'image/svg+xml',
    '.txt':  'text/plain',
};

const ROOT = path.resolve(import.meta.dirname, '..', '..');

export function startServer(port = 0) {
    return new Promise((resolve, reject) => {
        const server = http.createServer((req, res) => {
            let filePath = path.join(ROOT, req.url === '/' ? '/index.html' : req.url);
            filePath = path.normalize(filePath);

            // Security: ensure we don't serve files outside ROOT
            if (!filePath.startsWith(ROOT)) {
                res.writeHead(403);
                res.end('Forbidden');
                return;
            }

            const ext = path.extname(filePath);
            const contentType = MIME_TYPES[ext] || 'application/octet-stream';

            fs.readFile(filePath, (err, data) => {
                if (err) {
                    res.writeHead(404);
                    res.end('Not found');
                    return;
                }
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(data);
            });
        });

        server.listen(port, '127.0.0.1', () => {
            const addr = server.address();
            resolve({ server, port: addr.port, url: `http://127.0.0.1:${addr.port}` });
        });
        server.on('error', reject);
    });
}
