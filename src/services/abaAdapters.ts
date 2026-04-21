import { Club, Game, PlayerStats, PlayerSeasonStats } from '../types/index.js';

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
    originalDate: String(raw.startTimestamp ?? ''),
    gamecode: String(raw.id ?? ''),
    homecode: String(raw.homeTeam?.id ?? ''),
    awaycode: String(raw.awayTeam?.id ?? ''),
  };
}

// Not used (per-game player stats not available in BasketAPI for ABA)
export function adaptABAPlayerStat(_raw: any): PlayerStats {
  return {};
}

// Input: merged stats object built from teamTopPlayersRegularSeason categories
export interface ABAPlayerSeasonRaw {
  playerId: number;
  playerName: string;
  teamId: number;
  teamName: string;
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
  fieldGoalsMade: number;
  fieldGoalsPercentage: number;
  threePointsMade: number;
  threePointsPercentage: number;
  freeThrowsMade: number;
  freeThrowsPercentage: number;
}

export function adaptABAPlayerSeasonStats(raw: ABAPlayerSeasonRaw): PlayerSeasonStats | null {
  const appearances = raw.appearances;
  if (!appearances) return null;

  const avgSeconds = Math.round(raw.secondsPlayed / appearances);

  // Derive attempts from made + percentage
  const totalFgMade = raw.fieldGoalsMade;
  const totalFgAttempted = raw.fieldGoalsPercentage > 0
    ? Math.round(totalFgMade / raw.fieldGoalsPercentage * 100)
    : 0;

  const total3pMade = raw.threePointsMade;
  const total3pAttempted = raw.threePointsPercentage > 0
    ? Math.round(total3pMade / raw.threePointsPercentage * 100)
    : 0;

  // 2-point field goals derived from total minus 3-pointers
  const totalFgMade2 = Math.max(0, totalFgMade - total3pMade);
  const totalFgAttempted2 = Math.max(0, totalFgAttempted - total3pAttempted);

  const totalFtMade = raw.freeThrowsMade;
  const totalFtAttempted = raw.freeThrowsPercentage > 0
    ? Math.round(totalFtMade / raw.freeThrowsPercentage * 100)
    : 0;

  const totalPoints = raw.points;
  const totalRebounds = raw.rebounds;
  const totalAssists = raw.assists;

  return {
    playerCode: String(raw.playerId),
    name: raw.playerName,
    clubCode: String(raw.teamId),
    clubName: raw.teamName,
    gamesPlayed: appearances,
    timePlayed: secondsToMinutes(avgSeconds),
    points: totalPoints,
    pointsPerGame: parseFloat((totalPoints / appearances).toFixed(1)),
    fieldGoalsMade2: totalFgMade2,
    fieldGoalsAttempted2: totalFgAttempted2,
    fieldGoalsMade3: total3pMade,
    fieldGoalsAttempted3: total3pAttempted,
    freeThrowsMade: totalFtMade,
    freeThrowsAttempted: totalFtAttempted,
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
    foulsCommited: 0,
    foulsReceived: 0,
    valuation: 0,
    valuationPerGame: 0,
    fieldGoals2Percent: formatPercent(totalFgMade2, totalFgAttempted2),
    fieldGoals3Percent: formatPercent(total3pMade, total3pAttempted),
    freeThrowsPercent: formatPercent(totalFtMade, totalFtAttempted),
  };
}
