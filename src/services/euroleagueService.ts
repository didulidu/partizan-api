import { XMLParser } from 'fast-xml-parser';
import {
  Game,
  Club,
  PlayerStats,
  PlayerSeasonStats,
  BoxscoreData,
  TeamStats,
} from '../types/index.js';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  isArray: (name) => ['game', 'club', 'stat', 'season'].includes(name),
  parseAttributeValue: true,
});

function parseDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  } catch {
    // fall through
  }
  return '0000-00-00';
}

function sanitizeSeasonPercentageString(raw: string): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return '0.0%';
  if (/nan/i.test(trimmed)) return '0.0%';
  const numeric = parseFloat(trimmed.replace(/%$/, '').replace(',', '.'));
  if (Number.isNaN(numeric)) return '0.0%';
  return trimmed.endsWith('%') ? trimmed : `${numeric.toFixed(1)}%`;
}

// ---------------------------------------------------------------------------
// Games
// ---------------------------------------------------------------------------

export async function getGamesByClub(
  seasonCode = 'E2025',
  clubCode = 'PAR'
): Promise<Game[]> {
  const response = await fetch(
    `https://api-live.euroleague.net/v1/results?seasonCode=${seasonCode}`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch games: ${response.statusText}`);
  }

  const xmlText = await response.text();
  const parsed = parser.parse(xmlText);

  const gameNodes: any[] = parsed?.results?.game ?? [];
  const games: Game[] = [];

  for (const g of gameNodes) {
    const homecode = String(g.homecode ?? '').trim();
    const awaycode = String(g.awaycode ?? '').trim();

    if (homecode !== clubCode && awaycode !== clubCode) continue;

    const rawGamecode = String(g.gamecode ?? '').trim();
    const gamecode = rawGamecode.includes('_')
      ? rawGamecode.split('_')[1]
      : rawGamecode;
    const originalDate = String(g.date ?? '').trim();

    games.push({
      date: parseDate(originalDate),
      originalDate,
      gamecode,
      homecode,
      awaycode,
    });
  }

  games.sort((a, b) => b.date.localeCompare(a.date));
  return games;
}

// ---------------------------------------------------------------------------
// Clubs / Teams
// ---------------------------------------------------------------------------

export async function getSeasonClubs(seasonCode = 'E2025'): Promise<Club[]> {
  const response = await fetch(
    `https://api-live.euroleague.net/v1/teams?seasonCode=${seasonCode}`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch clubs: ${response.statusText}`);
  }

  const xmlText = await response.text();
  const parsed = parser.parse(xmlText);

  const clubNodes: any[] = parsed?.clubs?.club ?? [];
  const clubs: Club[] = [];

  for (const c of clubNodes) {
    const code =
      String(c['@_code'] ?? c['@_tvcode'] ?? c.code ?? '').trim();
    if (!code) continue;

    const name =
      String(c.name ?? c.Name ?? c.clubname ?? c.clubName ?? code).trim();

    clubs.push({
      code,
      name,
      clubName: String(c.clubname ?? c.clubName ?? name).trim(),
      countryCode: c.countrycode ?? c.countryCode ?? undefined,
      countryName: c.countryname ?? c.countryName ?? undefined,
      imageUrl: c.imageurl ?? c.imageUrl ?? undefined,
    });
  }

  return clubs;
}

// ---------------------------------------------------------------------------
// Boxscore
// ---------------------------------------------------------------------------

export async function getGameBoxscore(
  gamecode: string,
  seasonCode = 'E2025'
): Promise<BoxscoreData | null> {
  const numericGamecode = gamecode.includes('_')
    ? gamecode.split('_')[1]
    : gamecode;

  const response = await fetch(
    `https://live.euroleague.net/api/Boxscore?gamecode=${numericGamecode}&seasoncode=${seasonCode}`,
    { headers: { Accept: 'application/json' } }
  );

  if (response.status === 503) {
    console.warn(`Boxscore not available for game ${gamecode} (503)`);
    return null;
  }

  if (!response.ok) {
    console.warn(
      `Failed to fetch boxscore for game ${gamecode}: ${response.statusText}`
    );
    return null;
  }

  return response.json() as Promise<BoxscoreData>;
}

// ---------------------------------------------------------------------------
// Player stats (from boxscore)
// ---------------------------------------------------------------------------

export async function getAllPlayerStats(
  gamecode: string,
  seasonCode = 'E2025',
  clubCode = 'PAR'
): Promise<PlayerStats[]> {
  const boxscore = await getGameBoxscore(gamecode, seasonCode);
  if (!boxscore?.Stats || !Array.isArray(boxscore.Stats)) return [];

  const stats: PlayerStats[] = [];

  (boxscore.Stats as TeamStats[]).forEach((team) => {
    if (!team.PlayersStats || !Array.isArray(team.PlayersStats)) return;
    team.PlayersStats.forEach((player: PlayerStats) => {
      if (player.Player && (player as any).Team === clubCode) {
        stats.push(player);
      }
    });
  });

  return stats;
}

export async function getPlayerStats(
  gamecode: string,
  playerName: string,
  seasonCode = 'E2025'
): Promise<PlayerStats[]> {
  const boxscore = await getGameBoxscore(gamecode, seasonCode);
  if (!boxscore?.Stats || !Array.isArray(boxscore.Stats)) return [];

  const stats: PlayerStats[] = [];
  const nameRegex = new RegExp(playerName, 'i');

  (boxscore.Stats as TeamStats[]).forEach((team) => {
    if (!team.PlayersStats || !Array.isArray(team.PlayersStats)) return;
    team.PlayersStats.forEach((player: PlayerStats) => {
      if (player.Player && nameRegex.test(String(player.Player))) {
        stats.push(player);
      }
    });
  });

  return stats;
}

// ---------------------------------------------------------------------------
// Player season stats
// ---------------------------------------------------------------------------

export async function getPlayerSeasonStats(
  playerCode: string,
  seasonCode = 'E2025'
): Promise<PlayerSeasonStats | null> {
  const cleanPlayerCode = playerCode.trim();

  const response = await fetch(
    `https://api-live.euroleague.net/v1/players?playerCode=${cleanPlayerCode}&seasonCode=${seasonCode}`
  );

  if (!response.ok) {
    console.warn(
      `Failed to fetch season stats for player ${cleanPlayerCode}: ${response.statusText}`
    );
    return null;
  }

  const xmlText = await response.text();
  const parsed = parser.parse(xmlText);

  // The root element is <player> or sometimes wrapped
  const playerNode = parsed?.player ?? parsed;

  const getText = (key: string): string =>
    String(playerNode?.[key] ?? '').trim();

  const getNumber = (key: string): number => {
    const v = parseFloat(getText(key));
    return isNaN(v) ? 0 : v;
  };

  const name = getText('name');
  if (!name) return null;

  // Accumulated season stats
  const seasonAccumulated: any =
    playerNode?.stats?.accumulated?.season?.find?.(
      (s: any) => s['@_code'] === seasonCode
    ) ??
    playerNode?.stats?.accumulated?.season?.[0] ??
    playerNode?.stats?.accumulated?.season ??
    null;

  let gamesPlayed = 0;
  if (seasonAccumulated) {
    const raw = String(seasonAccumulated.gamesplayed ?? '0');
    const parsed2 = parseInt(raw, 10);
    gamesPlayed = isNaN(parsed2) ? 0 : parsed2;
  }

  return {
    playerCode: cleanPlayerCode,
    name,
    clubCode: getText('clubcode'),
    clubName: getText('clubname'),
    gamesPlayed,
    timePlayed: getText('timeplayed') || '0:00',
    points: 0,
    pointsPerGame: getNumber('score'),
    fieldGoalsMade2: 0,
    fieldGoalsAttempted2: 0,
    fieldGoalsMade3: 0,
    fieldGoalsAttempted3: 0,
    freeThrowsMade: 0,
    freeThrowsAttempted: 0,
    offensiveRebounds: getNumber('offensiverebounds'),
    defensiveRebounds: getNumber('defensiverebounds'),
    totalRebounds: 0,
    reboundsPerGame: getNumber('totalrebounds'),
    assists: 0,
    assistsPerGame: getNumber('assistances'),
    steals: getNumber('steals'),
    turnovers: getNumber('turnovers'),
    blocksFavour: getNumber('blocksfavour'),
    blocksAgainst: getNumber('blocksagainst'),
    foulsCommited: getNumber('foulscommited'),
    foulsReceived: getNumber('foulsreceived'),
    valuation: 0,
    valuationPerGame: getNumber('valuation'),
    fieldGoals2Percent: sanitizeSeasonPercentageString(getText('fieldgoals2percent')),
    fieldGoals3Percent: sanitizeSeasonPercentageString(getText('fieldgoals3percent')),
    freeThrowsPercent: sanitizeSeasonPercentageString(getText('freethrowspercent')),
  };
}
