export interface Game {
  date: string;
  originalDate: string;
  gamecode: string;
  homecode: string;
  awaycode: string;
}

export interface Club {
  code: string;
  name: string;
  clubName: string;
  countryCode?: string;
  countryName?: string;
  imageUrl?: string;
  [key: string]: unknown;
}

export interface PlayerStats {
  Player?: string;
  Player_ID?: string;
  [key: string]: unknown;
}

export interface PlayerSeasonStats {
  playerCode: string;
  name: string;
  clubCode: string;
  clubName: string;
  gamesPlayed: number;
  timePlayed: string;
  points: number;
  pointsPerGame: number;
  fieldGoalsMade2: number;
  fieldGoalsAttempted2: number;
  fieldGoalsMade3: number;
  fieldGoalsAttempted3: number;
  freeThrowsMade: number;
  freeThrowsAttempted: number;
  offensiveRebounds: number;
  defensiveRebounds: number;
  totalRebounds: number;
  reboundsPerGame: number;
  assists: number;
  assistsPerGame: number;
  steals: number;
  turnovers: number;
  blocksFavour: number;
  blocksAgainst: number;
  foulsCommited: number;
  foulsReceived: number;
  valuation: number;
  valuationPerGame: number;
  fieldGoals2Percent?: string;
  fieldGoals3Percent?: string;
  freeThrowsPercent?: string;
}

export interface TeamStats {
  PlayersStats?: PlayerStats[];
  [key: string]: unknown;
}

export interface BoxscoreData {
  Stats?: TeamStats[];
  [key: string]: unknown;
}
