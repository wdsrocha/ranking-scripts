function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu("Ações")
    .addItem("Atualizar Estatísticas", "updateStats")
    .addToUi();
}

enum Stage {
  Unknown = "Desconhecido",
  EightFinals = "Oitavas de Final",
  QuarterFinals = "Quartas de Final",
  SemiFinals = "Semifinal",
  Finals = "Final",
}

function getMatchResults(row: any[], rowNumber?: number): Match {
  let data = row[3].replace(/\./g, "").trim();
  let match: Match = {
    date: row[0],
    host: row[1],
    stage: row[2],
    raw: row[3],
    isWO: data.includes("(WO)"),
    tournamentId: getTournamentId(row[0], row[1]),
    // Below are default values that will be overwritten
    teams: [],
    winners: [],
    losers: [],
  };

  data = data.replace(/\([^()]*\)/g, "").trim();

  if (!data.includes(" x ") && match.isWO) {
    // Cases where there was not sufficient MCs or something, so the match was
    // marked as WO, but we don't know who was supposed to be the opponent
    match.teams = [
      {
        players: data.replace(/\, /g, " e ").split(" e "),
        roundsWon: 0,
      },
    ];
  } else if (data.includes("*")) {
    // Scoreless
    // E.g.: Blink e Killer* x Kenny e Kennyzin
    //       Onec x Jhones*
    match.teams = data.split(" x ").map((team) => ({
      // players: team.replace("*", "").split(" e "),
      players: team
        .replace("*", "")
        .split(", ") // Handle trio
        .join(" e ") // Handle trio
        .split(" e ")
        .map((s) => s.trim()),
      roundsWon: team.includes("*") ? 1 : 0,
    }));
  } else if (/ \d\s?x\s?\d /.test(data)) {
    // With score, no double-three
    // E.g.: RK 2 x 0 Big Xang
    //       Eva e Isa 2 x 1 Mont e Onec
    const [full, roundsWon1, roundsWon2] = / (\d)\s?x\s?(\d) /.exec(data) || [];
    // Use the extracted groups in your code
    const roundsResult = [roundsWon1, roundsWon2];

    match.teams = data.split(full!).map((team, i) => ({
      players: team
        .split(", ") // Handle trio
        .join(" e ") // Handle trio
        .split(" e ")
        .map((s) => s.trim()),
      roundsWon: parseInt(roundsResult[i]),
    }));
  } else if (data.split(" x ").length === 3) {
    // With score, double-three
    const results = data.split(" x ");

    match.teams = results.map((p, i) => ({
      players: [p.slice(0, p.length - 1).trim()],
      roundsWon: parseInt(p.slice(-1)),
    }));
  } else {
    let errorMessage = `A batalha "${data}" está em formato inválido`;
    if (rowNumber) {
      errorMessage += ` na linha ${rowNumber}`;
    }
    throw new Error(errorMessage);
  }

  match.winners = getWinners(match);
  const oldWinners = getWinners_DEPRECATED(match);
  if (match.winners.sort().join(", ") !== oldWinners.sort().join(", ")) {
    console.log(
      `Winners mismatch on match "${match.raw}". New approach: ${match.winners}, old approach: ${oldWinners}`
    );
  }
  match.losers = getLosers(match);

  return match;
}

function toStage(rawStage: string): Stage {
  rawStage = rawStage.toLocaleLowerCase();
  if (rawStage === "primeira fase") {
    return Stage.EightFinals;
  } else if (rawStage === "segunda fase") {
    return Stage.QuarterFinals;
  } else if (
    rawStage === "semifinal" ||
    rawStage === "semi final" ||
    rawStage === "semifinais"
  ) {
    return Stage.SemiFinals;
  } else if (rawStage === "final") {
    return Stage.Finals;
  } else {
    return Stage.Unknown;
  }
}

function getWinners(match: Match): string[] {
  const maxRoundsWon = Math.max(...match.teams.map((team) => team.roundsWon));
  const minRoundsWon = Math.min(...match.teams.map((team) => team.roundsWon));
  return maxRoundsWon === minRoundsWon && !match.isWO
    ? []
    : match.teams
        .filter((team) => team.roundsWon === maxRoundsWon)
        .flatMap((team) => team.players);
}

function getWinners_DEPRECATED(match: Match): string[] {
  return match.teams.reduce((prev, curr) => {
    // Assuming draws will never happen...
    return curr.roundsWon > prev.roundsWon ? curr : prev;
  }, match.teams[0]).players;
}

// Many teams can lose at the same time. For the sake of simplicity, this
// functions returns a single team of all losers
function getLosers(match: Match): string[] {
  const losers: string[] = [];
  const maxRoundsWon = Math.max(...match.teams.map((team) => team.roundsWon));
  match.teams.forEach((team) => {
    if (team.roundsWon < maxRoundsWon) {
      losers.push(...team.players);
    }
  });
  return losers;
}

function isSoloMatch(match: Match): boolean {
  return match.teams.every((team) => team.players.length === 1);
}

function isDoubleThreeMatch(match: Match): boolean {
  return (
    match.teams.length === 3 &&
    match.teams.every((team) => team.players.length === 1)
  );
}

function isDuoMatch(match: Match): boolean {
  return match.teams.every((team) => team.players.length === 2);
}

function isTrioMatch(match: Match): boolean {
  return match.teams.every((team) => team.players.length === 3);
}

function isQuartetMatch(match: Match): boolean {
  return match.teams.every((team) => team.players.length === 4);
}

function getTeamMode(match: Match): string {
  if (isDoubleThreeMatch(match)) {
    return "Double-Three";
  } else if (isSoloMatch(match)) {
    return "Solo";
  } else if (isDuoMatch(match)) {
    return "Dupla";
  } else if (isTrioMatch(match)) {
    return "Trio";
  } else if (isQuartetMatch(match)) {
    return "Quarteto";
  } else {
    return "Desconhecido";
  }
}

function isTwolala(match: Match): boolean {
  if (match.isWO || !isSoloMatch(match)) {
    return false;
  }

  const totalRounds = match.teams.reduce(
    (prev, curr) => prev + curr.roundsWon,
    0
  );

  return totalRounds === 2;
}

function updateStats() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Batalhas")!;
  const data = sheet.getDataRange().getValues();

  const matches: Match[] = data
    .map((row, index) => ({ row, index }))
    .slice(1)
    .filter((x) => x.row[0].getMonth() === 3) // 0-indexed
    .map((x) => getMatchResults(x.row, x.index + 1));

  const tournamentSheet = ss.getSheetByName("Edições");
  if (!tournamentSheet) {
    throw new Error("Sheet 'Edições' not found");
  }

  const tournamentData = tournamentSheet.getDataRange().getValues();
  const tournaments: Tournament[] = tournamentData.slice(1).map((row) => ({
    id: getTournamentId(row[0], row[1]),
    date: row[0],
    host: row[1],
    champions: row[2],
    runnersUp: row[3],
    matches: [],
    isMissingMatches: row.find((cell) => cell === "FALTA") !== undefined,
  }));

  const warnings: string[] = [];
  // Appears on Tournament Sheet but not on Match Sheet
  for (const tournament of tournaments.filter((t) => !t.isMissingMatches)) {
    const found = matches.find((match) => match.tournamentId === tournament.id);
    if (!found) {
      warnings.push(`${tournament.id.padEnd(50)} | Batalhas ❌ | Edições ✅`);
    }
  }

  // Appears on Matches Sheet but not on Tournament Sheet
  const tournamentIdsFromMatches = Array.from(
    new Set(matches.map((match) => match.tournamentId))
  ).sort();
  for (const id of tournamentIdsFromMatches) {
    const found = tournaments.find((tournament) => id === tournament.id);
    if (!found) {
      warnings.push(`${id.padEnd(50)} | Batalhas ✅ | Edições ❌`);
    }
  }

  console.log(warnings.sort().join("\n"));

  reloadPlayerSheet(ss.getSheetByName("MCs")!, matches);
  reloadTournamentSheet(ss.getSheetByName("Edições")!, matches);
  reloadHostSheet(ss.getSheetByName("Organizações")!, matches);

  const values = sheet
    .getRange(2, 1, sheet.getDataRange().getLastRow() - 1, 4)
    .getValues()
    .map((row) => {
      const match = getMatchResults(row);
      return [
        row[0],
        row[1],
        row[2],
        row[3],
        playersToString(match.winners),
        playersToString(match.losers),
        getTeamMode(match),
        isTwolala(match) ? "Twolala" : "",
        match.isWO ? "WO" : "",
        [
          "Janeiro",
          "Fevereiro",
          "Março",
          "Abril",
          "Maio",
          "Junho",
          "Julho",
          "Agosto",
          "Setembro",
          "Outubro",
          "Novembro",
          "Dezembro",
        ][row[0].getMonth()],
      ];
    });
  sheet
    .getRange(2, 1, sheet.getDataRange().getLastRow() - 1, 10)
    .setValues(values);
}

function printTeam(team: Team): string {
  if (team.players.length === 1) {
    return team.players[0];
  }

  const last = team.players.pop();
  return `${team.players.join(", ")} e ${last}`;
}

function printMatch(match: Match): string {
  return match.teams
    .map((team) => `${team.players.join(" e ")} (${team.roundsWon})`)
    .join(" x ");
}
