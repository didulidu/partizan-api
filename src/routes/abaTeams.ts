import { Router, Request, Response } from 'express';
import { getABATeams } from '../services/abaService.js';

const router = Router();

/**
 * GET /api/aba/teams
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const teams = await getABATeams();
    res.json(teams);
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: 'Failed to fetch teams from ABA API' });
  }
});

export default router;
