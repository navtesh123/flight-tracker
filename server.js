const http = require('http');
const fs = require('fs');
const path = require('path');
const flightsHandler = require('./api/flights');
const trackHandler = require('./api/track');

const PORT = 3000;

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

function createMockRes(res) {
  const mockRes = {
    _statusCode: 200,
    _headers: {},
    setHeader(key, value) { this._headers[key] = value; },
    status(code) { this._statusCode = code; return this; },
    json(data) {
      res.writeHead(this._statusCode, { ...this._headers, 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    },
    end() {
      res.writeHead(this._statusCode, this._headers);
      res.end();
    },
  };
  return mockRes;
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;
  const query = Object.fromEntries(parsedUrl.searchParams);

  if (pathname === '/api/flights') {
    const mockReq = { method: req.method, query };
    return flightsHandler(mockReq, createMockRes(res));
  }

  if (pathname === '/api/track') {
    const mockReq = { method: req.method, query };
    return trackHandler(mockReq, createMockRes(res));
  }

  let filePath = pathname === '/' ? '/index.html' : pathname;
  filePath = path.join(__dirname, filePath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('File not found');
      return;
    }

    const ext = path.extname(filePath);
    const mimeType = mimeTypes[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mimeType });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\nServer running at http://localhost:${PORT}/`);
  console.log(`Open this URL in your browser to use the app\n`);
});
