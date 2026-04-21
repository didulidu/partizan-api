import { Club, Game, PlayerStats, PlayerSeasonStats } from '../types/index.js';
import {
  adaptABATeam,
  adaptABAGame,
  adaptABAPlayerSeasonStats,
  type ABAPlayerSeasonRaw,
} from './abaAdapters.js';

const RAPIDAPI_BASE_URL = 'https://basketapi1.p.rapidapi.com';
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY ?? '';
const RAPIDAPI_HOST = 'basketapi1.p.rapidapi.com';

const ABA_TOURNAMENT_ID = 235;

// Maps "YYYY-YYYY" season strings to RapidAPI season IDs for ABA League
const ABA_SEASON_IDS: Record<string, number> = {
  '2025-2026': 80150,
  '2024-2025': 61743,
  '2023-2024': 53473,
  '2022-2023': 44539,
  '2021-2022': 37688,
  '2020-2021': 29225,
};

function getSeasonId(season: string | number): number {
  const s = String(season).trim();
  if (ABA_SEASON_IDS[s]) return ABA_SEASON_IDS[s];
  // Handle "2025" → "2024-2025"
  if (/^\d{4}$/.test(s)) {
    const yr = parseInt(s, 10);
    return ABA_SEASON_IDS[`${yr - 1}-${yr}`] ?? ABA_SEASON_IDS['2024-2025'];
  }
  return ABA_SEASON_IDS['2024-2025'];
}

function rapidApiFetch(path: string): Promise<Response> {
  return fetch(`${RAPIDAPI_BASE_URL}${path}`, {
    headers: {
      'X-RapidAPI-Key': RAPIDAPI_KEY,
      'X-RapidAPI-Host': RAPIDAPI_HOST,
    },
  });
}

// ---------------------------------------------------------------------------
// Teams  —  sourced from ABA standings (all 16 teams per season)
// ---------------------------------------------------------------------------

export async function getABATeams(): Promise<Club[]> {
  const seasonId = getSeasonId('2024-2025');
  const res = await rapidApiFetch(
    `/api/basketball/tournament/${ABA_TOURNAMENT_ID}/season/${seasonId}/standings/total`
  );
  if (!res.ok) throw new Error(`ABA teams fetch failed: ${res.statusText}`);

  const json = (await res.json()) as { standings?: { rows?: any[] }[] };
  const rows = json.standings?.[0]?.rows ?? [];
  return rows.map(adaptABATeam);
}

// ---------------------------------------------------------------------------
// Games  —  sourced from team's previous matches, filtered to ABA + season
// ---------------------------------------------------------------------------

export async function getABAGames(
  teamId: number,
  season: string | number = '2024-2025'
): Promise<Game[]> {
  const seasonId = getSeasonId(season);
  const allGames: Game[] = [];

  // Paginate through previous matches until ABA season games are exhausted
  for (let page = 0; page < 4; page++) {
    const res = await rapidApiFetch(
      `/api/basketball/team/${teamId}/matches/previous/${page}`
    );
    if (!res.ok) break;

    const json = (await res.json()) as { events?: any[] };
    const events = json.events ?? [];

    const pageGames = events.filter(
      (e: any) =>
        e.tournament?.uniqueTournament?.id === ABA_TOURNAMENT_ID &&
        e.season?.id === seasonId
    );

    allGames.push(...pageGames.map(adaptABAGame));

    // Once a page yields no ABA season matches, older pages won't either
    if (pageGames.length === 0) break;
  }

  allGames.sort((a, b) => b.date.localeCompare(a.date));
  return allGames;
}

// ---------------------------------------------------------------------------
// Player game stats  —  not available in BasketAPI for ABA League
// ---------------------------------------------------------------------------

export async function getAllABAPlayerStats(
  _gameId: number,
  _teamId: number
): Promise<PlayerStats[]> {
  return [];
}

export async function getABAPlayerStats(
  _gameId: number,
  _playerId: number
): Promise<PlayerStats | null> {
  return null;
}

// ---------------------------------------------------------------------------
// Player season stats  —  sourced from team top-players (regular season)
// ---------------------------------------------------------------------------

export async function getABAPlayerSeasonStats(
  playerId: number,
  season: string | number,
  teamId?: number
): Promise<PlayerSeasonStats | null> {
  if (!teamId) return null;

  const seasonId = getSeasonId(season);
  const res = await rapidApiFetch(
    `/api/basketball/team/${teamId}/tournament/${ABA_TOURNAMENT_ID}/season/${seasonId}/best-players/regularseason`
  );
  if (!res.ok) throw new Error(`ABA player season stats fetch failed: ${res.statusText}`);

  const json = (await res.json()) as { topPlayers?: Record<string, any[]> };
  const topPlayers = json.topPlayers ?? {};

  // Merge per-category stats into one object keyed by player ID
  const statsMap = new Map<
    number,
    { player: any; team: any; stats: Record<string, number> }
  >();

  for (const entries of Object.values(topPlayers)) {
    for (const entry of entries) {
      const pid: number = entry.player?.id;
      if (!pid) continue;

      if (!statsMap.has(pid)) {
        statsMap.set(pid, {
          player: entry.player,
          team: entry.team,
          stats: { appearances: entry.statistics.appearances ?? 0 },
        });
      }

      const record = statsMap.get(pid)!;
      // appearances is the same across categories — keep highest value seen
      const newAppearances = entry.statistics.appearances ?? 0;
      if (newAppearances > record.stats.appearances) {
        record.stats.appearances = newAppearances;
      }
      // Merge numeric stat fields (skip id, type, statisticsType, appearances)
      for (const [k, v] of Object.entries(entry.statistics)) {
        if (
          k !== 'id' &&
          k !== 'type' &&
          k !== 'statisticsType' &&
          k !== 'appearances' &&
          typeof v === 'number'
        ) {
          record.stats[k] = v;
        }
      }
    }
  }

  const found = statsMap.get(playerId);
  if (!found) return null;

  const raw: ABAPlayerSeasonRaw = {
    playerId,
    playerName: found.player?.name ?? '',
    teamId: found.team?.id ?? teamId,
    teamName: found.team?.name ?? '',
    appearances: found.stats.appearances ?? 0,
    secondsPlayed: found.stats.secondsPlayed ?? 0,
    points: found.stats.points ?? 0,
    rebounds: found.stats.rebounds ?? 0,
    offensiveRebounds: found.stats.offensiveRebounds ?? 0,
    defensiveRebounds: found.stats.defensiveRebounds ?? 0,
    assists: found.stats.assists ?? 0,
    steals: found.stats.steals ?? 0,
    turnovers: found.stats.turnovers ?? 0,
    blocks: found.stats.blocks ?? 0,
    fieldGoalsMade: found.stats.fieldGoalsMade ?? 0,
    fieldGoalsPercentage: found.stats.fieldGoalsPercentage ?? 0,
    threePointsMade: found.stats.threePointsMade ?? 0,
    threePointsPercentage: found.stats.threePointsPercentage ?? 0,
    freeThrowsMade: found.stats.freeThrowsMade ?? 0,
    freeThrowsPercentage: found.stats.freeThrowsPercentage ?? 0,
  };

  return adaptABAPlayerSeasonStats(raw);
}
