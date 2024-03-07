function groupMatchesByTournament(matches: Match[]): Record<string, Match[]> {
  return matches.reduce<Record<string, Match[]>>((prev, curr) => {
    const id = getTournamentId(curr);
    if (!(id in prev)) {
      prev[id] = [];
    }
    prev[id].push(curr);
    return prev;
  }, {});
}

function reloadTournamentSheet(
  sheet: GoogleAppsScript.Spreadsheet.Sheet,
  matches: Match[]
) {
  const tournaments = matches.reduce<Record<string, Tournament>>(
    (prev, match) => {
      const id = getTournamentId(match);
      if (!(id in prev)) {
        prev[id] = {
          id,
          date: match.date,
          host: match.host,
          champions: [],
          runnersUp: [],
          matches: [],
        };
      }
      prev[id].matches.push(match);

      if (match.stage === Stage.Finals) {
        prev[id].champions = getWinners(match);
        prev[id].runnersUp = getLosers(match);
      }

      return prev;
    },
    {}
  );

  const tableDefinitions: [
    string,
    (x: Tournament) => string | number,
    ((range: GoogleAppsScript.Spreadsheet.Range) => void)?
  ][] = [
    ["Data", (x) => x.date],
    ["Organização", (x) => x.host],
    ["Campeões", (x) => playersToString(x.champions)],
    ["Vices", (x) => playersToString(x.runnersUp)],
  ];

  const tournamentTable = Object.values(tournaments).map((tournament) =>
    tableDefinitions.map(([header, f]) => f(tournament))
  );

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
    .getRange(2, 1, tournamentTable.length, tableDefinitions.length)
    .setValues(tournamentTable);

  tableDefinitions.forEach(([_, __, apply], index) => {
    const range = sheet.getRange(1, index + 1, sheet.getLastRow() - 1, 1);
    apply?.(range);
  });
}
