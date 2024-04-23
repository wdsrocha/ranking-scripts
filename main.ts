function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu("Ações")
    .addItem("Atualizar Estatísticas", "updateStats")
    .addItem("Gerar Estatísticas em JSON", "download")
    .addItem("Adicionar Batalha", "showForm")
    .addToUi();
}

enum Stage {
  Unknown = "Desconhecido",
  EightFinals = "Oitavas de Final",
  QuarterFinals = "Quartas de Final",
  SemiFinals = "Semifinal",
  Finals = "Final",
}

function getTeamsFromMatchResults(data: string): Team[] {
  data = data.replace(/\./g, "").trim();
  const isWO = data.includes("(WO)");
  data = data.replace(/\([^()]*\)/g, "").trim();

  if (!data.includes(" x ") && isWO) {
    // Cases where there was not sufficient MCs or something, so the match was
    // marked as WO, but we don't know who was supposed to be the opponent
    return [
      {
        players: data.replace(/\, /g, " e ").split(" e "),
        roundsWon: 0,
      },
    ];
  }

  // Scoreless
  // E.g.: Blink e Killer* x Kenny e Kennyzin
  //       Onec x Jhones*
  if (data.includes("*")) {
    return data.split(" x ").map((team) => ({
      // players: team.replace("*", "").split(" e "),
      players: team
        .replace("*", "")
        .split(", ") // Handle trio
        .join(" e ") // Handle trio
        .split(" e ")
        .map((s) => s.trim()),
      roundsWon: team.includes("*") ? 1 : 0,
    }));
  }

  // With score, no double-three
  // E.g.: RK 2 x 0 Big Xang
  //       Eva e Isa 2 x 1 Mont e Onec
  if (/ \d\s?x\s?\d /.test(data)) {
    const [full, roundsWon1, roundsWon2] = / (\d)\s?x\s?(\d) /.exec(data) || [];
    // Use the extracted groups in your code
    const roundsResult = [roundsWon1, roundsWon2];

    return data.split(full!).map((team, i) => ({
      players: team
        .split(", ") // Handle trio
        .join(" e ") // Handle trio
        .split(" e ")
        .map((s) => s.trim()),
      roundsWon: parseInt(roundsResult[i]),
    }));
  }

  // With score, double-three
  if (data.split(" x ").length === 3) {
    const results = data.split(" x ");

    return results.map((p, i) => ({
      players: [p.slice(0, p.length - 1).trim()],
      roundsWon: parseInt(p.slice(-1)),
    }));
  }

  throw new Error(`A batalha "${data}" está em formato inválido`);
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
    .slice(1)
    // .filter((row) => row[0].getMonth() === 2) // 0-indexed
    .map((row) => {
      const teams = getTeamsFromMatchResults(row[3]);
      return {
        date: row[0],
        host: row[1],
        stage: row[2],
        raw: row[3],
        teams,
        isWO: row[3].includes("(WO)"),
        tournamentId: getTournamentId(row[0], row[1]),
        winners: getWinners({ teams } as Match),
        losers: getLosers({ teams } as Match),
      };
    });

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
    .getRange(2, 1, sheet.getDataRange().getLastRow() - 1, 6)
    .getValues()
    .map((row) => {
      const team = getTeamsFromMatchResults(row[3]);
      const winners = getWinners({ teams: team } as Match);
      const losers = getLosers({ teams: team } as Match);
      return [
        row[0],
        row[1],
        row[2],
        row[3],
        playersToString(winners),
        playersToString(losers),
      ];
    });
  sheet
    .getRange(2, 1, sheet.getDataRange().getLastRow() - 1, 6)
    .setValues(values);
}

function j(d: any) {
  return JSON.stringify(d, null, "--");
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

function download() {
  const html = HtmlService.createHtmlOutputFromFile("index");
  SpreadsheetApp.getUi().showModalDialog(html, "Baixar estatísticas");
}

function downloadFile() {
  // const obj = generateStats();
  const obj = {};

  const filename = "data.json";
  const blob = Utilities.newBlob(
    JSON.stringify(obj),
    "application/json",
    filename
  );
  return {
    data: `data:application/json;base64,${Utilities.base64Encode(
      blob.getBytes()
    )}`,
    filename: filename,
  };
}
