const COLORS = [
  {
    name: "Red",
    bg: "bg-red-500",
    border: "border-red-600",
    soft: "bg-red-100",
    text: "text-red-700",
    emoji: "🔴",
  },
  {
    name: "Blue",
    bg: "bg-blue-500",
    border: "border-blue-600",
    soft: "bg-blue-100",
    text: "text-blue-700",
    emoji: "🔵",
  },
  {
    name: "Green",
    bg: "bg-green-500",
    border: "border-green-600",
    soft: "bg-green-100",
    text: "text-green-700",
    emoji: "🟢",
  },
  {
    name: "Yellow",
    bg: "bg-yellow-400",
    border: "border-yellow-500",
    soft: "bg-yellow-100",
    text: "text-yellow-700",
    emoji: "🟡",
  },
];

const BOARD_SIZE = 11;
const TRACK_LENGTH = 40;
const FINISH_POSITION = 44;
const CAPTURE_BONUS = 20;
const SAFE_SQUARES = [0, 8, 10, 18, 20, 28, 30, 38];
const START_OFFSETS = [0, 10, 20, 30];

function makeTrack() {
  const cells = [];
  for (let c = 0; c <= 10; c += 1) cells.push([0, c]);
  for (let r = 1; r <= 10; r += 1) cells.push([r, 10]);
  for (let c = 9; c >= 0; c -= 1) cells.push([10, c]);
  for (let r = 9; r >= 1; r -= 1) cells.push([r, 0]);
  return cells;
}

const TRACK = makeTrack();

function createPlayers(playerConfigs) {
  const clockwiseOrder = [0, 1, 2, 3];

  const sortedConfigs = [...playerConfigs].sort((a, b) => {
    const aIndex = clockwiseOrder.indexOf(a.colorIndex);
    const bIndex = clockwiseOrder.indexOf(b.colorIndex);
    return aIndex - bIndex;
  });

  return sortedConfigs.map((config, orderIndex) => {
    const colorIndex = config.colorIndex ?? orderIndex;
    return {
      id: colorIndex,
      turnOrder: orderIndex,
      name:
        config.name?.trim() ||
        (config.isAI ? `AI ${COLORS[colorIndex].name}` : "Funky Player"),
      isAI: Boolean(config.isAI),
      color: { ...COLORS[colorIndex], emoji: COLORS[colorIndex].emoji },
      consecutiveSixes: 0,
      tokens: Array.from({ length: 4 }, (_, tokenIndex) => ({
        id: tokenIndex,
        position: -1,
        home: false,
      })),
    };
  });
}

function tokenTrackIndex(playerId, token) {
  if (
    !token ||
    token.position < 0 ||
    token.position >= TRACK_LENGTH ||
    token.home
  )
    return null;
  return (START_OFFSETS[playerId] + token.position) % TRACK_LENGTH;
}

function homeLanePosition(playerId, token) {
  if (
    !token ||
    token.position < TRACK_LENGTH ||
    token.position > FINISH_POSITION ||
    token.home
  )
    return null;

  const step = token.position - TRACK_LENGTH;
  const lanes = {
    0: [
      [5, 1],
      [5, 2],
      [5, 3],
      [5, 4],
      [5, 5],
    ],
    1: [
      [1, 5],
      [2, 5],
      [3, 5],
      [4, 5],
      [5, 5],
    ],
    2: [
      [5, 9],
      [5, 8],
      [5, 7],
      [5, 6],
      [5, 5],
    ],
    3: [
      [9, 5],
      [8, 5],
      [7, 5],
      [6, 5],
      [5, 5],
    ],
  };

  return lanes[playerId]?.[step] || null;
}

function tokenCanMove(token, dice) {
  if (!token || !dice || token.home) return false;
  if (token.position === -1) return dice === 6;
  return token.position + dice <= FINISH_POSITION;
}

function getMovableTokens(player, dice) {
  if (!player || !dice) return [];
  return player.tokens.filter((token) => tokenCanMove(token, dice));
}

function chooseAIToken(
  movableTokensList,
  diceValue,
  aiPlayer,
  allPlayers = [],
) {
  if (!aiPlayer || movableTokensList.length === 0) return null;

  const scoreMove = (token) => {
    let score = 0;
    const currentPosition = token.position;
    const newPosition =
      currentPosition === -1 ? 0 : currentPosition + diceValue;
    const landedTrack =
      newPosition < TRACK_LENGTH
        ? (START_OFFSETS[aiPlayer.id] + newPosition) % TRACK_LENGTH
        : null;
    const currentTrack =
      currentPosition >= 0 && currentPosition < TRACK_LENGTH
        ? (START_OFFSETS[aiPlayer.id] + currentPosition) % TRACK_LENGTH
        : null;
    const currentlySafe =
      currentTrack !== null && SAFE_SQUARES.includes(currentTrack);
    const landingSafe =
      landedTrack !== null && SAFE_SQUARES.includes(landedTrack);

    if (newPosition >= FINISH_POSITION) score += 1000;

    if (landedTrack !== null && !landingSafe) {
      const enemiesOnTile = allPlayers
        .filter((player) => player.id !== aiPlayer.id)
        .flatMap((player) =>
          player.tokens.map((enemyToken) => ({ player, enemyToken })),
        )
        .filter(
          ({ player, enemyToken }) =>
            tokenTrackIndex(player.id, enemyToken) === landedTrack,
        );

      if (enemiesOnTile.length > 0) {
        score += 750;
        const strongestEnemyPosition = Math.max(
          ...enemiesOnTile.map(({ enemyToken }) => enemyToken.position),
        );
        score += Math.max(0, strongestEnemyPosition) * 3;
      }
    }

    if (diceValue === 6 && currentPosition === -1) score += 420;
    score += newPosition * 6;
    if (landingSafe) score += 120;
    if (currentlySafe && !landingSafe && newPosition < FINISH_POSITION)
      score -= 70;

    const activeTokens = aiPlayer.tokens.filter(
      (item) => item.position >= 0 && !item.home,
    ).length;
    if (activeTokens < 2 && diceValue === 6 && currentPosition === -1)
      score += 120;

    return score;
  };

  return [...movableTokensList].sort((a, b) => scoreMove(b) - scoreMove(a))[0];
}

export {
  COLORS,
  BOARD_SIZE,
  TRACK_LENGTH,
  FINISH_POSITION,
  CAPTURE_BONUS,
  SAFE_SQUARES,
  START_OFFSETS,
  TRACK,
  createPlayers,
  tokenTrackIndex,
  homeLanePosition,
  tokenCanMove,
  getMovableTokens,
  chooseAIToken,
};
