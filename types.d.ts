interface Player {
  nickname: string;
  position: number;
  score: number;
  twolala: number;
  participation: number;
  titles: number;
}

interface Team {
  players: string[]; // nickname
  roundsWon: number;
}

interface Match {
  id: number;
  tournamentId: number; // Foreign key
  raw: string;
  teams: Team[];
  stage: Stage;
  winners: string[]; // Generated from teams
  losers: string[]; // Generated from teams
  isWO: boolean;
  isTwolala: boolean;
}
