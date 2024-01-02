function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu("Ações").addItem("Executar", "execute").addToUi();
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
  // Scoreless
  // E.g.: Blink e Killer* x Kenny e Kennyzin
  //       Onec x Jhones*
  if (data.includes("*")) {
    return data.split(" x ").map((team) => ({
      players: team.replace("*", "").split(" e "),
      roundsWon: team.includes("*") ? 1 : 0,
    }));
  }

  // With score, no double-three
  // E.g.: RK 2 x 0 Big Xang
  //       Eva e Isa 2 x 1 Mont e Onec
  if (/ \d x \d /.test(data)) {
    const [full, roundsWon1, roundsWon2] = / (\d) x (\d) /.exec(data) || [];
    // Use the extracted groups in your code
    const roundsResult = [roundsWon1, roundsWon2];

    return data.split(full!).map((team, i) => ({
      players: team.split(" e "),
      roundsWon: parseInt(roundsResult[i]),
    }));
  }

  // With score, double-three
  // E.g.: Berg 2 x Barb 0 x Sharp 1

  return [];
}

function toStage(rawStage: string): Stage {
  rawStage = rawStage.toLocaleLowerCase();
  if (rawStage == "primeira fase") {
    return Stage.EightFinals;
  } else if (rawStage == "segunda fase") {
    return Stage.QuarterFinals;
  } else if (rawStage == "semifinal" || rawStage == "semi final") {
    return Stage.SemiFinals;
  } else if (rawStage == "final") {
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
    const stage = row[0] ? toStage(row[0]) : matches[i - 1].stage;
    matches.push({
      raw: row[1],
      date,
      host,
      stage,
      teams: getTeamsFromMatchResults(row[1]),
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
  const date = data[0][1];
  const host = data[1][1];
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

function execute() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();

  // First, consider user selected range
  let data = sheet.getActiveRange()?.getValues() as string[][];
  let tournaments = getTournaments(data);

  if (tournaments.length == 0) {
    data = sheet.getDataRange().getValues();
    tournaments = getTournaments(data);
  }

  const matches = tournaments.flatMap((tournament) => tournament.matches);

  const matchSheet = ss.getSheetByName("Batalhas");
  if (matchSheet) {
    matchSheet.clear();

    const headers = [
      "Data",
      "Organização",
      "Fase",
      "Batalha",
      "Vencedor(es)",
      "Perdedor(es)",
    ];
    matchSheet.getRange(1, 1, 1, headers.length).setValues([headers]);

    const matchTable = matches.map((match) => [
      match.date,
      match.host,
      match.stage,
      match.raw,
      getWinners(match).join(" e "),
      getLosers(match).join(" e "),
    ]);

    if (headers.length !== matchTable[0].length) {
      throw new Error(`Headers length does not match matchTable number of columns on sheet "MCs".
        headers.length => ${headers.length}
        matchTable[0].length => ${matchTable[0].length}`);
    }

    const range = matchSheet.getRange(2, 1, matches.length, headers.length);
    range.setValues(matchTable);
  }

  interface PlayerData extends Player {
    // totalMatches: number | equivalent to totalMatches => matches.length
    totalWins: number;
    soloWins: number;
  }

  const players: Record<string, PlayerData> = {};

  matches.forEach((match) => {
    // Create players that didn't exist before
    match.teams.forEach((team) => {
      team.players.forEach((nickname) => {
        if (!(nickname in players)) {
          players[nickname] = {
            nickname,
            matches: [],
            totalWins: 0,
            soloWins: 0,
          };
        }

        players[nickname].matches.push(match);
      });
    });

    const winners = getWinners(match);

    winners.forEach((winner) => {
      players[winner].totalWins++;
      if (winners.length === 1) {
        players[winner].soloWins++;
      }
    });
  });

  const playerSheet = ss.getSheetByName("MCs");
  if (playerSheet) {
    playerSheet.clear();

    const headers = [
      "Vulgo",
      "Batalhas",
      "Vitórias (total)",
      "Vitórias (solo)",
    ];

    playerSheet.getRange(1, 1, 1, headers.length).setValues([headers]);

    const playerTable = Object.values(players).map((player) => [
      player.nickname,
      player.matches.length,
      player.totalWins,
      player.soloWins,
    ]);

    if (headers.length !== playerTable[0].length) {
      throw new Error(`Headers length does not match playerTable number of columns on sheet "MCs".
      headers.length => ${headers.length}
      playerTable[0].length => ${playerTable[0].length}`);
    }

    const range = playerSheet.getRange(
      2,
      1,
      playerTable.length,
      headers.length
    );
    range.setValues(playerTable);
  }

  // ui.alert(matches.map(printMatch).join("\n"));

  // ui.alert(
  //   j(
  //     tournaments.map((tournament) => ({
  //       date: Utilities.formatDate(
  //         new Date(tournament.date),
  //         "GMT-0400",
  //         "EEEE, dd/MM/yyyy"
  //       ),
  //       host: tournament.host,
  //       firstMatch: printMatch(tournament.matches[0]),
  //       lastMatch: printMatch(
  //         tournament.matches[tournament.matches.length - 1]
  //       ),
  //     }))
  //   )
  // );
}

function j(d: any) {
  return JSON.stringify(d, null, "--");
}

function printMatch(match: Match): string {
  return match.teams
    .map((team) => `${team.players.join(" e ")} (${team.roundsWon})`)
    .join(" x ");
}
