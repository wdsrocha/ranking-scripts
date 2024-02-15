function showForm() {
  Logger.log("showForm");
  var html = HtmlService.createHtmlOutputFromFile("formUi")
    .setTitle("Nova Batalha")
    .setWidth(300);

  SpreadsheetApp.getUi().showSidebar(html);
}

function onSubmit(data) {
  const ui = SpreadsheetApp.getUi();
  ui.alert("Batalha cadastrada.");
  Logger.log(data);

  const file = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = file.getSheetByName("Batalhas");
  if (!sheet) {
    ui.alert("Planilha não encontrada.");
    return;
  }

  const lastRow = sheet.getLastRow();
  sheet
    .getRange(lastRow + 1, 1, 1, 4)
    .setValues([["14/02", "Batalha da La Prata", "Final", "Onec 2 x 1 Mont"]]);
}
