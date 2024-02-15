function showForm() {
  Logger.log("showForm");
  var html =
    HtmlService.createHtmlOutputFromFile("formUi").setTitle(
      "Cadastrar Batalha"
    );

  SpreadsheetApp.getUi().showSidebar(html);
}

interface Data {
  date: string;
  host: string;
  eightfinals: string;
  quarterfinals: string;
  semifinals: string;
  final: string;
}

function parse(textarea: string) {
  return textarea.split("\n").filter((x) => x.trim() !== "");
}

function parseMatchesData(data: Data) {
  const values: [string, string, string, string, string, string][] = [];
  parse(data.eightfinals).forEach((row) => {
    values.push([
      data.date,
      data.host,
      "Oitavas de Final",
      row,
      WINNERS(row),
      LOSERS(row),
    ]);
  });
  parse(data.quarterfinals).forEach((row) => {
    values.push([
      data.date,
      data.host,
      "Quartas de Final",
      row,
      WINNERS(row),
      LOSERS(row),
    ]);
  });
  parse(data.semifinals).forEach((row) => {
    values.push([
      data.date,
      data.host,
      "Semifinal",
      row,
      WINNERS(row),
      LOSERS(row),
    ]);
  });
  values.push([
    data.date,
    data.host,
    "Final",
    data.final,
    WINNERS(data.final),
    LOSERS(data.final),
  ]);

  return values;
}

function addDataToMatchesSheet(
  sheet: GoogleAppsScript.Spreadsheet.Sheet,
  values: Array<string>[]
) {
  const lastRow = sheet.getLastRow();
  sheet
    .getRange(lastRow + 1, 1, values.length, values[0].length)
    .setValues(values);
}

function addDataToTournamentSheets(
  sheet: GoogleAppsScript.Spreadsheet.Sheet,
  values: Array<string>[]
) {
  const lastRow = sheet.getLastRow();
  sheet.getRange(lastRow + 1, 1, 1, values[0].length).setValues(values);
}

function onSubmit(data: Data) {
  console.log(data);

  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  try {
    const tournamentSheet = ss.getSheetByName("Edições");
    if (!tournamentSheet) {
      throw new Error('Planilha "Edições" não encontrada.');
    }
    const matchesSheet = ss.getSheetByName("Batalhas");
    if (!matchesSheet) {
      throw new Error('Planilha "Batalhas" não encontrada.');
    }

    const values = parseMatchesData(data);

    addDataToTournamentSheets(tournamentSheet, [
      [data.date, data.host, WINNERS(data.final), LOSERS(data.final)],
    ]);
    addDataToMatchesSheet(matchesSheet, values);
    ui.alert("Batalha cadastrada com sucesso!");
  } catch (e) {
    ui.alert(e);
  }
}
