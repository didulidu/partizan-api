import { Router, Request, Response } from 'express';
import { getSeasonClubs } from '../services/euroleagueService.js';

const router = Router();

/**
 * GET /api/clubs
 * Query params: seasonCode (default E2025)
 */
router.get('/', async (req: Request, res: Response) => {
  const seasonCode = String(req.query.seasonCode ?? 'E2025');

  try {
    const clubs = await getSeasonClubs(seasonCode);
    res.json(clubs);
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: 'Failed to fetch clubs from Euroleague API' });
  }
});

export default router;
