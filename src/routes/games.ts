import { Router, Request, Response } from 'express';
import { getGamesByClub } from '../services/euroleagueService.js';

const router = Router();

/**
 * GET /api/games
 * Query params: seasonCode (default E2025), clubCode (default PAR)
 */
router.get('/', async (req: Request, res: Response) => {
  const seasonCode = String(req.query.seasonCode ?? 'E2025');
  const clubCode = String(req.query.clubCode ?? 'PAR');

  try {
    const games = await getGamesByClub(seasonCode, clubCode);
    res.json(games);
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: 'Failed to fetch games from Euroleague API' });
  }
});

export default router;
