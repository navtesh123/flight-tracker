const https = require('https');

function httpsGet(url, headers) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: { ...headers, 'User-Agent': 'FlightTracker/1.0' },
      timeout: 25000,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({ status: res.statusCode, body: data });
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });

    req.on('error', (err) => reject(err));
    req.end();
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { username, password } = req.query;

  let apiUrl = 'https://opensky-network.org/api/states/all';
  const headers = {};

  if (username && password) {
    headers['Authorization'] =
      'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
  }

  const proxies = [
    (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    (url) => `https://api.codetabs.com/v1/proxy?quest=${url}`,
  ];

  let lastError;

  // Try direct connection first
  try {
    const response = await httpsGet(apiUrl, headers);
    if (response.status >= 200 && response.status < 300) {
      const data = JSON.parse(response.body);
      res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=5');
      return res.status(200).json(data);
    }
    if (response.status === 401 || response.status === 403) {
      return res.status(response.status).json({
        error: 'Invalid credentials. Please check your username and password.',
      });
    }
    if (response.status === 429) {
      return res.status(429).json({
        error: 'Rate limited by the API. Please wait a minute and try again.',
      });
    }
    lastError = `Direct: HTTP ${response.status}`;
  } catch (err) {
    lastError = `Direct: ${err.message}`;
  }

  // If credentials are in the URL for auth, build the authenticated URL for proxies
  if (username && password) {
    apiUrl = `https://${encodeURIComponent(username)}:${encodeURIComponent(password)}@opensky-network.org/api/states/all`;
  }

  // Fallback through proxies
  for (const makeProxyUrl of proxies) {
    try {
      const proxyUrl = makeProxyUrl(apiUrl);
      const response = await httpsGet(proxyUrl, {});

      if (response.status >= 200 && response.status < 300) {
        const trimmed = response.body.trim();
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
          const data = JSON.parse(trimmed);
          res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=5');
          return res.status(200).json(data);
        }
      }
      lastError = `Proxy: HTTP ${response.status}`;
    } catch (err) {
      lastError = `Proxy: ${err.message}`;
    }
  }

  return res.status(502).json({
    error: 'Failed to reach OpenSky API',
    details: lastError,
  });
};
