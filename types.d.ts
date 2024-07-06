interface Player {
  nickname: string;
  position: number;
  score: number;
  twolala: number;
  participation: number;
  titles: number;
  scoreByTournament: Record<string, number>;
  underdogVictory: number;
  topdogDefeat: number;
}

interface Team {
  players: string[]; // nickname
  roundsWon: number;
  tournamentTeam?: string; // in case the tournament is a team tournament
}

type Mode = "Solo" | "Duo" | "Trio" | "Double-Three";

interface Match {
  id: number;
  tournamentId: number; // Foreign key
  raw: string;
  teams: Team[];
  stage: Stage;
  mode: Mode;
  winners: string[]; // Generated from teams
  losers: string[]; // Generated from teams
  isWO: boolean;
  isTwolala: boolean;
}

interface MatchScoreClarification {
  matchId: number;
  clarification: string;
}
