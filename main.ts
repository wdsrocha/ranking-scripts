let players: Record<string, Player> = {};

enum Delta {
  NONE = "",
  UP = "▲",
  DOWN = "▼",
}

function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu("Ações")
    .addItem("Atualizar ranking", "updateLeaderboard")
    .addItem("Atualizar players", "updatePlayerSheets")
    .addToUi();
}

function updatePlayerDataWithMatchResult(
  players: Record<string, Player>,
  match: Match
) {
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

  const winningTeam = match.teams.reduce((prev, curr) => {
    return curr.roundsWon > prev.roundsWon ? curr : prev;
  }, match.teams[0]);
  const totalRounds = match.teams.reduce((prev, curr) => {
    return prev + curr.roundsWon;
  }, 0);
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
}

function generateLeaderboards(players: Record<string, Player>): Player[] {
  return Object.values(players)
    .filter((player) => player.getScore() > 0)
    .sort(comparePlayers)
    .map((player, index, array) => {
      if (index == 0) {
        player.position = 1;
        return player;
      }

      const drawsWithLast = comparePlayers(player, array[index - 1]) === 0;
      if (drawsWithLast) {
        player.position = array[index - 1].position;
      } else {
        player.position = index + 1;
      }
      return player;
    });
}

function updateLeaderboard() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const seasonMatches: Match[] = [];

  ss.getSheets().forEach((sheet) => {
    const name = sheet.getName();
    if (isTournamentSheetName(name)) {
      seasonMatches.push(...parseTournamentSheet(sheet));
    }
  });

  players = {};

  seasonMatches.forEach((match) => {
    updatePlayerDataWithMatchResult(players, match);
  });

  const lastTournament = seasonMatches.reduce(
    (prev, curr) => (curr.tournamentId > prev.tournamentId ? curr : prev),
    seasonMatches[0]
  ).tournamentId;
  const previousMatches = seasonMatches.filter(
    (match) => match.tournamentId !== lastTournament
  );
  let previousPlayerData: Record<string, Player> = {};
  previousMatches.forEach((match) => {
    updatePlayerDataWithMatchResult(previousPlayerData, match);
  });

  const leaderboard = generateLeaderboards(players);
  generateLeaderboards(previousPlayerData).forEach((player) => {
    previousPlayerData[player.nickname].position = player.position;
  });

  const sheet = ss.getSheetByName("Placar");
  if (!sheet) {
    return;
  }

  sheet.getRange(3, 1, 100, 7).clearContent();

  leaderboard.map((player, index) => {
    const range = sheet.getRange(index + 3, 1, 1, 7);

    const previous = previousPlayerData[player.nickname];
    if (!previous) {
      return range.setValues([
        [
          player.position,
          player.nickname,
          Delta.UP,
          `+${player.getScore()}`,
          player.getScore(),
          player.getPerfectWins(),
          player.getParticipations(),
        ],
      ]);
    }

    const scoreDelta = player.getScore() - previous.getScore();
    let tournamentScore = "";
    if (scoreDelta < 0) {
      tournamentScore = scoreDelta.toString();
    } else if (scoreDelta > 0) {
      tournamentScore = `+${scoreDelta}`;
    }

    let delta: string = Delta.NONE;
    if (
      !player.position ||
      !previous.position ||
      player.position == previous.position
    ) {
      delta = Delta.NONE;
    } else if (player.position > previous.position) {
      delta = `${player.position - previous.position} ${Delta.DOWN}`;
    } else if (player.position < previous.position) {
      delta = `${previous.position - player.position} ${Delta.UP}`;
    }

    return range.setValues([
      [
        player.position,
        player.nickname,
        delta,
        tournamentScore,
        player.getScore(),
        player.getPerfectWins(),
        player.getParticipations(),
      ],
    ]);
  });
}

function updatePlayerSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.values(players).forEach((player) => {
    Logger.log(player.nickname);
    if (player.nickname !== "Senna") {
      return;
    }
    ss.insertSheet(player.nickname);
    // hopefully this is sync?
    const sheet = ss.getSheetByName(player.nickname)!;

    const tournaments = Object.values(player.tournaments);

    sheet.clearContents();
    sheet.getRange(1, 1, 1, 1).setValues([[player.nickname]]);
  });
}
