function groupMatchesByTournament(matches: Match[]): Record<string, Match[]> {
  return matches.reduce<Record<string, Match[]>>((prev, curr) => {
    const id = curr.tournamentId;
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
  const tournamentById = matches.reduce<Record<string, Tournament>>(
    (prev, match) => {
      const id = match.tournamentId;
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

  const values = sheet
    .getRange(2, 1, sheet.getLastRow() - 1, 4)
    .getValues()
    .map((row, index) => {
      const id = getTournamentId(row[0], row[1]);
      if (!(id in tournamentById)) {
        return [row[0], row[1], row[2], row[3]];
      }

      const champions = playersToString(tournamentById[id].champions);
      const runnersUp = playersToString(tournamentById[id].runnersUp);

      return [row[0], row[1], champions, runnersUp];
    });

  sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).setValues(values);
}
