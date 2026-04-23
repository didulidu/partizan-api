import { Router, Request, Response } from 'express';

const router = Router();

const ALLOWED_HOSTS = ['www.aba-liga.com', 'aba-liga.com'];

router.get('/', async (req: Request, res: Response) => {
  const url = String(req.query.url ?? '');

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    res.status(400).json({ error: 'Invalid url' });
    return;
  }

  if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
    res.status(403).json({ error: 'Host not allowed' });
    return;
  }

  try {
    const upstream = await fetch(url);
    if (!upstream.ok) {
      res.status(upstream.status).json({ error: 'Upstream error' });
      return;
    }
    const contentType = upstream.headers.get('content-type') ?? 'image/png';
    const buffer = await upstream.arrayBuffer();
    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error('[imageProxy]', err);
    res.status(502).json({ error: 'Failed to fetch image' });
  }
});

export default router;
