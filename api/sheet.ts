function getWinners(teams: Team[]): string[] {
  return teams.reduce((prev, curr) => {
    // Assuming draws will never happen...
    return curr.roundsWon > prev.roundsWon ? curr : prev;
  }, teams[0]).players;
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

function isTwolala(match: Match): boolean {
  return match.teams.reduce((prev, curr) => prev + curr.roundsWon, 0) === 2;
}

function getMode(teams: Team[]): Mode {
  if (teams.length === 3) {
    return "Double-Three";
  }

  const n = teams[0].players.length;

  return n === 1 ? "Solo" : n === 2 ? "Duo" : "Trio";
}

function parseMatchResults(
  raw: string
): Pick<Match, "teams" | "winners" | "losers" | "isWO" | "isTwolala" | "mode"> {
  raw = raw.replace(".", "").trim();

  const isWO = raw.includes("(WO)");
  raw = raw.replace("(WO)", "").trim();

  if (!raw.includes(" x ")) {
    // Cases where there was not sufficient MCs or something, so the match was
    // marked as WO, but we don't know who was supposed to be the opponent
    if (isWO) {
      const teams = [
        {
          players: raw.split(", ").join(" e ").split(" e "),
          roundsWon: 0,
        },
      ];
      return {
        isWO,
        isTwolala: false,
        winners: getWinners(teams), //TODO FIX
        losers: [],
        mode: getMode(teams),
        teams,
      };
    } else {
      throw new Error(
        `A batalha "${raw}" não contém um ' x '. Não é possível determinar os times.`
      );
    }
  }

  // With score, no double-three
  // E.g.: RK 2 x 0 Big Xang
  //       Eva e Isa 2 x 1 Mont e Onec
  if (/ \d\s?x\s?\d /.test(raw)) {
    const [versus, roundsWon1, roundsWon2] =
      / (\d)\s?x\s?(\d) /.exec(raw) || [];
    // Use the extracted groups in your code
    const roundsResult = [roundsWon1, roundsWon2];

    const teams = raw.split(versus!).map((team, i) => ({
      players: team
        .split(", ") // Handle trio
        .join(" e ") // Handle trio
        .split(" e ")
        .map((s) => s.trim()),
      roundsWon: parseInt(roundsResult[i]),
    }));

    return {
      isWO,
      mode: getMode(teams),
      isTwolala: isTwolala({ teams } as Match),
      winners: getWinners(teams),
      losers: getLosers({ teams } as Match),
      teams,
    };
  }

  // With score, double-three
  if (raw.split(" x ").length === 3) {
    const results = raw.split(" x ");

    const teams = results.map((p, i) => ({
      players: [p.slice(0, p.length - 1).trim()],
      roundsWon: parseInt(p.slice(-1)),
    }));

    return {
      isWO,
      mode: getMode(teams),
      isTwolala: isTwolala({ teams } as Match),
      winners: getWinners(teams),
      losers: getLosers({ teams } as Match),
      teams,
    };
  }

  throw new Error(`A batalha "${raw}" está em formato inválido`);
}

function readMatches(sheetName: string = "Batalhas"): Match[] {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    throw new Error(`Planilha "${sheetName}" não encontrada`);
  }

  const matches: Match[] = sheet
    .getRange(2, 1, sheet.getLastRow(), 3)
    .getValues()
    .filter((row) => row[0] !== "" && row[1] !== "" && row[2] !== "")
    .map((row, id) => {
      const [tournamentId, stage, raw] = row;
      return {
        id,
        tournamentId: +tournamentId,
        stage: toStage(stage),
        raw,
        ...parseMatchResults(raw),
      };
    });

  return matches;
}

function annotateClarifications(
  clarifications: MatchScoreClarification[],
  sheetName: string = "Batalhas"
): void {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    throw new Error(`Planilha "${sheetName}" não encontrada`);
  }

  clarifications.forEach((x) => {
    sheet.getRange(x.matchId + 2, 4).setValue(x.clarification);
  });
}
