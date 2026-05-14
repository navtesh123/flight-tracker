module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { username, password } = req.query;

  const url = 'https://opensky-network.org/api/states/all';
  const headers = {};

  if (username && password) {
    headers['Authorization'] =
      'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    const response = await fetch(url, { headers, signal: controller.signal });
    clearTimeout(timeout);

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

    if (!response.ok) {
      return res.status(response.status).json({
        error: `OpenSky API returned ${response.status}`,
      });
    }

    const data = await response.json();

    res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=5');
    return res.status(200).json(data);
  } catch (err) {
    console.error('Error fetching from OpenSky:', err);
    return res.status(502).json({
      error: 'Failed to reach OpenSky API',
      details: err.message,
    });
  }
};
