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

  type P = PlayerData;

  const countTournaments = (player: PlayerData) =>
    new Set(player.matches.map(getTournamentId)).size;

  const tableDefinitions: [
    string,
    (p: P) => string | number,
    ((range: GoogleAppsScript.Spreadsheet.Range) => void)?
  ][] = [
    ["Vulgo", (p) => p.nickname],
    ["Edições", countTournaments, (range) => range.createFilter()],
    ["Batalhas", (p) => p.matches.length],
    ["Folhinhas", (p) => p.titles],
    [
      "Vice",
      (p) =>
        p.matches.filter((match) => match.stage === Stage.Finals).length -
        p.titles,
    ],
    ["Vitórias", (p) => p.totalWins],
    ["Derrotas", (p) => p.matches.length - p.totalWins],
    [
      "Vitórias / Batalhas",
      (p) => (p.matches.length ? p.totalWins / p.matches.length : 0),
      (range) => range.setNumberFormat("00.00%"),
    ],
    [
      "Folhinhas / Edições",
      (p) => (countTournaments(p) ? p.titles / countTournaments(p) : 0),
      (range) => range.setNumberFormat("00.00%"),
    ],
    ["Folhinhas (solo)", (p) => p.soloTitles],
    ["Vitórias (solo)", (p) => p.soloWins],
  ];

  const playerTable = Object.values(players)
    .sort((a, b) => {
      if (a.titles !== b.titles) {
        return b.titles - a.titles;
        //   } else if (a.soloTitles !== b.soloTitles) {
        //     return b.soloTitles - a.soloTitles;
      } else if (a.totalWins !== b.totalWins) {
        return b.totalWins - a.totalWins;
        //   } else if (a.soloWins !== b.soloWins) {
        //     return b.soloWins - a.soloWins;
      } else if (a.matches.length !== b.matches.length) {
        return b.matches.length - a.matches.length;
      } else {
        return a.nickname.localeCompare(b.nickname);
      }
    })
    .map((player) => tableDefinitions.map(([header, f]) => f(player)));

  sheet.clearFormats();
  sheet.clearContents();

  sheet
    .getRange(1, 1, 1, tableDefinitions.length)
    .setValues([tableDefinitions.map(([header]) => header)])
    .setFontWeight("bold")
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle")
    .setWrap(true);

  sheet
    .getRange(2, 1, playerTable.length, tableDefinitions.length)
    .setValues(playerTable);

  tableDefinitions.forEach(([_, __, apply], index) => {
    const range = sheet.getRange(1, index + 1, sheet.getLastRow() - 1, 1);
    apply?.(range);
  });
}
