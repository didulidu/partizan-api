import { Router, Request, Response } from 'express';
import { getAllABAPlayerStats, getABAPlayerSeasonStats } from '../services/abaService.js';

const router = Router();

/**
 * GET /api/aba/players/stats
 * Query params: gameId (required), teamId (required)
 */
router.get('/stats', async (req: Request, res: Response) => {
  const gameId = Number(req.query.gameId);
  const teamId = Number(req.query.teamId);

  if (!gameId || !teamId) {
    res.status(400).json({ error: 'gameId and teamId are required' });
    return;
  }

  try {
    const stats = await getAllABAPlayerStats(gameId, teamId);
    res.json(stats);
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: 'Failed to fetch player stats from ABA API' });
  }
});

/**
 * GET /api/aba/players/season-stats
 * Query params: playerId (required), season (required), teamId (optional)
 */
router.get('/season-stats', async (req: Request, res: Response) => {
  const playerId = Number(req.query.playerId);
  const season = String(req.query.season ?? '');
  const teamId = req.query.teamId ? Number(req.query.teamId) : undefined;

  if (!playerId || !season) {
    res.status(400).json({ error: 'playerId and season are required' });
    return;
  }

  try {
    const stats = await getABAPlayerSeasonStats(playerId, season, teamId);
    if (!stats) {
      res.status(404).json({ error: 'Player not found or stats unavailable' });
      return;
    }
    res.json(stats);
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: 'Failed to fetch player season stats from ABA API' });
  }
});

export default router;
