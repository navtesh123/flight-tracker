const https = require('https');

function httpsGet(url, headers, timeout) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: { ...headers, 'User-Agent': 'FlightTracker/1.0' },
      timeout: timeout || 20000,
    };

    if (parsedUrl.username && parsedUrl.password) {
      options.auth = `${decodeURIComponent(parsedUrl.username)}:${decodeURIComponent(parsedUrl.password)}`;
    }

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

  const apiUrl = 'https://opensky-network.org/api/states/all';
  const authHeaders = {};

  if (username && password) {
    authHeaders['Authorization'] =
      'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
  }

  const strategies = [
    { name: 'allorigins', url: `https://api.allorigins.win/raw?url=${encodeURIComponent(apiUrl)}`, headers: {} },
    { name: 'codetabs', url: `https://api.codetabs.com/v1/proxy?quest=${apiUrl}`, headers: {} },
    { name: 'direct', url: apiUrl, headers: authHeaders, timeout: 5000 },
  ];

  const errors = [];

  for (const strategy of strategies) {
    try {
      const response = await httpsGet(strategy.url, strategy.headers, strategy.timeout);

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

      if (response.status >= 200 && response.status < 300) {
        const trimmed = response.body.trim();
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
          const data = JSON.parse(trimmed);
          res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=5');
          return res.status(200).json(data);
        }
      }

      errors.push(`${strategy.name}: HTTP ${response.status}`);
    } catch (err) {
      errors.push(`${strategy.name}: ${err.message}`);
    }
  }

  return res.status(502).json({
    error: 'Failed to reach OpenSky API',
    details: errors.join('; '),
  });
};
