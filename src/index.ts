import express from 'express';
import cors from 'cors';
import gamesRouter from './routes/games.js';
import clubsRouter from './routes/clubs.js';
import playersRouter from './routes/players.js';

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors());
app.use(express.json());

app.use('/api/games', gamesRouter);
app.use('/api/clubs', clubsRouter);
app.use('/api/players', playersRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`partizan-api running on http://localhost:${PORT}`);
});
