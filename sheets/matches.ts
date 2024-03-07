function playersToString(p: string[] | undefined) {
  if (!p) return "";
  if (p.length === 0) return "";
  let s = p[0];
  for (let i = 1; i < p.length; i++) {
    s += i < p.length - 1 ? `, ${p[i]}` : ` e ${p[i]}`;
  }
  return s;
}

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
    playersToString(getWinners(match)),
    playersToString(getLosers(match)),
  ]);

  if (headers.length !== matchTable[0].length) {
    throw new Error(`Headers length does not match matchTable number of columns on sheet "MCs".
        headers.length => ${headers.length}
        matchTable[0].length => ${matchTable[0].length}`);
  }

  const range = sheet.getRange(2, 1, matches.length, headers.length);
  range.setValues(matchTable);
}
