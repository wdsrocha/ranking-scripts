function addNewEditionPage() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const templateSheet = ss.getSheetByName("Template");
  if (!templateSheet) {
    return SpreadsheetApp.getUi().alert(
      "Falha ao criar nova edição",
      'Não foi possível encontrar a página "Template". Certifique-se de que existe uma página com o nome "Template".',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }

  let lastEdition = 0;
  ss.getSheets().forEach((sheet) => {
    const name = sheet.getName();
    if (name.startsWith("Edição")) {
      const edition = parseInt(name.split(" ")[1]);
      if (edition > lastEdition) {
        lastEdition = edition;
      }
    }
  });

  const newEditionNumber = lastEdition + 1;
  const editionName = `Edição ${newEditionNumber.toString().padStart(2, "0")}`;
  Logger.log(`Creating new edition: ${editionName}`);
  const newSheet = templateSheet.copyTo(ss).setName(editionName).showSheet();
  ss.setActiveSheet(newSheet);
}

type EditionData = Record<
  string,
  {
    wins: number;
    perfectWins: number; // 2x0, "twolala"
  }
>;

class Mc {
  nickname: string;
  totalScore: number;
  perfectWins: number;
  editionsWon: number;
  participations: number;

  constructor(nickname: string) {
    this.nickname = nickname;
    this.totalScore = 0;
    this.perfectWins = 0;
    this.editionsWon = 0;
    this.participations = 0;
  }
}

function generateScoreFromEditionSheet(
  sheet: GoogleAppsScript.Spreadsheet.Sheet
): EditionData {
  const range = sheet.getRange(3, 2, 15, 4);
  const values = range.getValues();

  const data: EditionData = {};

  function updateMcScoreFromMatch(
    nickname: string,
    score: number,
    opponentScore: number
  ) {
    if (!(nickname in data)) {
      data[nickname] = {
        wins: 0,
        perfectWins: 0,
      };
    }

    if (score > opponentScore) {
      data[nickname].wins++;
    }

    if (score == 2 && opponentScore == 0) {
      data[nickname].perfectWins++;
    }
  }

  values.forEach((row) => {
    const [nickname1, score1, score2, nickname2] = row;

    if (nickname1 == "" || nickname2 == "") {
      Logger.log("Empty nickname");
      Logger.log(row);
    }

    updateMcScoreFromMatch(nickname1, score1, score2);
    updateMcScoreFromMatch(nickname2, score2, score1);
  });

  return data;
}

function updateLeaderboards(): void {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let data: EditionData = {};
  ss.getSheets().forEach((sheet) => {
    const name = sheet.getName();
    if (name.startsWith("Edição")) {
      data = generateScoreFromEditionSheet(sheet);
    }
  });

  // ONLY WORKS FOR 1 SINGLE EDITION
  const mcData: Record<string, Mc> = {};
  Object.entries(data).forEach(([nickname, { wins, perfectWins }]) => {
    if (!(nickname in mcData)) {
      mcData[nickname] = new Mc(nickname);
    }

    const mc = mcData[nickname];
    mc.perfectWins += perfectWins;

    let winScore = 0;
    if (wins == 1) {
      winScore = 1;
    } else if (wins == 2) {
      winScore = 3;
    } else if (wins == 3) {
      winScore = 5;
    } else if (wins == 4) {
      mc.editionsWon++;
      winScore = 7;
    }

    mc.totalScore = winScore + perfectWins;
    mc.participations++;
  });

  const ranking = Object.values(mcData).sort((a, b) => {
    if (a.totalScore != b.totalScore) {
      return b.totalScore - a.totalScore;
    } else if (a.perfectWins != b.perfectWins) {
      return b.perfectWins - a.perfectWins;
    } else if (a.editionsWon != b.editionsWon) {
      return b.editionsWon - a.editionsWon;
    } else if (a.participations != b.participations) {
      return b.participations - a.participations;
    } else {
      return a.nickname.localeCompare(b.nickname);
    }
  });

  function isDraw(mc1: Mc, mc2: Mc): boolean {
    return (
      mc1.totalScore == mc2.totalScore &&
      mc1.perfectWins == mc2.perfectWins &&
      mc1.editionsWon == mc2.editionsWon &&
      mc1.participations == mc2.participations
    );
  }

  let lastPosition = 1;
  ranking.map((mc, index) => {
    const sheet = ss.getSheetByName("Placar");
    if (!sheet) {
      return;
    }

    // sheet
    //   .getRange(1, 1, 1, 4)
    //   .setValues([["Posição", "Vulgo", "Pontuação", "Vitórias 2x0"]]);

    let currentPosition = lastPosition;
    if (index > 0 && !isDraw(mc, ranking[index - 1])) {
      currentPosition = lastPosition + 1;
    }
    lastPosition = currentPosition;

    const range = sheet.getRange(index + 3, 1, 1, 5);
    range.setValues([
      [
        currentPosition,
        mc.nickname,
        mc.totalScore,
        mc.perfectWins,
        mc.participations,
      ],
    ]);
  });
}
