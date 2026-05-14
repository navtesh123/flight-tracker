const http = require('http');
const fs = require('fs');
const path = require('path');

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

async function handleApiFlights(req, res, query) {
  const { username, password } = query;
  const url = 'https://opensky-network.org/api/states/all';
  const headers = {};

  if (username && password) {
    headers['Authorization'] =
      'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
  }

  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(url, { headers });

    if (response.status === 401 || response.status === 403) {
      res.writeHead(response.status, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        error: 'Invalid credentials. Please check your username and password.',
      }));
    }

    if (response.status === 429) {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        error: 'Rate limited by the API. Please wait a minute and try again.',
      }));
    }

    if (!response.ok) {
      res.writeHead(response.status, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        error: `OpenSky API returned ${response.status}`,
      }));
    }

    const data = await response.json();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  } catch (err) {
    console.error('Error fetching from OpenSky:', err);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'Failed to reach OpenSky API',
      details: err.message,
    }));
  }
}

async function handleApiTrack(req, res, query) {
  const { icao24, username, password } = query;

  if (!icao24) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'icao24 parameter is required' }));
  }

  const url = `https://opensky-network.org/api/tracks/all?icao24=${encodeURIComponent(icao24)}&time=0`;
  const headers = {};

  if (username && password) {
    headers['Authorization'] =
      'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
  }

  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(url, { headers });

    if (response.status === 401 || response.status === 403) {
      res.writeHead(response.status, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        error: 'Invalid credentials. Please check your username and password.',
      }));
    }

    if (response.status === 429) {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        error: 'Rate limited by the API. Please wait a minute and try again.',
      }));
    }

    if (!response.ok) {
      res.writeHead(response.status, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        error: `OpenSky API returned ${response.status}`,
      }));
    }

    const data = await response.json();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  } catch (err) {
    console.error('Error fetching from OpenSky:', err);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'Failed to reach OpenSky API',
      details: err.message,
    }));
  }
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;
  const query = Object.fromEntries(parsedUrl.searchParams);

  // Handle API routes
  if (pathname === '/api/flights') {
    return handleApiFlights(req, res, query);
  }

  if (pathname === '/api/track') {
    return handleApiTrack(req, res, query);
  }

  // Serve static files
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
  console.log(`\n🚀 Server running at http://localhost:${PORT}/`);
  console.log(`   Open this URL in your browser to use the app\n`);
});
