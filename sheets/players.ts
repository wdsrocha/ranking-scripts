function norm(nickname: string) {
  return nickname.toLocaleLowerCase().trim();
}

function getTournamentId(date: Date, host: string) {
  const simpleDate = date.toISOString().split("T")[0];
  const simpleHost = host.toLocaleLowerCase().trim().replace(/\s/g, "-");
  return `${simpleDate}-${simpleHost}`;
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
            twolala: 0,
            titles: 0,
            winRate: 0,
            tournamentIds: [],
            countByPosition: {
              [TournamentPosition.FirstStage]: 0,
              [TournamentPosition.SecondStage]: 0,
              [TournamentPosition.SemiFinals]: 0,
              [TournamentPosition.RunnerUp]: 0,
              [TournamentPosition.Champion]: 0,
            },
          };

          // gambiarra por causa de uma edição só com duas fases que não deveria
          // contar folhinha por ser muito básica
        }

        players[norm(nickname)].matches.push(match);

        // THIS WILL HAVE DUPLICATES!!!
        players[norm(nickname)].tournamentIds.push(match.tournamentId);
      });
    });

    const winners = getWinners(match);

    winners.forEach((winner) => {
      const p = players[norm(winner)];
      p.totalWins++;

      if (isTwolala(match)) {
        p.twolala++;
      }

      if (match.stage === Stage.Finals) {
        p.titles++;
      }
    });
  });

  type P = PlayerData;

  Object.entries(players).forEach(([_, player]) => {
    player.countByPosition = countPlayerPositionPerTournament(
      player,
      player.matches
    );
  });

  const countTournaments = (player: PlayerData) =>
    new Set(player.matches.map((match) => match.tournamentId)).size;

  function countDistinctFoes(p: PlayerData) {
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
      Array.from(new Set(player.matches.map((match) => match.tournamentId)))
        .map((id) => id.slice(11))
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
        !match.isWO &&
        match.teams.length === 2 &&
        match.teams.every((team) => team.players.length === 1)
    );

    // If the player has never played 1v1, we can allow any match except WO
    if (validMatches.length === 0) {
      validMatches = p.matches.filter((match) => !match.isWO);
    }

    const results: Record<string, { matchCount: number; foeVictoryCount }> = {};
    validMatches.forEach((match) => {
      // Sort teams by rounds won
      try {
        if (match.teams[1].roundsWon > match.teams[0].roundsWon) {
          match = {
            ...match,
            teams: [match.teams[1], match.teams[0]],
          };
        }
      } catch (e) {
        console.log({ match });
        throw e;
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
    [
      "Campeão",
      (p) => p.matches.filter((m) => m.winners.includes(p.nickname)).length,
    ],
    [
      "Vice",
      (p) => p.matches.filter((m) => m.losers.includes(p.nickname)).length,
    ],
    [
      "Campeão (solo)",
      (p) =>
        p.matches.filter(
          (m) => m.winners.includes(p.nickname) && isSoloMatch(m)
        ).length,
    ],
    [
      "Batalhas",
      (p) =>
        p.matches
          .map((m) => `${m.date.toISOString().split("T")[0]} | ${m.raw}`)
          .join("\n"),
    ],
  ];

  const playerTable = Object.values(players)
    .sort((a, b) => {
      if (a.titles !== b.titles) {
        return b.titles - a.titles;
      }

      const aSoloTitles = a.matches.filter(
        (m) => m.winners.includes(a.nickname) && isSoloMatch(m)
      ).length;
      const bSoloTitles = b.matches.filter(
        (m) => m.winners.includes(b.nickname) && isSoloMatch(m)
      ).length;

      if (aSoloTitles !== bSoloTitles) {
        return bSoloTitles - aSoloTitles;
      }

      if (a.countByPosition["Vice"] !== b.countByPosition["Vice"]) {
        return b.countByPosition["Vice"] - a.countByPosition["Vice"];
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
}

enum Champion {
  Champion = "Campeão",
}

const STAGE_ORDER: Stage[] = [
  Stage.Unknown,
  Stage.EightFinals,
  Stage.QuarterFinals,
  Stage.SemiFinals,
  Stage.Finals,
];

function getFurthestStage(matches: Match[]): Stage {
  return matches.reduce<Stage>((prev, curr) => {
    if (STAGE_ORDER.indexOf(curr.stage) > STAGE_ORDER.indexOf(prev)) {
      return curr.stage;
    }
    return prev;
  }, Stage.Unknown);
}

function getTournamentWinners(matches: Match[]): string[] {
  const tournamentIds = matches.map((match) => match.tournamentId);
  if (tournamentIds.some((id) => id !== tournamentIds[0])) {
    throw new Error(
      "getTournamentChampion: More than one tournament in matches"
    );
  }

  const finalMatches = matches.filter((match) => match.stage === Stage.Finals);
  if (finalMatches.length === 0) {
    return [];
    throw new Error("getTournamentChampion: No finals in matches");
  } else if (finalMatches.length > 1) {
    throw new Error("getTournamentChampion: More than one final in matches");
  }

  return getWinners(finalMatches[0]);
}

enum TournamentPosition {
  FirstStage = "Primeira Fase",
  SecondStage = "Segunda Fase",
  SemiFinals = "Semifinal",
  RunnerUp = "Vice",
  Champion = "Campeão",
}

function countPlayerPositionPerTournament(player: Player, matches: Match[]) {
  const matchesByTournament = groupMatchesByTournament(matches);
  return Object.entries(matchesByTournament).reduce<
    Record<TournamentPosition, number>
  >(
    (prev, [_, matches]) => {
      const champions = getTournamentWinners(matches);
      if (champions.map(norm).includes(norm(player.nickname))) {
        prev[TournamentPosition.Champion]++;
        return prev;
      }

      if (matches.some((match) => match.stage === Stage.Finals)) {
        prev[TournamentPosition.RunnerUp]++;
        return prev;
      }

      if (matches.some((match) => match.stage === Stage.SemiFinals)) {
        prev[TournamentPosition.SemiFinals]++;
        return prev;
      }

      if (matches.some((match) => match.stage === Stage.QuarterFinals)) {
        prev[TournamentPosition.SecondStage]++;
        return prev;
      }

      prev[TournamentPosition.FirstStage]++;
      return prev;
    },
    {
      [TournamentPosition.FirstStage]: 0,
      [TournamentPosition.SecondStage]: 0,
      [TournamentPosition.SemiFinals]: 0,
      [TournamentPosition.RunnerUp]: 0,
      [TournamentPosition.Champion]: 0,
    }
  );
}
