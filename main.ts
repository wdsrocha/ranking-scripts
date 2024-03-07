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
  data = data.replace(".", "").trim();
  const isWO = data.includes("(WO)");
  data = data.replace(/\([^()]*\)/g, "").trim();

  if (!data.includes(" x ")) {
    // Cases where there was not sufficient MCs or something, so the match was
    // marked as WO, but we don't know who was supposed to be the opponent
    if (isWO) {
      return [
        {
          players: data.replace(", ", " e ").split(" e "),
          roundsWon: 0,
        },
      ];
    } else {
      throw new Error(
        `A batalha "${data}" não contém um ' x '. Não é possível determinar os times.`
      );
    }
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
  if (match.isWO) {
    return [];
  }

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
    .filter((row) => row[0].getMonth() === 1)
    .map((row) => ({
      date: row[0],
      host: row[1],
      stage: row[2],
      raw: row[3],
      teams: getTeamsFromMatchResults(row[3]),
      isWO: row[3].includes("(WO)"),
    }));

  reloadPlayerSheet(ss.getSheetByName("MCs (fevereiro)")!, matches);
  reloadTournamentSheet(ss.getSheetByName("Edições (fevereiro)")!, matches);
  // reloadHostSheet(ss.getSheetByName("Organizações")!, matches);
}

function AUX(data: any[][]) {
  const matches: Match[] = data.map((row) => ({
    date: row[0],
    host: row[1],
    stage: row[2],
    raw: row[3],
    teams: getTeamsFromMatchResults(row[3]),
    isWO: row[3].includes("(WO)"),
  }));

  return getFurthestStage(matches);
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

function WINNERS(input: string) {
  const winners = getWinners({
    teams: getTeamsFromMatchResults(input),
    raw: "",
    host: "",
    date: "",
    stage: Stage.Unknown,
  });
  return printTeam({ players: winners, roundsWon: 0 });
}

function LOSERS(input: string) {
  const losers = getLosers({
    teams: getTeamsFromMatchResults(input),
    raw: "",
    host: "",
    date: "",
    stage: Stage.Unknown,
  });
  return printTeam({ players: losers, roundsWon: 0 });
}
