enum Delta {
  NONE = "",
  UP = "▲",
  DOWN = "▼",
}

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
  const matches = readMatches("Batalhas S2");

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

  let prevPlayers: Record<string, Player> = JSON.parse(JSON.stringify(players));
  const matchScoreClarifications: MatchScoreClarification[] = [];
  Object.entries(matchesByTournament).forEach(([id, matches]) => {
    const hasPlayerParticipated: Record<string, boolean> = {};
    matches.forEach((match) => {
      const { winnerScore, loserScore, clarification } = calculateMatchScore(
        match,
        prevPlayers,
        players
        // true
      );
      matchScoreClarifications.push({ matchId: match.id, clarification });

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
      .sort(function comparePlayers(a: Player, b: Player) {
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

  annotateClarifications(matchScoreClarifications, "Batalhas S2");
}

function calculateMatchScore(
  match: Match,
  lastTournamentScores: Record<string, Pick<Player, "score">>,
  currTournamentScores: Record<string, Pick<Player, "score">>,
  verbose: boolean = false
): { winnerScore: number; loserScore: number; clarification: string } {
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

  if (match.mode === "Duo") {
    winnerScore = Math.ceil(winnerScore / 2);
    clarification += `\nBatalha de Dupla: Pontuação dividida por 2 e arredondada para cima\n`;
  }

  if (match.mode === "Solo" && !match.isWO) {
    const winnerRating = lastTournamentScores[match.winners[0]].score;
    const loserRating = lastTournamentScores[match.losers[0]].score;
    if (winnerRating < loserRating) {
      winnerScore += 1;
      loserScore -= 1;

      clarification += `\nVitória do desfavorecido: ${winners} rouba 1 ponto de ${losers}\n`;
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
