interface Team {
  players: string[]; // nickname
  roundsWon: number;
}

interface Match {
  tournamentId: number;
  stage: Stage;
  teams: Team[];
}

enum Stage {
  EightFinals,
  QuarterFinals,
  SemiFinals,
  Finals,
}

class Player {
  nickname: string;
  tournaments: {
    [tournament: number]: {
      matchesWon: Match[];
      wins: number;
      perfectWins: number;
      champion: boolean;
    };
  };

  position?: number;

  constructor(nickname: string) {
    this.nickname = nickname;
    this.tournaments = {};
  }

  getTournamentScore(tournamentId: number): number {
    const tournament = this.tournaments[tournamentId];
    if (tournament === undefined) {
      return 0;
    }

    let score = tournament.perfectWins;
    if (tournament.wins === 1) {
      score += 1;
    } else if (tournament.wins === 2) {
      score += 3;
    } else if (tournament.wins === 3) {
      score += 5;
    } else if (tournament.wins === 4) {
      score += 7;
    }

    return score;
  }

  getParticipations(): number {
    return Object.keys(this.tournaments).length;
  }

  getScore(): number {
    return Object.keys(this.tournaments).reduce((score, id) => {
      return score + this.getTournamentScore(+id);
    }, 0);
  }

  getPerfectWins(): number {
    return Object.keys(this.tournaments).reduce((score, id) => {
      return score + this.tournaments[+id].perfectWins;
    }, 0);
  }

  getTournamentsWon(): number {
    return Object.keys(this.tournaments).reduce((score, id) => {
      return score + +this.tournaments[+id].champion;
    }, 0);
  }

  countMatchesWonAgainst(opponent: Player): number {
    return Object.values(this.tournaments).reduce((matches, tournament) => {
      return (
        matches +
        tournament.matchesWon.filter((match) => {
          return match.teams.some((team) => {
            return (
              team.players.includes(opponent.nickname) &&
              !team.players.includes(this.nickname)
            );
          });
        }).length
      );
    }, 0);
  }
}

function comparePlayers(a: Player, b: Player) {
  if (a.getScore() != b.getScore()) {
    return b.getScore() - a.getScore();
  } else if (a.getPerfectWins() != b.getPerfectWins()) {
    return b.getPerfectWins() - a.getPerfectWins();
  } else if (a.getTournamentsWon() != b.getTournamentsWon()) {
    return b.getTournamentsWon() - a.getTournamentsWon();
  } else if (a.getParticipations() != b.getParticipations()) {
    return b.getParticipations() - a.getParticipations();
  }

  const aOverB = a.countMatchesWonAgainst(b);
  const bOverA = b.countMatchesWonAgainst(a);

  if (aOverB != bOverA) {
    return bOverA - aOverB;
  }

  return 0;
}

function getStageFromIndex(index: number): Stage {
  if (index < 8) {
    return Stage.EightFinals;
  } else if (index < 12) {
    return Stage.QuarterFinals;
  } else if (index < 14) {
    return Stage.SemiFinals;
  } else {
    return Stage.Finals;
  }
}

function isTournamentSheetName(name: string): boolean {
  return name.match(/^Rodada \d\d$/) !== null;
}

function parseTournamentSheet(
  sheet: GoogleAppsScript.Spreadsheet.Sheet
): Match[] {
  if (!isTournamentSheetName(sheet.getName())) {
    SpreadsheetApp.getUi().alert("Nome da planilha inválido");
  }

  const tournamentId = parseInt(sheet.getName().split(" ")[1]!);

  const range = sheet.getRange(3, 2, 15, 4);
  const values = range.getValues();

  const matches: Match[] = [];

  // Only 1x1
  values.forEach((row, i) => {
    const [nickname1, roundsWon1, roundsWon2, nickname2] = row;

    matches.push({
      tournamentId,
      stage: getStageFromIndex(i),
      teams: [
        {
          roundsWon: roundsWon1,
          players: [nickname1],
        },
        {
          roundsWon: roundsWon2,
          players: [nickname2],
        },
      ],
    });
  });

  return matches;
}
