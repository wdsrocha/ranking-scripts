const MATCHES_SHEET = "Batalhas";

enum Stage {
  Unknown = "Fase desconhecida",
  EightFinals = "Oitavas de final",
  QuarterFinals = "Quartas de final",
  SemiFinals = "Semifinal",
  Finals = "Final",
}

function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu("Ações").addItem("Re-calcular pontos", "main").addToUi();
}

function main() {
  const matches = readMatches(MATCHES_SHEET);

  let players: Record<string, Player> = {};

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
            underdogVictory: 0,
            topdogDefeat: 0,
            scoreByTournament: {
              "1": 0,
              "2": 0,
              "3": 0,
              "4": 0,
              "5": 0,
              "6": 0,
              "7": 0,
              "8": 0,
              "9": 0,
              "10": 0,
            },
          };
        }

        if (!(match.tournamentId in players[nickname].scoreByTournament)) {
          players[nickname].scoreByTournament[match.tournamentId] = 0;
        }
      });
    });
  });

  const matchesByTournament: Record<string, Match[]> = {};
  let lastTournament = 0;
  matches.forEach((match) => {
    if (!(match.tournamentId in matchesByTournament)) {
      matchesByTournament[match.tournamentId] = [];
    }
    matchesByTournament[match.tournamentId].push(match);
    lastTournament = Math.max(lastTournament, match.tournamentId);
  });

  let prevPlayers: Record<string, Player> = JSON.parse(JSON.stringify(players));
  const matchScoreClarifications: MatchScoreClarification[] = [];

  let leaderboard: Player[] = [];

  Object.entries(matchesByTournament).forEach(([id, matches]) => {
    const participants: Set<string> = new Set();
    matches.forEach((match) => {
      const { winnerScore, loserScore, clarification, underdogVictory } =
        calculateMatchScore(
          match,
          prevPlayers,
          players
          // true
        );
      matchScoreClarifications.push({ matchId: match.id, clarification });

      match.teams.forEach((team) => {
        team.players.forEach((nickname) => {
          const player = players[nickname];
          participants.add(nickname);

          if (match.winners.includes(nickname)) {
            player.score += winnerScore;
            player.scoreByTournament[id] += winnerScore;
            player.twolala += match.isTwolala ? 1 : 0;
            player.titles += match.stage === Stage.Finals ? 1 : 0;
            if (underdogVictory) {
              player.underdogVictory += 1;
            }
          } else {
            player.score += loserScore;
            player.scoreByTournament[id] += loserScore;
            if (underdogVictory) {
              player.topdogDefeat += 1;
            }
          }
        });
      });
    });

    participants.forEach((nickname) => {
      players[nickname].participation++;
    });

    Object.values(players)
      .filter(
        (player) =>
          player.position >= 1 &&
          player.position <= 4 &&
          !participants.has(player.nickname)
      )
      .forEach((player) => {
        player.score -= 1;
        player.scoreByTournament[id] -= 1;
        console.log(
          `-1 para ${player.nickname} pois faltou na rodada ${id} enquanto estava no Top 4 (posição ${player.position})`
        );
      });

    // SCORE VALIDATION
    Object.values(players).forEach((player) => {
      const tournamentScoreSum = Object.values(player.scoreByTournament).reduce(
        (acc, score) => {
          return acc + score;
        },
        0
      );

      if (tournamentScoreSum !== player.score) {
        throw new Error(
          `A soma dos scores por torneio (${tournamentScoreSum}) de ${player.nickname} não bate com o score total (${player.score})`
        );
      }
    });

    leaderboard = Object.values(players)
      // Desative o filtro para verificar se tá tudo certo
      // A segunda parte da condição serve para incluir MCs que tinham 1 ponto e
      // perderam pela regra da vitória do desfavorecido
      // .filter(
      //   (player) => player.score > 0 || prevPlayers[player.nickname].score > 0
      // )
      .sort(function comparePlayers(a: Player, b: Player) {
        if (a.score != b.score) {
          return b.score - a.score;
        } else if (a.titles != b.titles) {
          return b.titles - a.titles;
        } else if (a.twolala != b.twolala) {
          return b.twolala - a.twolala;
        } else if (a.participation != b.participation) {
          return a.participation - b.participation;
        } else {
          return 0;
        }
      })
      .map((player, index) => {
        player.position = index + 1;
        return player;
      });

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = `Placar ${id.padStart(2, "0")}`;
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      ss.getSheetByName("Placar")!.copyTo(ss).setName(sheetName);
    }
    sheet = ss.getSheetByName(sheetName)!;

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
      const prevPosition = prevPlayers[player.nickname].position;
      const positionDelta = Math.abs(player.position - prevPosition);
      if (prevPosition === 0) {
        if (player.score > 0) {
          positionDeltaText = `▲`;
        } else {
          positionDeltaText = "";
        }
      } else if (player.position < prevPosition) {
        positionDeltaText = `▲ ${positionDelta}`;
      } else if (player.position > prevPosition) {
        positionDeltaText = `▼ ${positionDelta}`;
      }

      range.setValues([
        [
          player.position,
          player.nickname,
          positionDeltaText,
          scoreDeltaText,
          player.score,
          player.twolala ? player.twolala : "",
          player.participation,
          "🏆".repeat(player.titles),
        ],
      ]);
    });

    prevPlayers = JSON.parse(JSON.stringify(players));
  });

  addClarifications(matchScoreClarifications, MATCHES_SHEET);

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Histórico");
  if (!sheet) {
    throw new Error(`Planilha "Histórico" não encontrada`);
  }

  sheet.getRange(4, 1, 100, 15).clearContent();

  leaderboard.map((player, index) => {
    const range = sheet.getRange(index + 4, 1, 1, 15);

    const f = (p: Player, tournamentId: string) => {
      const scoreDelta = p.scoreByTournament[tournamentId];
      let scoreDeltaText = "";
      if (scoreDelta > 0) {
        scoreDeltaText = `+${scoreDelta}`;
      } else if (scoreDelta < 0) {
        scoreDeltaText = scoreDelta.toString(); // comes with minus sign
      }

      return scoreDeltaText;
    };

    range.setValues([
      [
        player.position,
        player.nickname,
        player.score,
        f(player, "1"),
        f(player, "2"),
        f(player, "3"),
        f(player, "4"),
        f(player, "5"),
        f(player, "6"),
        f(player, "7"),
        f(player, "8"),
        f(player, "9"),
        f(player, "10"),
        player.underdogVictory ? player.underdogVictory : "",
        player.topdogDefeat ? player.topdogDefeat : "",
      ],
    ]);
  });

  // const statsSheet = ss.getSheetByName("Análise");
  // if (!statsSheet) {
  //   throw new Error(`Planilha "Análise" não encontrada`);
  // }

  // const participations: number[] = [];
  // statsSheet
  //   .getRange(2, 1, 100, 1)
  //   .getValues()
  //   .forEach((row, index) => {
  //     if (row[0] === "") {
  //       return;
  //     } else if (!(row[0] in players)) {
  //       participations.push(0);
  //     } else {
  //       participations.push(players[row[0]].participation);
  //     }
  //   });

  // statsSheet
  //   .getRange(2, 3, participations.length, 1)
  //   .clearContent()
  //   .setValues(participations.map((p) => [p]));
}

function calculateMatchScore(
  match: Match,
  lastTournamentScores: Record<string, Pick<Player, "score">>,
  currTournamentScores: Record<string, Pick<Player, "score">>,
  verbose: boolean = false
): {
  winnerScore: number;
  loserScore: number;
  clarification: string;
  underdogVictory: boolean;
} {
  let clarification = `${match.tournamentId}ª Rodada - ${
    match.id + 1
  }ª Batalha da Temporada\n\n`;
  clarification += `${match.raw} (${match.stage})\n`;
  clarification += "\n";

  const winners = match.winners.join(" e ");
  const losers = match.losers.join(" e ");

  let winnerScore = 0;
  if (match.stage === Stage.Unknown) {
    throw new Error(
      `Não foi possível calcular o score da batalha "${match.raw}" pois a fase "${match.stage}" é desconhecida.`
    );
  } else if (match.stage === Stage.EightFinals) {
    winnerScore += 1;
    clarification += `${winners}: +1\n`;
  } else {
    winnerScore += 2;
    clarification += `${winners}: +2\n`;
  }

  if (match.isTwolala) {
    winnerScore += 1;
    clarification += `${winners}: +1 (twolala)\n`;
  }

  let loserScore = 0;

  // if (match.mode === "Duo") {
  //   winnerScore = Math.ceil(winnerScore / 2);
  //   clarification += `\nBatalha de Dupla: Pontuação dividida por 2 e arredondada para cima\n`;
  // }

  let underdogVictory = false;
  if (match.mode === "Solo" && !match.isWO) {
    const winnerRating = lastTournamentScores[match.winners[0]].score;
    const loserRating = lastTournamentScores[match.losers[0]].score;
    if (winnerRating < loserRating) {
      winnerScore += 1;
      loserScore -= 1;

      clarification += `\nVitória do desfavorecido: ${winners} rouba 1 ponto de ${losers}\n`;
      underdogVictory = true;
    }
  }

  clarification += "\n";
  clarification += `Pontuação final:\n`;

  match.winners.forEach((winner) => {
    const prevScore = currTournamentScores[winner].score;
    const currScore = prevScore + winnerScore;
    clarification += `${winner}: ${prevScore} -> ${currScore} (+${winnerScore})\n`;
  });

  if (loserScore) {
    match.losers.forEach((loser) => {
      const prevScore = currTournamentScores[loser].score;
      const currScore = prevScore + loserScore;
      clarification += `${loser}: ${prevScore} -> ${currScore} (${loserScore})\n`;
    });
  }

  clarification = clarification.slice(0, -1); // remove last newline

  if (verbose) {
    console.log(clarification);
  }

  return {
    winnerScore,
    loserScore,
    clarification,
    underdogVictory,
  };
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
