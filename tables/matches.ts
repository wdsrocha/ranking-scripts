function reloadMatchSheet(
  sheet: GoogleAppsScript.Spreadsheet.Sheet,
  matches: Match[]
) {
  sheet.clear();

  const headers = [
    "Data",
    "Organização",
    "Fase",
    "Batalha",
    "Vencedor(es)",
    "Perdedor(es)",
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  const matchTable = matches.map((match) => [
    match.date,
    match.host,
    match.stage,
    match.raw,
    getWinners(match).join(" e "),
    getLosers(match).join(" e "),
  ]);

  if (headers.length !== matchTable[0].length) {
    throw new Error(`Headers length does not match matchTable number of columns on sheet "MCs".
        headers.length => ${headers.length}
        matchTable[0].length => ${matchTable[0].length}`);
  }

  const range = sheet.getRange(2, 1, matches.length, headers.length);
  range.setValues(matchTable);
}
