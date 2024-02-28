enum Delta {
  NONE = "",
  UP = "▲",
  DOWN = "▼",
}

interface PlayerRankingData {
  nickname: string;
  position: number;
  score: number;
  twolala: number;
  participation: number;
  titles: number;
}

function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu("Ações")
    .addItem("Atualizar ranking", "updateLeaderboard")
    .addItem("Atualizar S1", "updateLeaderboard1")
    .addItem("Atualizar S2", "updateLeaderboard2")
    .addItem("Re-calcular pontos", "main")
    .addToUi();
}

function main() {
  const matches = readMatches("Batalhas S2");

  let players: Record<string, PlayerRankingData> = {};

  matches.forEach((match) => {
    match.teams.forEach((team) => {
      team.players.forEach((nickname) => {
        if (!(nickname in players)) {
          players[nickname] = {
            nickname,
            position: 0,
            score: 0,
            twolala: 0,
            participation: 0,
            titles: 0,
          };
        }
      });
    });
  });

  const matchesByTournament: Record<string, Match[]> = {};
  matches.forEach((match) => {
    if (!(match.tournamentId in matchesByTournament)) {
      matchesByTournament[match.tournamentId] = [];
    }
    matchesByTournament[match.tournamentId].push(match);
  });

  let prevPlayers: Record<string, PlayerRankingData> = JSON.parse(
    JSON.stringify(players)
  );
  Object.entries(matchesByTournament).forEach(([id, matches]) => {
    const hasPlayerParticipated: Record<string, boolean> = {};
    matches.forEach((match) => {
      const { winnerScore, loserScore } = calculateMatchScore(
        match,
        prevPlayers,
        true
      );

      match.teams.forEach((team) => {
        team.players.forEach((nickname) => {
          const player = players[nickname];
          hasPlayerParticipated[nickname] = true;

          if (match.winners.includes(nickname)) {
            player.score += winnerScore;
            player.twolala += match.isTwolala ? 1 : 0;
            player.titles += match.stage === Stage.Finals ? 1 : 0;
          } else {
            player.score += loserScore;
          }
        });
      });
    });

    Object.entries(hasPlayerParticipated).forEach(
      ([nickname, hasParticipated]) => {
        if (hasParticipated) {
          players[nickname].participation++;
        }
      }
    );

    // console.log(JSON.stringify(players, null, 2));

    const leaderboard = Object.values(players)
      // Desative o filtro para verificar se tá tudo certo
      .filter((player) => player.score > 0)
      .sort(function comparePlayers(
        a: PlayerRankingData,
        b: PlayerRankingData
      ) {
        if (a.score != b.score) {
          return b.score - a.score;
        } else if (a.twolala != b.twolala) {
          return b.twolala - a.twolala;
        } else if (a.titles != b.titles) {
          return b.titles - a.titles;
        } else if (a.participation != b.participation) {
          return a.participation - b.participation;
        } else {
          return 0;
        }
      })
      .map((player, index) => {
        return { ...player, position: index + 1 };
      });

    // console.log(JSON.stringify(leaderboard, null, 2));

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(`Placar ${id.padStart(2, "0")}`);
    if (!sheet) {
      return;
    }

    sheet.getRange(3, 1, 100, 8).clearContent();

    leaderboard.map((player, index) => {
      const range = sheet.getRange(index + 3, 1, 1, 8);

      const scoreDelta = player.score - prevPlayers[player.nickname].score;
      let scoreDeltaText = "";
      if (scoreDelta > 0) {
        scoreDeltaText = `+${scoreDelta}`;
      } else if (scoreDelta < 0) {
        scoreDeltaText = scoreDelta.toString(); // comes with minus sign
      }

      let positionDeltaText = "";

      range.setValues([
        [
          player.position,
          player.nickname,
          positionDeltaText,
          scoreDeltaText,
          player.score,
          player.twolala,
          player.participation,
          player.titles,
        ],
      ]);
    });

    prevPlayers = JSON.parse(JSON.stringify(players));
  });
}

function printMatch(match: Match): string {
  const leftTeam = match.teams[0].players.join(" e ");
  const leftSide = `${leftTeam} ${match.teams[0].roundsWon}`;
  const rightTeam = match.teams[1].players.join(" e ");
  const rightSide = `${match.teams[1].roundsWon} ${rightTeam}`;
  return [leftSide, rightSide].join(" x ");
}

function calculateMatchScore(
  match: Match,
  lastTournamentScores: Record<string, Pick<PlayerRankingData, "score">>,
  verbose: boolean = false
) {
  // const players = match.teams
  //   .flatMap((team) => team.players)
  //   .reduce<Record<string, number>>((players, nickname) => {
  //     return { ...players, [nickname]: 0 };
  //   }, {});

  let messages = `Batalha ${match.id}: ${match.raw}\n`;
  const winners = match.winners.join(" e ");
  const losers = match.losers.join(" e ");

  let winnerScore = 0;
  if (match.stage === Stage.Unknown) {
    throw new Error(
      `Não foi possível calcular o score da batalha "${printMatch(
        match
      )}" pois a fase "${match.stage}" é desconhecida.`
    );
  } else if (match.stage === Stage.EightFinals) {
    winnerScore += 1;
    messages += `${winners}: +1 (venceu ${match.stage})\n`;
  } else {
    winnerScore += 2;
    messages += `${winners}: +2 (venceu ${match.stage})\n`;
  }

  if (match.isTwolala) {
    winnerScore += 1;
    messages += `${winners}: +1 (twolala)\n`;
  }

  let loserScore = 0;

  let winnerTeamRating = Math.floor(
    match.winners.reduce((prev, nickname) => {
      return prev + lastTournamentScores[nickname].score;
    }, 0) / Math.max(match.winners.length, 1)
  );
  let loserTeamRating = Math.floor(
    match.losers.reduce((prev, nickname) => {
      return prev + lastTournamentScores[nickname].score;
    }, 0) / Math.max(match.losers.length, 1)
  );

  if (winnerTeamRating < loserTeamRating) {
    winnerScore += 1;
    loserScore -= 1;

    messages += `${winners} (${winnerTeamRating}) venceu e roubou 1 ponto de ${losers} (${loserTeamRating})\n`;
  }

  if (match.teams[0].players.length === 2) {
    winnerScore = Math.ceil(winnerScore / 2);
    loserScore = Math.ceil(loserScore / 2);
    messages += `Pontuação dividida por 2 por ser uma batalha de dupla\n`;
  }

  messages += `Pontuação final:\n`;
  messages += `${winners}: +${winnerScore}\n`;
  if (loserScore) {
    messages += `${losers}: ${loserScore}\n`;
  }

  messages += "\n";

  if (verbose) {
    console.log(messages);
  }

  return {
    winnerScore,
    loserScore,
  };
}

function updatePlayerDataWithMatchResult(
  players: Record<string, Player>,
  match: Match
) {
  // Create players if they don't exist
  match.teams.forEach((team) => {
    team.players.forEach((nickname) => {
      if (!(nickname in players)) {
        players[nickname] = new Player(nickname);
      }
      const player = players[nickname];

      if (!(match.tournamentId in player.tournaments)) {
        player.tournaments[match.tournamentId] = {
          wins: 0,
          perfectWins: 0,
          champion: false,
          matches: [],
          matchesWon: [],
        };
      }

      const tournament = player.tournaments[match.tournamentId];
      tournament.matches.push(match);
    });
  });

  const winningTeam = match.teams.reduce((prev, curr) => {
    return curr.roundsWon > prev.roundsWon ? curr : prev;
  }, match.teams[0]);
  const totalRounds = match.teams.reduce((prev, curr) => {
    return prev + curr.roundsWon;
  }, 0);
  // Apenas uma forma de verificar se foi twolala Em outras palavras, se a
  // quantidade total de rounds da batalha foi igual a 2, então não houve
  // terceiro round
  const wasPerfectWin = totalRounds == 2;

  winningTeam.players.forEach((nickname) => {
    const player = players[nickname];
    const tournament = player.tournaments[match.tournamentId];

    tournament.wins++;
    tournament.perfectWins += wasPerfectWin ? 1 : 0;
    if (match.stage == Stage.Finals) {
      tournament.champion = true;
    }
    tournament.matchesWon.push(match);
  });
}

function generateLeaderboards(players: Record<string, Player>): Player[] {
  return (
    Object.values(players)
      // Desative o filtro para verificar se tá tudo certo
      .filter((player) => player.getScore() > 0)
      .sort(comparePlayers)
      .map((player, index, array) => {
        if (index == 0) {
          player.position = 1;
          return player;
        }

        const drawsWithLast = comparePlayers(player, array[index - 1]) === 0;
        if (drawsWithLast) {
          player.position = array[index - 1].position;
        } else {
          player.position = index + 1;
        }
        return player;
      })
  );
}

function updateLeaderboard1() {
  return updateLeaderboard("Batalhas S1");
}

function updateLeaderboard2() {
  return updateLeaderboard("Batalhas S2");
}

function generateLeaderboard(
  sheetPrefix: string = "Placar",
  tournamentId: number
) {
  const matches = readMatches("Batalhas S2");

  const playersByTournament: Record<string, Player>[] = [];
  // matches.forEach((match) => {
  //   updatePlayerDataWithMatchResult(players, match)
}

function updateLeaderboard(sheetName: string = "Batalhas") {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  // const seasonMatches: Match[] = readMatches(sheetName);
  const seasonMatches: Match[] = readMatches(sheetName).filter(
    (match) => match.tournamentId === 1
  );

  let players: Record<string, Player> = {};

  seasonMatches.forEach((match) => {
    match.teams.forEach((team) => {
      team.players.forEach((nickname) => {
        if (!(nickname in players)) {
          players[nickname] = new Player(nickname);
        }
      });
    });

    // const { winnerScore, loserScore } = calculateMatchScore(match);

    // match.winners.forEach(
    //   (nickname) => (players[nickname].score += winnerScore)
    // );
    // match.losers.forEach((nickname) => (players[nickname].score += loserScore));
    // updatePlayerDataWithMatchResult(players, match);
  });

  const lastTournament = seasonMatches.reduce(
    (prev, curr) => (curr.tournamentId > prev.tournamentId ? curr : prev),
    seasonMatches[0]
  ).tournamentId;
  const previousMatches = seasonMatches.filter(
    (match) => match.tournamentId !== lastTournament
  );
  // Equivalente à seasonMatches, mas indo apenas até a penúltima rodada
  let previousPlayerData: Record<string, Player> = {};
  previousMatches.forEach((match) => {
    updatePlayerDataWithMatchResult(previousPlayerData, match);
  });

  const leaderboard = generateLeaderboards(players);
  generateLeaderboards(previousPlayerData).forEach((player) => {
    previousPlayerData[player.nickname].position = player.position;
  });

  const sheet = ss.getSheetByName("Novo Placar");
  if (!sheet) {
    return;
  }

  sheet.getRange(3, 1, 100, 7).clearContent();

  leaderboard.map((player, index) => {
    const range = sheet.getRange(index + 3, 1, 1, 7);

    const previous = previousPlayerData[player.nickname];
    if (!previous) {
      const score = player.getScore() ? `+${player.getScore()}` : "";
      return range.setValues([
        [
          player.position,
          player.nickname,
          score ? Delta.UP : Delta.NONE,
          score,
          player.getScore(),
          player.getPerfectWins(),
          player.getParticipations(),
        ],
      ]);
    }

    const scoreDelta = player.getScore() - previous.getScore();
    let tournamentScore = "";
    if (scoreDelta < 0) {
      tournamentScore = scoreDelta.toString();
    } else if (scoreDelta > 0) {
      tournamentScore = `+${scoreDelta}`;
    }

    let delta: string = Delta.NONE;
    if (
      !player.position ||
      !previous.position ||
      player.position == previous.position
    ) {
      delta = Delta.NONE;
    } else if (player.position > previous.position) {
      delta = `${player.position - previous.position} ${Delta.DOWN}`;
    } else if (player.position < previous.position) {
      delta = `${previous.position - player.position} ${Delta.UP}`;
    }

    return range.setValues([
      [
        player.position,
        player.nickname,
        delta,
        tournamentScore,
        player.getScore(),
        player.getPerfectWins(),
        player.getParticipations(),
      ],
    ]);
  });
}

function toStage(rawStage: string): Stage {
  rawStage = rawStage.toLocaleLowerCase();
  if (rawStage === "oitavas de final") {
    return Stage.EightFinals;
  } else if (rawStage === "quartas de final") {
    return Stage.QuarterFinals;
  } else if (
    rawStage === "semifinal" ||
    rawStage === "semi final" ||
    rawStage === "semifinais"
  ) {
    return Stage.SemiFinals;
  } else if (rawStage === "final") {
    return Stage.Finals;
  } else {
    return Stage.Unknown;
  }
}
