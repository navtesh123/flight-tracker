const https = require('https');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { icao24 } = req.query;

  if (!icao24) {
    return res.status(400).json({ error: 'Missing icao24 parameter' });
  }

  const username = process.env.OPENSKY_USERNAME;
  const password = process.env.OPENSKY_PASSWORD;

  if (!username || !password) {
    return res.status(500).json({ error: 'API credentials not configured' });
  }

  const auth = Buffer.from(`${username}:${password}`).toString('base64');

  return new Promise((resolve) => {
    const options = {
      hostname: 'opensky-network.org',
      path: `/api/tracks/all?icao24=${encodeURIComponent(icao24)}&time=0`,
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`
      }
    };

    const request = https.request(options, (response) => {
      let data = '';

      response.on('data', (chunk) => {
        data += chunk;
      });

      response.on('end', () => {
        if (response.statusCode === 200) {
          try {
            const json = JSON.parse(data);
            res.status(200).json(json);
          } catch (e) {
            res.status(500).json({ error: 'Invalid JSON response', message: data.substring(0, 200) });
          }
        } else {
          res.status(response.statusCode).json({ 
            error: `OpenSky API error: ${response.statusCode}`,
            message: data.substring(0, 200)
          });
        }
        resolve();
      });
    });

    request.on('error', (error) => {
      res.status(500).json({ error: 'Request failed', message: error.message });
      resolve();
    });

    request.end();
  });
};
