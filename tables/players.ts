interface PlayerData extends Player {
  // totalMatches: number | equivalent to totalMatches => matches.length
  totalWins: number;
  soloWins: number;
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
    });
  });

  sheet.clear();

  const headers = ["Vulgo", "Batalhas", "Vitórias (total)", "Vitórias (solo)"];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  const playerTable = Object.values(players).map((player) => [
    player.nickname,
    player.matches.length,
    player.totalWins,
    player.soloWins,
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
