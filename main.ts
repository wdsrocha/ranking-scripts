function addNewEditionPage() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const templateSheet = ss.getSheetByName("Template");
  if (!templateSheet) {
    return SpreadsheetApp.getUi().alert(
      "Falha ao criar nova rodada",
      'Não foi possível encontrar a página "Template". Certifique-se de que existe uma página com o nome "Template".',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }

  let lastEdition = 0;
  ss.getSheets().forEach((sheet) => {
    const name = sheet.getName();
    if (name.startsWith("Rodada")) {
      const edition = parseInt(name.split(" ")[1]);
      if (edition > lastEdition) {
        lastEdition = edition;
      }
    }
  });

  const newEditionNumber = lastEdition + 1;
  const editionName = `Rodada ${newEditionNumber.toString().padStart(2, "0")}`;
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
    if (name.startsWith("Rodada")) {
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

function onOpen() {
  var ui = SpreadsheetApp.getUi();
  // Or DocumentApp or FormApp.
  ui.createMenu("Ações").addItem("Parse Tournament Sheet", "foo").addToUi();
}

function foo() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const seasonMatches: Match[] = [];

  ss.getSheets().forEach((sheet) => {
    const name = sheet.getName();
    if (isTournamentSheetName(name)) {
      seasonMatches.push(...parseTournamentSheet(sheet));
    }
  });

  let players: Record<string, Player> = {};

  seasonMatches.forEach((match) => {
    const winningTeam = match.teams.reduce((prev, curr) => {
      return curr.roundsWon > prev.roundsWon ? curr : prev;
    }, match.teams[0]);
    const totalRounds = match.teams.reduce((prev, curr) => {
      return prev + curr.roundsWon;
    }, 0);

    // Create players if they don't exist
    match.teams.forEach((team) => {
      team.players.forEach((nickname) => {
        if (!(nickname in players)) {
          players[nickname] = new Player(nickname);
        }
        const player = players[nickname];

        if (!(match.tournamentId in player.tournaments)) {
          player.tournaments[match.tournamentId] = {
            wins: 0,
            perfectWins: 0,
            champion: false,
            matchesWon: [],
          };
        }
      });
    });

    // Apenas uma forma de verificar se foi twolala Em outras palavras, se a
    // quantidade total de rounds da batalha foi igual a 2, então não houve
    // terceiro round
    const wasPerfectWin = totalRounds == 2;

    winningTeam.players.forEach((nickname) => {
      const player = players[nickname];
      const tournament = player.tournaments[match.tournamentId];

      tournament.wins++;
      tournament.perfectWins += wasPerfectWin ? 1 : 0;
      if (match.stage == Stage.Finals) {
        tournament.champion = true;
      }
      tournament.matchesWon.push(match);
    });
  });

  const leaderboard = Object.values(players)
    .filter((player) => player.getScore() > 0)
    .sort(comparePlayers)
    .map((player, index, array) => {
      if (index === 0) {
        player.position = 1;
      } else {
        // Safe because the conditional above already handles the case
        const lastPosition = array[index - 1].position!;
        const drawsWithLast = comparePlayers(player, array[index - 1]) === 0;
        player.position = lastPosition + (drawsWithLast ? 0 : 1);
      }

      return player;
    });

  const sheet = ss.getSheetByName("Placar");
  if (!sheet) {
    return;
  }

  sheet.getRange(3, 1, 100).clearContent();

  leaderboard.map((player, index) => {
    const range = sheet.getRange(index + 3, 1, 1, 5);
    range.setValues([
      [
        player.position,
        player.nickname,
        player.getScore(),
        player.getPerfectWins(),
        player.getParticipations(),
      ],
    ]);
  });
}
