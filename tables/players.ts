interface PlayerData extends Player {
  // totalMatches: number | equivalent to totalMatches => matches.length
  totalWins: number;
  soloWins: number;
  titles: number; // folhinhas
  soloTitles: number;
  winRate: number;
  tournamentIds: string[]; // tournament key `${date} | ${host}`
}

function asKey(nickname: string) {
  return nickname.toLocaleLowerCase().trim();
}

function getTournamentId(match: Match) {
  return `${match.date} | ${match.host}`;
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
        if (!(asKey(nickname) in players)) {
          players[asKey(nickname)] = {
            nickname,
            matches: [],
            totalWins: 0,
            soloWins: 0,
            titles: 0,
            soloTitles: 0,
            winRate: 0,
            tournamentIds: [],
          };
        }

        players[asKey(nickname)].matches.push(match);

        // THIS WILL HAVE DUPLICATES!!!
        console.log(getTournamentId(match));
        players[asKey(nickname)].tournamentIds.push(getTournamentId(match));
      });
    });

    const winners = getWinners(match);

    winners.forEach((winner) => {
      const p = players[asKey(winner)];
      p.totalWins++;
      if (match.stage === Stage.Finals) {
        p.titles++;
      }

      if (winners.length === 1) {
        p.soloWins++;
        if (match.stage === Stage.Finals) {
          p.soloTitles++;
        }
      }
    });
  });

  sheet.clearContents();

  const headers = [
    "Vulgo",
    "Batalhas",
    "Folhinhas (total)",
    "Folhinhas (solo)",
    "Vitórias (total)",
    "Vitórias (solo)",
    "Taxa de Vitórias",
    "Edições Participadas",
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
      } else if (a.soloTitles !== b.soloTitles) {
        return b.soloTitles - a.soloTitles;
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
      player.soloTitles,
      player.totalWins,
      player.soloWins,
      player.winRate,
      new Set(player.tournamentIds).size,
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
