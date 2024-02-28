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
}

function calculateMatchScore(
  match: Match,
  lastTournamentScores: Record<string, Pick<Player, "score">>,
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
      `Não foi possível calcular o score da batalha "${match.raw}" pois a fase "${match.stage}" é desconhecida.`
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
