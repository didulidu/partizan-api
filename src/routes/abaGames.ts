import { Router, Request, Response } from 'express';
import { getABAGames } from '../services/abaService.js';

const router = Router();

/**
 * GET /api/aba/games
 * Query params: teamId (required), season (default 2024-2025)
 */
router.get('/', async (req: Request, res: Response) => {
  const teamId = Number(req.query.teamId);
  const season = String(req.query.season ?? '2025-2026');

  if (!teamId) {
    res.status(400).json({ error: 'teamId is required' });
    return;
  }

  try {
    const games = await getABAGames(teamId, season);
    res.json(games);
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: 'Failed to fetch games from ABA API' });
  }
});

export default router;
