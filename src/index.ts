import express from 'express';
import cors from 'cors';
import gamesRouter from './routes/games.js';
import clubsRouter from './routes/clubs.js';
import playersRouter from './routes/players.js';
// import abaTeamsRouter from './routes/abaTeams.js';
// import abaGamesRouter from './routes/abaGames.js';
// import abaPlayersRouter from './routes/abaPlayers.js';
// import wallpapersRouter from './routes/wallpapers.js';

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors());
app.use(express.json());

app.use('/api/games', gamesRouter);
app.use('/api/clubs', clubsRouter);
app.use('/api/players', playersRouter);

// app.use('/api/aba/teams', abaTeamsRouter);
// app.use('/api/aba/games', abaGamesRouter);
// app.use('/api/aba/players', abaPlayersRouter);
// app.use('/api/wallpapers', wallpapersRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`partizan-api running on http://localhost:${PORT}`);
});
