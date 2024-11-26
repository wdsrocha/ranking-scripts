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
    // Somente se tiver número de edição e um campeão declarado
    .filter((x) => x.row[4] !== "" && x.row[2] !== "")
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

      const judges = x.row[12]
        .split(", ")
        .join(" e ")
        .split(" e ")
        .map((s) => s.trim());

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
        judges,
      };
    });

  matches.slice(0, 10).forEach((match) => {
    console.log(`${match.tournamentId}: ${printMatch(match)}`);
  });

  const matches2024 = matches.filter((m) => m.date.getFullYear() === 2024);

  reloadPlayerSheet(ss.getSheetByName("Campeões")!, matches);
  reloadPlayerSheet(ss.getSheetByName("Campeões 2024")!, matches2024);
  reloadJudgesSheet(ss.getSheetByName("Jurados 2024")!, matches2024);
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
