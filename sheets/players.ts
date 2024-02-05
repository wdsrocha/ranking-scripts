interface PlayerData extends Player {
  totalWins: number;
  titles: number;
  winRate: number;
  tournamentIds: string[]; // tournament key `${date} | ${host}`
}

function norm(nickname: string) {
  return nickname.toLocaleLowerCase().trim();
}

function getTournamentId(match: Match) {
  return `${match.date} | ${match.host}`;
}

function reloadPlayerSheet(
  sheet: GoogleAppsScript.Spreadsheet.Sheet,
  matches: Match[]
) {
  const players: Record<string, PlayerData> = {};

  matches.forEach((match) => {
    // Create players that didn't exist before
    match.teams.forEach((team) => {
      team.players.forEach((nickname) => {
        if (!(norm(nickname) in players)) {
          players[norm(nickname)] = {
            nickname,
            matches: [],
            totalWins: 0,
            titles: 0,
            winRate: 0,
            tournamentIds: [],
          };
        }

        players[norm(nickname)].matches.push(match);

        // THIS WILL HAVE DUPLICATES!!!
        players[norm(nickname)].tournamentIds.push(getTournamentId(match));
      });
    });

    const winners = getWinners(match);

    winners.forEach((winner) => {
      const p = players[norm(winner)];
      p.totalWins++;
      if (match.stage === Stage.Finals) {
        p.titles++;
      }

      if (winners.length === 1) {
        if (match.stage === Stage.Finals) {
        }
      }
    });
  });

  type P = PlayerData;

  const countTournaments = (player: PlayerData) =>
    new Set(player.matches.map(getTournamentId)).size;

  function countDistinctFoes(p: PlayerData) {
    if (p.nickname === "Sharp") {
      console.log({
        foes: new Set(
          p.matches
            .flatMap((match) => match.teams)
            .filter(
              (team) => !team.players.map(norm).includes(norm(p.nickname))
            )
            .flatMap((team) => team.players)
            .map(norm)
        ),
      });
    }
    return new Set(
      p.matches
        .flatMap((match) => match.teams)
        .filter((team) => !team.players.map(norm).includes(norm(p.nickname)))
        .flatMap((team) => team.players)
        .map(norm)
    ).size;
  }

  const countFavoriteHost = (player: PlayerData): [string, number] => {
    return Object.entries(
      Array.from(new Set(player.matches.map(getTournamentId)))
        .map((id) => id.split(" | ")[1])
        .reduce<Record<string, number>>(
          (prev, curr) => ({
            ...prev,
            [curr]: prev[curr] ? prev[curr] + 1 : 1,
          }),
          {}
        )
    ).sort((a, b) => b[1] - a[1])[0];
    // .sort((a, b) => b[1] - a[1])
    // .filter(([_, count], i, arr) => count === arr[0][1])
    // .map(([host, count]) => `${host} (${count})`)
    // .join(" e ");
  };

  function getRival(p: P): [string, number] {
    let validMatches = p.matches.filter(
      (match) =>
        match.teams.length === 2 &&
        match.teams.every((team) => team.players.length === 1)
    );

    // If the player has never played 1v1, we can allow any match
    if (validMatches.length === 0) {
      validMatches = p.matches;
    }

    const results: Record<string, { matchCount: number; foeVictoryCount }> = {};
    validMatches.forEach((match) => {
      // Sort teams by rounds won
      if (match.teams[1].roundsWon > match.teams[0].roundsWon) {
        match = {
          ...match,
          teams: [match.teams[1], match.teams[0]],
        };
      }

      const winner = norm(match.teams[0].players[0]);
      const loser = norm(match.teams[1].players[0]);
      if (!(winner in results)) {
        results[winner] = {
          matchCount: 0,
          foeVictoryCount: 0,
        };
      }
      results[winner].matchCount++;
      results[winner].foeVictoryCount += match.teams[1].roundsWon;
    });

    let foes = p.matches
      .flatMap((match) => match.teams)
      .filter((team) => !team.players.map(norm).includes(norm(p.nickname)))
      .filter((team) => team.players.length === 1);

    // This means that the player has never played 1v1
    // So we can allow

    const foesCount: Record<string, number> = {};
    foes.forEach((foe) => {
      const k = norm(foe.players[0]);
      if (!(k in foesCount)) {
        foesCount[k] = 0;
      }
      foesCount[k]++;
    });

    const sorted = Object.entries(foesCount).sort((a, b) => b[1] - a[1]);
    return sorted?.[0] ?? ["", 0];
  }

  const distinctFoes = Object.keys(players).length;

  const tableDefinitions: [
    string,
    (p: P) => string | number,
    ((range: GoogleAppsScript.Spreadsheet.Range) => void)?
  ][] = [
    ["Vulgo", (p) => p.nickname],
    ["Edições", countTournaments],
    ["Batalhas", (p) => p.matches.length],
    ["Folhinhas", (p) => p.titles],
    [
      "Vice",
      (p) =>
        p.matches.filter((match) => match.stage === Stage.Finals).length -
        p.titles,
    ],
    ["Vitórias", (p) => p.totalWins],
    ["Derrotas", (p) => p.matches.length - p.totalWins],
    [
      "Vitórias / Batalhas",
      (p) => (p.matches.length ? p.totalWins / p.matches.length : 0),
      (range) => range.setNumberFormat("00.00%"),
    ],
    [
      "Folhinhas / Edições",
      (p) => (countTournaments(p) ? p.titles / countTournaments(p) : 0),
      (range) => range.setNumberFormat("00.00%"),
    ],
    ["Batalha mais frequentada", (p) => countFavoriteHost(p)[0]],
    ["Edições na Batalha mais frequentada", (p) => countFavoriteHost(p)[1]],
    ["Oponentes diferentes", countDistinctFoes],
    ["Rival", (p) => getRival(p)[0]],
    ["Batalhas travadas com rival", (p) => getRival(p)[1]],
  ];

  const playerTable = Object.values(players)
    .sort((a, b) => {
      if (a.titles !== b.titles) {
        return b.titles - a.titles;
        //   } else if (a.soloTitles !== b.soloTitles) {
        //     return b.soloTitles - a.soloTitles;
      } else if (a.totalWins !== b.totalWins) {
        return b.totalWins - a.totalWins;
        //   } else if (a.soloWins !== b.soloWins) {
        //     return b.soloWins - a.soloWins;
      } else if (a.matches.length !== b.matches.length) {
        return b.matches.length - a.matches.length;
      } else {
        return a.nickname.localeCompare(b.nickname);
      }
    })
    .map((player) => tableDefinitions.map(([header, f]) => f(player)));

  sheet.clearFormats();
  sheet.clearContents();

  sheet
    .getRange(1, 1, 1, tableDefinitions.length)
    .setValues([tableDefinitions.map(([header]) => header)])
    .setFontWeight("bold")
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle")
    .setWrap(true);

  sheet
    .getRange(2, 1, playerTable.length, tableDefinitions.length)
    .setValues(playerTable);

  tableDefinitions.forEach(([_, __, apply], index) => {
    const range = sheet.getRange(1, index + 1, sheet.getLastRow() - 1, 1);
    apply?.(range);
  });

  interface Stat {
    nickname: string;

    // Scene 1
    matches: number;
    wins: number;
    winRate: number;
    losses: number;
    lossRate: number;

    // Scene 2
    tournaments: number;
    finals: number;
    titles: number;

    // Scene 3
    foes: number; // number of different foes

    // Scene 4
    rival: string; // player with most matches against (1v1)

    // Scene 5
    weakestFoe: string; // player with most wins against (1v1)

    // Scene 6
    strongestFoe: string; // player with most losses against (1v1)

    // Scene 7
    favoriteHost: string; // host with most tournaments participated
    favoriteHostFreq: number;
  }

  // Object.values(players).map<Stat>((p) => {
  //   const n = p.matches.length;
  //   const w = p.totalWins;

  //   return {
  //     nickname: p.nickname,

  //     // Scene 1
  //     matches: n,
  //     wins: w,
  //     winRate: w / n,
  //     losses: n - w,
  //     lossRate: (n - w) / n,

  //     // Scene 2
  //     tournaments: countTournaments(p),
  //     titles: p.titles,
  //     finals: p.matches.filter((match) => match.stage === Stage.Finals).length,

  //     // Scene 3
  //     foes: countDistinctFoes(p),

  //     // Scene 4
  //     rival: "onec",

  //     // Scene 5
  //     weakestFoe: "",

  //     // Scene 6
  //     strongestFoe: "",

  //     // Scene 7
  //     favoriteHost: "",
  //     tournamentsInFavoriteHost: 0,
  //   };
  // });
}
