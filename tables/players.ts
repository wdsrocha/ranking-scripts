interface PlayerData extends Player {
  // totalMatches: number | equivalent to totalMatches => matches.length
  totalWins: number;
  soloWins: number;
  titles: number; // folhinhas
  winRate: number;
}

function reloadPlayerSheet(
  sheet: GoogleAppsScript.Spreadsheet.Sheet,
  matches: Match[]
) {
  const players: Record<string, PlayerData> = {};

  matches.forEach((match) => {
    // Create players that didn't exist before
    match.teams.forEach((team) => {
      team.players.forEach((nickname) => {
        if (!(nickname in players)) {
          players[nickname] = {
            nickname,
            matches: [],
            totalWins: 0,
            soloWins: 0,
            titles: 0,
            winRate: 0,
          };
        }

        players[nickname].matches.push(match);
      });
    });

    const winners = getWinners(match);

    winners.forEach((winner) => {
      players[winner].totalWins++;
      if (winners.length === 1) {
        players[winner].soloWins++;
      }
      if (match.stage === Stage.Finals) {
        players[winner].titles++;
      }
    });
  });

  sheet.clearContents();

  const headers = [
    "Vulgo",
    "Batalhas",
    "Folhinhas",
    "Vitórias (total)",
    "Vitórias (solo)",
    "Taxa de Vitórias",
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  const playerTable = Object.values(players)
    .map((player) => ({
      ...player,
      winRate: player.totalWins / player.matches.length,
    }))
    .sort((a, b) => {
      if (a.titles !== b.titles) {
        return b.titles - a.titles;
      } else if (a.totalWins !== b.totalWins) {
        return b.totalWins - a.totalWins;
      } else if (a.soloWins !== b.soloWins) {
        return b.soloWins - a.soloWins;
      } else if (a.matches.length !== b.matches.length) {
        return b.matches.length - a.matches.length;
      } else {
        return a.nickname.localeCompare(b.nickname);
      }
    })
    .map((player) => [
      player.nickname,
      player.matches.length,
      player.titles,
      player.totalWins,
      player.soloWins,
      player.winRate,
    ]);

  if (headers.length !== playerTable[0].length) {
    throw new Error(`Headers length does not match playerTable number of columns on sheet "MCs".
      headers.length => ${headers.length}
      playerTable[0].length => ${playerTable[0].length}`);
  }

  sheet
    .getRange(2, 1, playerTable.length, headers.length)
    .setValues(playerTable);
}
