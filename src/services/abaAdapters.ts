import { Club, Game, PlayerStats, PlayerSeasonStats, TeamPlayer } from '../types/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseTimestamp(ts: number | string): string {
  try {
    const ms = typeof ts === 'number' ? ts * 1000 : Number(ts) * 1000;
    const date = new Date(ms);
    if (!isNaN(date.getTime())) return date.toISOString().split('T')[0];
  } catch {
    // fall through
  }
  return '0000-00-00';
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatPrettyDate(ts: number | string): string {
  const ms = typeof ts === 'number' ? ts * 1000 : Number(ts) * 1000;
  const d = new Date(ms);
  if (isNaN(d.getTime())) return '';
  return `${MONTHS[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2, '0')}, ${d.getUTCFullYear()}`;
}

function teamCode(team: any): string {
  return String(
    team?.nameCode ?? team?.shortName ?? team?.name ?? team?.id ?? ''
  );
}

function secondsToMinutes(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.round(totalSeconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatPercent(made: number, attempted: number): string {
  if (attempted === 0) return '0.0%';
  return `${((made / attempted) * 100).toFixed(1)}%`;
}

// ---------------------------------------------------------------------------
// Adapters
// ---------------------------------------------------------------------------

// Input: standings row from tournamentStandingsTotal
export function adaptABATeam(raw: any): Club {
  const team = raw.team ?? raw;
  return {
    code: String(team.id ?? ''),
    name: team.name ?? '',
    clubName: team.name ?? '',
    countryCode: team.country?.alpha2 ?? undefined,
    countryName: team.country?.name ?? undefined,
    imageUrl: undefined,
  };
}

// Input: event from previousTeamMatches or tournamentLastMatches
export function adaptABAGame(raw: any): Game {
  return {
    date: parseTimestamp(raw.startTimestamp ?? 0),
    originalDate: formatPrettyDate(raw.startTimestamp ?? 0),
    gamecode: String(raw.id ?? ''),
    homecode: teamCode(raw.homeTeam),
    awaycode: teamCode(raw.awayTeam),
  };
}

// Input: one entry from match lineups (home/away .players[]).
// Output shape matches Euroleague's raw boxscore row so the FE
// `normalizePlayer` can process it without branching.
export function adaptABAPlayerStat(raw: any): PlayerStats {
  const p = raw.player ?? {};
  const s = raw.statistics ?? {};
  const secs = s.secondsPlayed ?? 0;
  const birthYear = p.dateOfBirthTimestamp
    ? new Date(p.dateOfBirthTimestamp * 1000).getUTCFullYear().toString()
    : '';

  return {
    // FE `normalizePlayer` strips the first char — prefix with "P" so the
    // numeric id survives.
    Player_ID: p.id != null ? `P${p.id}` : '',
    Player: p.name ?? 'Unknown',
    Position: p.position ?? raw.position ?? '-',
    Dorsal: raw.jerseyNumber ?? raw.shirtNumber ?? p.jerseyNumber ?? '',
    Height: p.height ?? 0,
    BirthYear: birthYear,
    Minutes: secs > 0 ? secondsToMinutes(secs) : (raw.substitute ? 'DNP' : ''),
    Points: s.points ?? 0,
    FieldGoalsMade2: s.twoPointsMade ?? 0,
    FieldGoalsAttempted2: s.twoPointAttempts ?? 0,
    FieldGoalsMade3: s.threePointsMade ?? 0,
    FieldGoalsAttempted3: s.threePointAttempts ?? 0,
    FreeThrowsMade: s.freeThrowsMade ?? 0,
    FreeThrowsAttempted: s.freeThrowAttempts ?? 0,
    OffensiveRebounds: s.offensiveRebounds ?? 0,
    DefensiveRebounds: s.defensiveRebounds ?? 0,
    TotalRebounds: s.rebounds ?? 0,
    Assistances: s.assists ?? 0,
  };
}

// Input: one entry from teamPlayers response (.players[])
export function adaptABATeamPlayer(raw: any): TeamPlayer {
  const p = raw.player ?? raw;
  const name: string = p.name ?? '';
  const birthYear = p.dateOfBirthTimestamp
    ? new Date(p.dateOfBirthTimestamp * 1000).getUTCFullYear().toString()
    : '';
  return {
    id: String(p.id ?? ''),
    name,
    slug: p.slug ?? '',
    position: p.position ?? '',
    jerseyNumber: String(raw.jerseyNumber ?? raw.shirtNumber ?? p.jerseyNumber ?? ''),
    height: p.height ?? 0,
    birthYear,
    countryCode: p.country?.alpha2 ?? undefined,
    countryName: p.country?.name ?? undefined,
  };
}

// Input: stats from playerStatisticsRegularSeason endpoint
export interface ABAPlayerSeasonRaw {
  playerId: number;
  playerName: string;
  teamId: number;
  teamName: string;
  season: string;
  appearances: number;
  secondsPlayed: number;
  points: number;
  rebounds: number;
  offensiveRebounds: number;
  defensiveRebounds: number;
  assists: number;
  steals: number;
  turnovers: number;
  blocks: number;
  twoPointsMade: number;
  twoPointsAttempted: number;
  threePointsMade: number;
  threePointsAttempted: number;
  freeThrowsMade: number;
  freeThrowsAttempted: number;
  personalFouls: number;
}

export function adaptABAPlayerSeasonStats(raw: ABAPlayerSeasonRaw): PlayerSeasonStats | null {
  const appearances = raw.appearances;
  if (!appearances) return null;

  const avgSeconds = Math.round(raw.secondsPlayed / appearances);
  const totalPoints = raw.points;
  const totalRebounds = raw.rebounds;
  const totalAssists = raw.assists;

  return {
    playerCode: String(raw.playerId),
    name: raw.playerName,
    clubCode: String(raw.teamId),
    clubName: raw.teamName,
    season: raw.season,
    gamesPlayed: appearances,
    timePlayed: secondsToMinutes(avgSeconds),
    points: totalPoints,
    pointsPerGame: parseFloat((totalPoints / appearances).toFixed(1)),
    fieldGoalsMade2: raw.twoPointsMade,
    fieldGoalsAttempted2: raw.twoPointsAttempted,
    fieldGoalsMade3: raw.threePointsMade,
    fieldGoalsAttempted3: raw.threePointsAttempted,
    freeThrowsMade: raw.freeThrowsMade,
    freeThrowsAttempted: raw.freeThrowsAttempted,
    offensiveRebounds: raw.offensiveRebounds,
    defensiveRebounds: raw.defensiveRebounds,
    totalRebounds,
    reboundsPerGame: parseFloat((totalRebounds / appearances).toFixed(1)),
    assists: totalAssists,
    assistsPerGame: parseFloat((totalAssists / appearances).toFixed(1)),
    steals: raw.steals,
    turnovers: raw.turnovers,
    blocksFavour: raw.blocks,
    blocksAgainst: 0,
    foulsCommited: raw.personalFouls,
    foulsReceived: 0,
    valuation: 0,
    valuationPerGame: 0,
    fieldGoals2Percent: formatPercent(raw.twoPointsMade, raw.twoPointsAttempted),
    fieldGoals3Percent: formatPercent(raw.threePointsMade, raw.threePointsAttempted),
    freeThrowsPercent: formatPercent(raw.freeThrowsMade, raw.freeThrowsAttempted),
  };
}
