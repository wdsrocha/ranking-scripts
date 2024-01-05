interface Stats {
  matches: Match[];
  aWins: number;
  bWins: number;
}
function reloadExtraSheet(
  sheet: GoogleAppsScript.Spreadsheet.Sheet,
  matches: Match[]
) {
  const stats: Record<string, Stats> = {};
  matches.forEach((match) => {
    for (let i = 0; i < match.teams.length; i++) {
      match.teams[i].players.forEach((a) => {
        for (let j = i + 1; j < match.teams.length; j++) {
          match.teams[j].players.forEach((b) => {
            const [u, v] = [norm(a), norm(b)].sort();
            const key = [u, v].join(" x ");
            if (!(key in stats)) {
              stats[key] = {
                matches: [],
                aWins: 0,
                bWins: 0,
              };
            }
            stats[key].matches.push(match);

            if (getWinners(match).map(norm).includes(norm(u))) {
              stats[key].aWins++;
            }

            if (getWinners(match).map(norm).includes(norm(v))) {
              stats[key].bWins++;
            }
          });
        }
      });
    }
  });

  const headers = ["Batalha", "Qtd", "Diff"];

  const table = Object.entries(stats).map(([key, stats]) => {
    const [a, b] = key.split(" x ");
    return [
      `${a} (${stats.aWins}) x (${stats.bWins}) ${b}`,
      stats.matches.length,
      Math.abs(stats.aWins - stats.bWins),
    ];
  });

  if (headers.length !== table[0].length) {
    throw new Error(`Headers length does not match table number of columns on sheet "MCs".
        headers.length => ${headers.length}
        table[0].length => ${table[0].length}`);
  }

  sheet.clear();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(2, 1, table.length, headers.length).setValues(table);
}
