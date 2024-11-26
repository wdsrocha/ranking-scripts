function reloadJudgesSheet(
  sheet: GoogleAppsScript.Spreadsheet.Sheet,
  matches: Match[]
) {
  const judges: Record<string, JudgeData> = {};

  matches.forEach((match) => {
    // Create players that didn't exist before
    match.judges.forEach((nickname) => {
      if (!(norm(nickname) in judges)) {
        judges[norm(nickname)] = {
          nickname,
          participationCount: 0,
        };
      }

      judges[norm(nickname)].participationCount++;
    });
  });

  const tableDefinitions: [
    string,
    (p: JudgeData) => string | number,
    ((range: GoogleAppsScript.Spreadsheet.Range) => void)?
  ][] = [
    ["Vulgo", (p) => p.nickname],
    ["Participações", (p) => p.participationCount],
  ];

  const judgeTable = Object.values(judges)
    .sort((a, b) => {
      if (a.participationCount !== b.participationCount) {
        return b.participationCount - a.participationCount;
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
    .getRange(2, 1, judgeTable.length, tableDefinitions.length)
    .setValues(judgeTable);

  tableDefinitions.forEach(([_, __, apply], index) => {
    const range = sheet.getRange(1, index + 1, sheet.getLastRow() - 1, 1);
    apply?.(range);
  });
}
