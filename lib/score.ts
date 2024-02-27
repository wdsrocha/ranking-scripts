interface Team {
  players: string[]; // nickname
  roundsWon: number;
}

interface Match {
  tournamentId: number;
  stage: Stage;
  teams: Team[];
  winners: string[];
}

enum Stage {
  Unknown = "Fase desconhecida",
  EightFinals = "Oitavas de final",
  QuarterFinals = "Quartas de final",
  SemiFinals = "Semifinal",
  Finals = "Final",
}

class Player {
  nickname: string;
  score: number;
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
    this.score = 0;
  }

  getTournamentScore(tournamentId: number): number {
    const tournament = this.tournaments[tournamentId];
    if (!tournament) {
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
    return this.score;
  }

  // getScore(): number {
  //   TODO: Refactor this into max number of existing tournaments This changed
  //   because it would skip tournaments where the player missed Which shouldn't
  //   happen, as there is a special case where the player loses 1 point if it
  //   misses a tournament while staying in the top 4
  //   return [0, 1, 2, 3, 4, 5, 6, 7, 8].reduce((score, id) => {
  //     return score + this.getTournamentScore(id);
  //   }, 0);
  // }

  getScoreUpTo(tournamentId: number): number {
    return [0, 1, 2, 3, 4, 5, 6, 7, 8].reduce((score, id) => {
      if (+id > tournamentId) {
        return score;
      }
      return score + this.getTournamentScore(id);
    }, 0);
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
