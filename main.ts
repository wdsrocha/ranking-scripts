function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu("Ações")
    .addItem("Atualizar Batalhas", "execute")
    .addItem("Atualizar Estatísticas", "updateStats")
    .addToUi();
}

interface Team {
  players: string[]; // nickname
  roundsWon: number;
}

interface Match {
  raw: string;
  host: string;
  date: string;
  stage: Stage;
  teams: Team[];
}

interface Player {
  nickname: string;
  matches: Match[];
}

enum Stage {
  Unknown = "Desconhecido",
  EightFinals = "Oitavas de Final",
  QuarterFinals = "Quartas de Final",
  SemiFinals = "Semifinal",
  Finals = "Final",
}

interface Tournament {
  date: string;
  host: string;
  matches: Match[];
}

function getTeamsFromMatchResults(data: string): Team[] {
  if (data.split(" x ").length === 0) {
    throw new Error(`A batalha "${data}" está em formato inválido`);
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

function getMatches(
  data: string[][],
  { host, date }: { host: string; date: string }
) {
  let matches: Match[] = [];

  data.forEach((row, i) => {
    // Empty line. This shouldn't be happening, but some people did it. Oh well.
    if (!row[0] && !row[1]) {
      return;
    }

    const stage = row[0] ? toStage(row[0]) : matches.slice(-1)[0].stage;

    const matchResult = row
      .slice(1)
      .filter((col) => col.length)
      .join(" x ");

    matches.push({
      raw: matchResult,
      date,
      host,
      stage,
      teams: getTeamsFromMatchResults(matchResult),
    });
  });

  if (!matches.map((match) => match.stage).includes(Stage.QuarterFinals)) {
    matches = matches.map((match) => ({
      ...match,
      stage:
        match.stage == Stage.EightFinals ? Stage.QuarterFinals : match.stage,
    }));
  }

  return matches;
}

// Exemplo de uma edição (tournament). Atualmente o código só considera a
// primeira organização e ignora a edição e os modos.
// E.g.:
//       Data          | 27/08/2023 <- Formato de Data no Google Sheets
//       Organização   | Batalha das Minas     | Batalha da La Prata |
//       Edição        | Especial de Halloween |                     |
//                     |                       |                     |
//       Primeira Fase | Barb* x Giza          |                     |
//                     | Pedrina* x Dark       |                     |
//                     | RK* x Atna            |                     |
//                     | Eva* x Jogadora <- Edição com apenas 3 fases,
//                                          mas geralmente é 4
//       Semifinal     | Pedrina* x Barb       |                     |
//                     | RK* x Eva             |                     |
//       Final         | RK* x Pedrina         |                     |
//       Campeão       | RK                    |                     |
function getTournament(data: string[][]): Tournament {
  // const date = new Date(data[0][1]).toISOString();
  const date = data[0][1];
  const host = data[1][1].trim();
  const matches = getMatches(data.slice(4, -1), { host, date });

  return {
    date,
    host,
    matches,
  };
}

function validateTournament(data: string[][]) {
  const errors: string[] = [];
  if (data[0][0] !== "Data") errors.push("Linha 1 deveria ter campo 'Data'");
  if (!data[0][1]) errors.push("Informe a data");
  if (data[1][0] !== "Organização")
    errors.push("Linha 2 deveria ter campo 'Organização'");
  if (!data[1][1]) errors.push("Informe a organização");
  if (data[2][0] !== "Edição")
    errors.push("Linha 3 deveria ter campo 'Edição'");
  if (data[3][0]) errors.push("Linha 4 deveria estar vazia");

  if (
    toStage(data[4][0]) !== Stage.EightFinals &&
    toStage(data[4][0]) !== Stage.SemiFinals
  ) {
    errors.push("Linha 5 deveria iniciar com o resultado das batalhas");
  }

  if (errors.length) {
    throw new Error(errors.join(" | "));
  }
}

function getTournaments(data: string[][]): Tournament[] {
  const tournaments: Tournament[] = [];
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] !== "Data") {
      continue;
    }

    let k = 0;
    // Search until end of current tournament or end of range
    // End of range can mean two things:
    // - User selected the begining of another tournament by mistake
    // - The "Campeao" string is missing for this tournament
    while (i + k < data.length && data[i + k][0] !== "Campeão") {
      k++;
    }

    // Skips on end of range
    if (i + k === data.length) {
      continue;
    }

    const slicedData = data.slice(i, i + k + 1);

    validateTournament(slicedData);

    const tournament = getTournament(slicedData);
    tournaments.push(tournament);
  }
  return tournaments;
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

function readSheets(sheets: GoogleAppsScript.Spreadsheet.Sheet[]) {
  return sheets.flatMap((sheet) =>
    getTournaments(sheet.getDataRange().getValues())
  );
}

function execute() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();

  // First, consider user selected range
  let data = sheet.getActiveRange()?.getValues() as string[][];
  let tournaments = getTournaments(data);

  if (tournaments.length == 0) {
    tournaments = readSheets(
      ss.getSheets().filter((sheet) => sheet.getName().includes("✅"))
    );
  }

  const matches = tournaments.flatMap((tournament) => tournament.matches);

  reloadMatchSheet(ss.getSheetByName("Batalhas")!, matches);
  reloadPlayerSheet(ss.getSheetByName("MCs")!, matches);
  reloadExtraSheet(ss.getSheetByName("Extra")!, matches);
}

function updateStats() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Batalhas")!;
  const data = sheet.getDataRange().getValues();

  const matches: Match[] = data.slice(1).map((row) => ({
    date: row[0],
    host: row[1],
    stage: row[2],
    raw: row[3],
    teams: getTeamsFromMatchResults(row[3]),
  }));

  reloadPlayerSheet(ss.getSheetByName("MCs")!, matches);
  reloadExtraSheet(ss.getSheetByName("Extra")!, matches);
  reloadHostSheet(ss.getSheetByName("Organizações")!, matches);
  reloadPersonalRecapSheet(ss.getSheetByName("Recap")!, matches, "Xavier");
}

function j(d: any) {
  return JSON.stringify(d, null, "--");
}

function printMatch(match: Match): string {
  return match.teams
    .map((team) => `${team.players.join(" e ")} (${team.roundsWon})`)
    .join(" x ");
}

function fixPhaseRow(data: string[][]) {
  data.forEach((row, i) => {
    if (toStage(row[0]) !== Stage.Unknown && !row[1]) {
      // If there is no phase in the next line but there is a match, that means
      // the phase is incorrectly placed and must go down a line
      if (!data[i + 1][0] && data[i + 1][1]) {
        data[i + 1][0] = row[0];
      }

      data[i][0] = "";
    }
  });
  return data;
}

function fixMutipleScoreTypes(data: string[][]) {
  return data.map((row) => {
    if (row[2] && row[3] && (row[1].includes("*") || row[4].includes("*"))) {
      return [
        row[0],
        row[1].replace("*", ""),
        row[2],
        row[3],
        row[4].replace("*", ""),
      ];
    } else {
      return row;
    }
  });
}

function mergeResultsInSingleColumn(data: string[][]) {
  return data.map((row) => {
    if (
      row[1] &&
      (row[2].toString() === "2" || row[3].toString() === "2") &&
      row[4]
    ) {
      return [row[0], `${row[1]} ${row[2]} x ${row[3]} ${row[4]}`, "", "", ""];
    } else {
      return row;
    }
  });
}

function fix() {
  const range = SpreadsheetApp.getActiveSpreadsheet()
    .getActiveSheet()
    .getActiveRange()!;

  let data = range.getValues();
  data = fixPhaseRow(data);
  data = fixMutipleScoreTypes(data);
  data = mergeResultsInSingleColumn(data);

  range.setValues(data);
  execute();
}
