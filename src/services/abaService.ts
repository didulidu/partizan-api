import { Club, Game, PlayerStats, PlayerSeasonStats, TeamPlayer } from '../types/index.js';
import {
  adaptABATeam,
  adaptABAGame,
  adaptABAPlayerStat,
  adaptABAPlayerSeasonStats,
  adaptABATeamPlayer,
  type ABAPlayerSeasonRaw,
} from './abaAdapters.js';

const RAPIDAPI_BASE_URL = 'https://basketapi1.p.rapidapi.com';
/** RapidAPI key for basketapi1 — set RAPIDAPI_KEY or ABA_API_KEY in .env */
const RAPIDAPI_KEY =
  process.env.RAPIDAPI_KEY ?? process.env.ABA_API_KEY ?? '';
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
    return ABA_SEASON_IDS[`${yr - 1}-${yr}`] ?? ABA_SEASON_IDS['2025-2026'];
  }
  return ABA_SEASON_IDS['2025-2026'];
}

function rapidApiHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'X-RapidAPI-Key': RAPIDAPI_KEY,
    'X-RapidAPI-Host': RAPIDAPI_HOST,
  };
}

// ---------------------------------------------------------------------------
// Rate limiter — RapidAPI allows max 6 requests/sec.
// Leaky-bucket: each call claims a slot spaced 167ms apart.
// JS is single-threaded so the read-modify-write on nextSlot is atomic up to
// the await, meaning concurrent callers each get a unique future slot without
// any mutex.
// ---------------------------------------------------------------------------
const RATE_SLOT_MS = Math.ceil(1000 / 6); // 167ms → max 5.99 req/sec
let nextSlot = 0;

async function rateLimitedFetch(path: string): Promise<Response> {
  const now = Date.now();
  nextSlot = Math.max(now, nextSlot) + RATE_SLOT_MS;
  const waitMs = nextSlot - RATE_SLOT_MS - now;
  if (waitMs > 0) await new Promise<void>(r => setTimeout(r, waitMs));
  return fetch(`${RAPIDAPI_BASE_URL}${path}`, { headers: rapidApiHeaders() });
}

function rapidApiFetch(path: string): Promise<Response> {
  if (!RAPIDAPI_KEY.trim()) {
    return Promise.reject(
      new Error(
        'RapidAPI key missing: set RAPIDAPI_KEY or ABA_API_KEY in .env (BasketAPI on RapidAPI)'
      )
    );
  }
  return rateLimitedFetch(path);
}

// ---------------------------------------------------------------------------
// Teams  —  sourced from ABA standings (all 16 teams per season)
// ---------------------------------------------------------------------------

export async function getABATeams(): Promise<Club[]> {
  const seasonId = getSeasonId('2025-2026');
  const res = await rapidApiFetch(
    `/api/basketball/tournament/${ABA_TOURNAMENT_ID}/season/${seasonId}/standings/total`
  );
  if (!res.ok) throw new Error(`ABA teams fetch failed: ${res.statusText}`);

  const json = (await res.json()) as { standings?: { rows?: any[] }[] };
  const seen = new Set<number>();
  const rows = (json.standings ?? []).flatMap(s => s.rows ?? []).filter(row => {
    const id = row.team?.id;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  return rows.map(adaptABATeam);
}

// ---------------------------------------------------------------------------
// Team players  —  current squad roster
// ---------------------------------------------------------------------------

export async function getABATeamPlayers(teamId: number): Promise<TeamPlayer[]> {
  const res = await rapidApiFetch(`/api/basketball/team/${teamId}/players`);
  if (!res.ok) throw new Error(`ABA team players fetch failed: ${res.statusText}`);
  const json = (await res.json()) as { players?: any[] };
  return (json.players ?? []).map(adaptABATeamPlayer);
}

// ---------------------------------------------------------------------------
// Games  —  sourced from team's previous matches, filtered to ABA + season
// ---------------------------------------------------------------------------

export async function getABAGames(
  teamId: number,
  season: string | number = '2025-2026'
): Promise<Game[]> {
  const seasonId = getSeasonId(season);
  const allGames: Game[] = [];

  // Paginate through previous matches; don't early-break on a page with 0 ABA
  // games (other tournaments like KLS playoffs may interleave).
  for (let page = 0; page < 6; page++) {
    const res = await rapidApiFetch(
      `/api/basketball/team/${teamId}/matches/previous/${page}`
    );
    if (!res.ok) break;

    const json = (await res.json()) as { events?: any[] };
    const events = json.events ?? [];
    if (events.length === 0) break;

    const pageGames = events.filter(
      (e: any) =>
        e.tournament?.uniqueTournament?.id === ABA_TOURNAMENT_ID &&
        e.season?.id === seasonId
    );

    allGames.push(...pageGames.map(adaptABAGame));
  }

  allGames.sort((a, b) => b.date.localeCompare(a.date));
  return allGames;
}

// ---------------------------------------------------------------------------
// Player game stats  —  not available in BasketAPI for ABA League
// ---------------------------------------------------------------------------

export async function getAllABAPlayerStats(
  gameId: number,
  teamId: number
): Promise<PlayerStats[]> {
  try {
    const res = await rapidApiFetch(`/api/basketball/match/${gameId}/lineups`);
    const json = await res.json();
  if (!res.ok) return [];
 
  const allPlayers = [
    ...(json.home?.players ?? []),
    ...(json.away?.players ?? []),
  ];
  const filtered = allPlayers.filter((p) => p.teamId === teamId);
  const adapted = filtered.map(adaptABAPlayerStat);
  return adapted;
  } catch (error) {
    console.log("GLE KURCA 2",error);
    return [];
  }
  
}

// ---------------------------------------------------------------------------
// Player season stats  —  regular season + Championship Round combined
// ---------------------------------------------------------------------------

async function fetchPlayerSeasonStats(
  playerId: number,
  seasonId: number
): Promise<{ statistics: any; team: any } | null> {
  const res = await rapidApiFetch(
    `/api/basketball/player/${playerId}/tournament/${ABA_TOURNAMENT_ID}/season/${seasonId}/statistics/regularseason`
  );
  if (res.status === 204 || !res.ok) return null;
  const json = await res.json() as { statistics?: any; team?: any };
  return json.statistics?.appearances ? json as { statistics: any; team: any } : null;
}

async function fetchABARegularGroupIds(seasonId: number): Promise<Set<number>> {
  const res = await rapidApiFetch(
    `/api/basketball/tournament/${ABA_TOURNAMENT_ID}/season/${seasonId}/groups`
  );
  if (!res.ok) {
    console.log(`[ABA] fetchABARegularGroupIds: HTTP ${res.status} — returning empty set`);
    return new Set();
  }
  const json = await res.json() as { groups?: { tournamentId: number }[] };
  const ids = new Set((json.groups ?? []).map((g) => g.tournamentId));
  console.log(`[ABA] regularGroupIds for season ${seasonId}:`, [...ids]);
  return ids;
}

async function fetchChampionshipGameIds(
  playerId: number,
  seasonId: number,
  regularGroupIds: Set<number>
): Promise<number[]> {
  const gameIds: number[] = [];
  for (let page = 0; page < 4; page++) {
    const res = await rapidApiFetch(
      `/api/basketball/player/${playerId}/matches/previous/${page}`
    );
    if (!res.ok) {
      console.log(`[ABA] fetchChampionshipGameIds: page ${page} HTTP ${res.status} — stopping`);
      break;
    }
    const json = await res.json() as { events?: any[] };
    const events = json.events ?? [];
    if (!events.length) break;

    for (const e of events) {
      if (
        e.tournament?.uniqueTournament?.id === ABA_TOURNAMENT_ID &&
        e.season?.id === seasonId &&
        !regularGroupIds.has(e.tournament?.id)
      ) {
        console.log(`[ABA] championship game found: id=${e.id} tournament.id=${e.tournament?.id} (${e.tournament?.name})`);
        gameIds.push(e.id);
      }
    }

    if (events.every((e: any) => (e.season?.id ?? 0) < seasonId)) break;
  }
  console.log(`[ABA] championship game IDs total: ${gameIds.length}`, gameIds);
  return gameIds;
}

async function fetchPlayerGameStats(gameId: number, playerId: number): Promise<any | null> {
  const res = await rapidApiFetch(
    `/api/basketball/match/${gameId}/player/${playerId}/statistics`
  );
  if (res.status === 204 || !res.ok) {
    console.log(`[ABA] fetchPlayerGameStats: game ${gameId} → HTTP ${res.status} (null)`);
    return null;
  }
  const json = await res.json();
  const s = json?.statistics;
  console.log(`[ABA] fetchPlayerGameStats: game ${gameId} → pts=${s?.points} secs=${s?.secondsPlayed}`);
  return json;
}

export async function getABAPlayerSeasonStats(
  playerId: number,
  season: string | number,
  _teamId?: number
): Promise<PlayerSeasonStats | null> {
  const seasonId = getSeasonId(season);
  const fallbackSeasonId = ABA_SEASON_IDS['2024-2025'];

  // Batch 1: regular season stats + player details + regular group IDs (parallel)
  const [statsData, playerRes, groupIds] = await Promise.all([
    fetchPlayerSeasonStats(playerId, seasonId),
    rapidApiFetch(`/api/basketball/player/${playerId}`),
    fetchABARegularGroupIds(seasonId),
  ]);

  // Fallback to previous season if no data
  const usedFallback = !statsData && seasonId !== fallbackSeasonId;
  const usedSeasonId = usedFallback ? fallbackSeasonId : seasonId;

  const [regData, usedGroupIds] = await Promise.all([
    usedFallback ? fetchPlayerSeasonStats(playerId, fallbackSeasonId) : Promise.resolve(statsData),
    usedFallback ? fetchABARegularGroupIds(fallbackSeasonId) : Promise.resolve(groupIds),
  ]);

  if (!regData) return null;

  // Batch 2: find Championship Round game IDs, then fetch all per-game stats (parallel)
  const champGameIds = await fetchChampionshipGameIds(playerId, usedSeasonId, usedGroupIds);
  const champGameResults = await Promise.all(
    champGameIds.map((gid) => fetchPlayerGameStats(gid, playerId))
  );

  let playerName = '';
  if (playerRes.ok) {
    try {
      const pj = await playerRes.json() as { player?: any };
      playerName = pj.player?.name ?? '';
    } catch { /* stays empty */ }
  }

  console.log(`[ABA] reg season: appearances=${regData.statistics.appearances} pts=${regData.statistics.points}`);

  // Sum Championship Round stats
  const champ = {
    appearances: 0, secondsPlayed: 0, points: 0, rebounds: 0,
    offensiveRebounds: 0, defensiveRebounds: 0, assists: 0, steals: 0,
    turnovers: 0, blocks: 0, twoPointsMade: 0, twoPointsAttempted: 0,
    threePointsMade: 0, threePointsAttempted: 0, freeThrowsMade: 0,
    freeThrowsAttempted: 0, personalFouls: 0,
  };
  for (const result of champGameResults) {
    const s = result?.statistics;
    if (!s || !s.secondsPlayed) {
      console.log(`[ABA] championship game skipped — null result or 0 secondsPlayed`, result?.statistics ?? 'null');
      continue;
    }
    champ.appearances++;
    champ.secondsPlayed       += s.secondsPlayed      ?? 0;
    champ.points              += s.points             ?? 0;
    champ.rebounds            += s.rebounds           ?? 0;
    champ.offensiveRebounds   += s.offensiveRebounds  ?? 0;
    champ.defensiveRebounds   += s.defensiveRebounds  ?? 0;
    champ.assists             += s.assists            ?? 0;
    champ.steals              += s.steals             ?? 0;
    champ.turnovers           += s.turnovers          ?? 0;
    champ.blocks              += s.blocks             ?? 0;
    champ.twoPointsMade       += s.twoPointsMade      ?? 0;
    champ.twoPointsAttempted  += s.twoPointAttempts   ?? 0;
    champ.threePointsMade     += s.threePointsMade    ?? 0;
    champ.threePointsAttempted+= s.threePointAttempts ?? 0;
    champ.freeThrowsMade      += s.freeThrowsMade     ?? 0;
    champ.freeThrowsAttempted += s.freeThrowAttempts  ?? 0;
    champ.personalFouls       += s.personalFouls      ?? 0;
  }

  console.log(`[ABA] champ round: appearances=${champ.appearances} pts=${champ.points}`);
  console.log(`[ABA] TOTAL: appearances=${regData.statistics.appearances + champ.appearances} pts=${(regData.statistics.points ?? 0) + champ.points}`);

  const reg = regData.statistics;
  const usedSeason =
    Object.entries(ABA_SEASON_IDS).find(([, id]) => id === usedSeasonId)?.[0] ?? String(season);

  const raw: ABAPlayerSeasonRaw = {
    playerId,
    playerName,
    teamId: regData.team?.id ?? 0,
    teamName: regData.team?.name ?? '',
    season: usedSeason,
    appearances:          reg.appearances             + champ.appearances,
    secondsPlayed:       (reg.secondsPlayed    ?? 0)  + champ.secondsPlayed,
    points:              (reg.points           ?? 0)  + champ.points,
    rebounds:            (reg.rebounds         ?? 0)  + champ.rebounds,
    offensiveRebounds:   (reg.offensiveRebounds?? 0)  + champ.offensiveRebounds,
    defensiveRebounds:   (reg.defensiveRebounds?? 0)  + champ.defensiveRebounds,
    assists:             (reg.assists          ?? 0)  + champ.assists,
    steals:              (reg.steals           ?? 0)  + champ.steals,
    turnovers:           (reg.turnovers        ?? 0)  + champ.turnovers,
    blocks:              (reg.blocks           ?? 0)  + champ.blocks,
    twoPointsMade:       (reg.twoPointsMade    ?? 0)  + champ.twoPointsMade,
    twoPointsAttempted:  (reg.twoPointAttempts ?? 0)  + champ.twoPointsAttempted,
    threePointsMade:     (reg.threePointsMade  ?? 0)  + champ.threePointsMade,
    threePointsAttempted:(reg.threePointAttempts??0)  + champ.threePointsAttempted,
    freeThrowsMade:      (reg.freeThrowsMade   ?? 0)  + champ.freeThrowsMade,
    freeThrowsAttempted: (reg.freeThrowAttempts?? 0)  + champ.freeThrowsAttempted,
    personalFouls:       (reg.personalFouls    ?? 0)  + champ.personalFouls,
  };

  return adaptABAPlayerSeasonStats(raw);
}
