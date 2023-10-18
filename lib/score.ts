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
      matches: Match[];
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

    let score = 0;
    if (tournament.wins === 1) {
      score = 1;
    } else if (tournament.wins === 2) {
      score = 3;
    } else if (tournament.wins === 3) {
      score = 5;
    } else if (tournament.wins === 4) {
      score = 7;
    }

    // Se a batalha for de dupla, a pontuação é dividida entre a dupla,
    // arredondando para cima
    if (tournament.matches[0].teams[0].players.length === 2) {
      score = Math.ceil(score / 2);
    }

    score += tournament.perfectWins;

    return score;
  }

  getParticipations(): number {
    return Object.keys(this.tournaments).length;
  }

  getScore(): number {
    const hasPenalty = this.nickname === "Manogê";
    return (
      Object.keys(this.tournaments).reduce((score, id) => {
        return score + this.getTournamentScore(+id);
      }, 0) - +hasPenalty
    );
  }

  getPerfectWins(): number {
    return Object.keys(this.tournaments).reduce((score, id) => {
      return score + this.tournaments[+id].perfectWins;
    }, 0);
  }

  getWins(): number {
    return Object.keys(this.tournaments).reduce((score, id) => {
      return score + this.tournaments[+id].wins;
    }, 0);
  }

  getDefeats(): number {
    return Object.keys(this.tournaments).reduce((score, id) => {
      return (
        score +
        this.tournaments[+id].matches.length -
        this.tournaments[+id].matchesWon.length
      );
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
    return a.getParticipations() - b.getParticipations();
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
  const values = range.getValues() as [string, number, number, string][];

  const matches: Match[] = [];

  // Only 1x1
  values.forEach((row, i) => {
    // string, number, number, string
    const [team1, roundsWon1, roundsWon2, team2] = row;

    // Se não der match no regex, ainda assim vira um array de um só item
    const players1 = team1.split(" e ");
    const players2 = team2.split(" e ");

    matches.push({
      tournamentId,
      stage: getStageFromIndex(i),
      teams: [
        {
          roundsWon: roundsWon1,
          players: players1,
        },
        {
          roundsWon: roundsWon2,
          players: players2,
        },
      ],
    });
  });

  return matches;
}
