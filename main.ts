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
  const sheet = ss.getSheetByName("Edições")!;
  const range = sheet.getDataRange();
  const data = range.getValues();

  const matches: Match[] = data
    .map((row, index) => ({ row, index }))
    .slice(1)
    .filter((x) => x.row[2] !== "" || x.row[3] !== "") // Teve?
    .map((x) => {
      const champion = x.row[2];
      const runnerUp = x.row[3];

      const championTeam: Team = {
        players: champion
          .split(", ") // Handle trio
          .join(" e ") // Handle trio
          .split(" e ")
          .map((s) => s.trim()),
        roundsWon: 1,
      };

      const runnerUpTeam: Team = {
        players: runnerUp
          .split(", ") // Handle trio
          .join(" e ") // Handle trio
          .split(" e ")
          .map((s) => s.trim()),
        roundsWon: 0,
      };

      const date = x.row[1].toISOString().split("T")[0];

      return {
        date: x.row[1],
        host: "Batalha da Malta",
        stage: Stage.Finals,
        raw: `${champion}* x ${runnerUp}`,
        isWO: false,
        tournamentId: date,
        teams: [championTeam, runnerUpTeam],
        winners: championTeam.players,
        losers: runnerUpTeam.players,
      };
    });

  matches.slice(0, 10).forEach((match) => {
    console.log(`${match.tournamentId}: ${printMatch(match)}`);
  });

  reloadPlayerSheet(ss.getSheetByName("Campeões")!, matches);
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
