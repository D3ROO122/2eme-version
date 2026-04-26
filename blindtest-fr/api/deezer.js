// api/deezer.js — Vercel serverless function
// Proxies Deezer public API to avoid CORS issues

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { q, id } = req.query;

  try {
    let url;
    if (id) {
      // Fetch chart for a specific genre/artist
      url = `https://api.deezer.com/artist/${encodeURIComponent(id)}/top?limit=10`;
    } else if (q) {
      url = `https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=10&output=json`;
    } else {
      return res.status(400).json({ error: 'Missing query param' });
    }

    const upstream = await fetch(url, {
      headers: { 'Accept': 'application/json' }
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: 'Deezer error' });
    }

    const data = await upstream.json();

    // Cache for 1 hour on CDN edge
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json(data);
  } catch (err) {
    console.error('Deezer proxy error:', err);
    return res.status(500).json({ error: 'Proxy error' });
  }
}
