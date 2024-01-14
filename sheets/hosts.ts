function reloadHostSheet(
  sheet: GoogleAppsScript.Spreadsheet.Sheet,
  matches: Match[]
) {
  const headers = ["Organização", "Edições"];

  const table = Object.entries(
    matches.reduce<Record<string, number>>((table, match) => {
      if (match.stage !== Stage.Finals) {
        return table;
      }

      if (!(match.host in table)) {
        table[match.host] = 0;
      }

      table[match.host]++;

      return table;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

  if (headers.length !== table[0].length) {
    throw new Error(`Headers length does not match table number of columns on sheet "Hosts".
          headers.length => ${headers.length}
          table[0].length => ${table[0].length}`);
  }

  sheet.clear();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(2, 1, table.length, headers.length).setValues(table);
}
