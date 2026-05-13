module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const username = process.env.OPENSKY_USERNAME;
  const password = process.env.OPENSKY_PASSWORD;

  if (!username || !password) {
    return res.status(500).json({ error: 'API credentials not configured' });
  }

  try {
    const auth = Buffer.from(`${username}:${password}`).toString('base64');
    const response = await fetch('https://opensky-network.org/api/states/all', {
      headers: {
        'Authorization': `Basic ${auth}`
      }
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ 
        error: `OpenSky API error: ${response.status}`,
        message: text
      });
    }

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch flights', message: error.message });
  }
}
