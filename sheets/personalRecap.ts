function reloadPersonalRecapSheet(
  sheet: GoogleAppsScript.Spreadsheet.Sheet,
  matches: Match[],
  nickname: string
) {
  const players: Record<string, PlayerData> = {};

  matches.forEach((match) => {
    // Create players that didn't exist before
    match.teams.forEach((team) => {
      team.players.forEach((nickname) => {
        if (!(norm(nickname) in players)) {
          players[norm(nickname)] = {
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

        players[norm(nickname)].matches.push(match);

        // THIS WILL HAVE DUPLICATES!!!
        players[norm(nickname)].tournamentIds.push(getTournamentId(match));
      });
    });

    const winners = getWinners(match);

    winners.forEach((winner) => {
      const p = players[norm(winner)];
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
    ["Edições", countTournaments],
    ["Batalhas", (p) => p.matches.length],
    ["Folhinhas", (p) => p.titles],
    [
      "Vice",
      (p) =>
        p.matches.filter((match) => match.stage === Stage.Finals).length -
        p.titles,
    ],
    [
      "Finais",
      (p) => p.matches.filter((match) => match.stage === Stage.Finals).length,
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
    .filter((player) => norm(player.nickname) === norm(nickname))
    .map((player) => tableDefinitions.map(([header, f]) => f(player)));

  sheet.clearFormats();
  sheet.clearContents();

  sheet
    .getRange(1, 1, tableDefinitions.length, 1)
    .setValues(tableDefinitions.map(([header]) => [header]))
    .setFontWeight("bold")
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle")
    .setWrap(true);

  sheet
    .getRange(1, 2, tableDefinitions.length, 1)
    .setValues(
      tableDefinitions.map(([header, f]) => [f(players[norm(nickname)])])
    );
}
