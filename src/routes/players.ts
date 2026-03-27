import { Router, Request, Response } from 'express';
import {
  getAllPlayerStats,
  getPlayerStats,
  getPlayerSeasonStats,
  getGameBoxscore,
} from '../services/euroleagueService.js';

const router = Router();

/**
 * GET /api/players/stats
 * All player stats for a game filtered by club.
 * Query params: gamecode (required), seasonCode (default E2025), clubCode (default PAR)
 */
router.get('/stats', async (req: Request, res: Response) => {
  const gamecode = String(req.query.gamecode ?? '');
  const seasonCode = String(req.query.seasonCode ?? 'E2025');
  const clubCode = String(req.query.clubCode ?? 'PAR');

  if (!gamecode) {
    res.status(400).json({ error: 'gamecode is required' });
    return;
  }

  try {
    const stats = await getAllPlayerStats(gamecode, seasonCode, clubCode);
    res.json(stats);
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: 'Failed to fetch player stats from Euroleague API' });
  }
});

/**
 * GET /api/players/search
 * Search for a specific player in a game's boxscore by name.
 * Query params: gamecode (required), playerName (required), seasonCode (default E2025)
 */
router.get('/search', async (req: Request, res: Response) => {
  const gamecode = String(req.query.gamecode ?? '');
  const playerName = String(req.query.playerName ?? '');
  const seasonCode = String(req.query.seasonCode ?? 'E2025');

  if (!gamecode || !playerName) {
    res.status(400).json({ error: 'gamecode and playerName are required' });
    return;
  }

  try {
    const stats = await getPlayerStats(gamecode, playerName, seasonCode);
    res.json(stats);
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: 'Failed to search player stats from Euroleague API' });
  }
});

/**
 * GET /api/players/season-stats
 * Season averages for a specific player.
 * Query params: playerCode (required), seasonCode (default E2025)
 */
router.get('/season-stats', async (req: Request, res: Response) => {
  const playerCode = String(req.query.playerCode ?? '');
  const seasonCode = String(req.query.seasonCode ?? 'E2025');

  if (!playerCode) {
    res.status(400).json({ error: 'playerCode is required' });
    return;
  }

  try {
    const stats = await getPlayerSeasonStats(playerCode, seasonCode);
    if (!stats) {
      res.status(404).json({ error: 'Player not found or stats unavailable' });
      return;
    }
    res.json(stats);
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: 'Failed to fetch player season stats from Euroleague API' });
  }
});

/**
 * GET /api/players/boxscore
 * Raw boxscore data for a game.
 * Query params: gamecode (required), seasonCode (default E2025)
 */
router.get('/boxscore', async (req: Request, res: Response) => {
  const gamecode = String(req.query.gamecode ?? '');
  const seasonCode = String(req.query.seasonCode ?? 'E2025');

  if (!gamecode) {
    res.status(400).json({ error: 'gamecode is required' });
    return;
  }

  try {
    const data = await getGameBoxscore(gamecode, seasonCode);
    if (!data) {
      res.status(404).json({ error: 'Boxscore not available for this game' });
      return;
    }
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: 'Failed to fetch boxscore from Euroleague API' });
  }
});

export default router;
