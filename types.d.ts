interface Team {
  players: string[]; // nickname
  roundsWon: number;
}

interface Match {
  raw: string;
  host: string;
  date: string;
  stage: Stage;
  teams: Team[];
  isWO?: boolean;
}

interface Player {
  nickname: string;
  matches: Match[];
}

interface Tournament {
  id: string;
  host: string;
  date: string;
  champions: string[];
  runnersUp: string[];
  matches: Match[];
}

interface PlayerData extends Player {
  totalWins: number;
  twolala: number;
  titles: number;
  winRate: number;
  tournamentIds: string[]; // tournament key `${date} | ${host}`
  countByPosition: Record<TournamentPosition, number>;
}
