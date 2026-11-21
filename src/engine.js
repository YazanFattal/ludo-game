import {
  CAPTURE_BONUS,
  FINISH_POSITION,
  TRACK_LENGTH,
  START_OFFSETS,
  SAFE_SQUARES,
  getMovableTokens,
  tokenCanMove,
  tokenTrackIndex,
} from "./game.js";

export function initialGame(players) {
  return {
    players,
    currentPlayer: 0,
    dice: null,
    lastDice: null,
    phase: "ready",
    message: "Roll a six to bring a token into play.",
    captured: false,
  };
}

// The original move rules, isolated so captures, bonuses and exact finishes can be tested.
export function applyMove(players, currentPlayer, tokenId, dice) {
  const current = players[currentPlayer];
  const token = current.tokens.find((item) => item.id === tokenId);
  if (!tokenCanMove(token, dice)) return null;
  let movedTo = token.position === -1 ? 0 : token.position + dice;
  let captured = false;
  let updated = players.map((player) => ({
    ...player,
    tokens: player.tokens.map((item) => ({ ...item })),
  }));
  const landedTrack =
    movedTo < TRACK_LENGTH
      ? (START_OFFSETS[current.id] + movedTo) % TRACK_LENGTH
      : null;
  if (landedTrack !== null && !SAFE_SQUARES.includes(landedTrack)) {
    updated = updated.map((player, index) =>
      index === currentPlayer
        ? player
        : {
            ...player,
            tokens: player.tokens.map((enemy) => {
              if (tokenTrackIndex(player.id, enemy) !== landedTrack)
                return enemy;
              captured = true;
              return { ...enemy, position: -1, home: false };
            }),
          },
    );
  }
  if (captured) movedTo = Math.min(movedTo + CAPTURE_BONUS, FINISH_POSITION);
  const reachedHome = movedTo >= FINISH_POSITION;
  updated[currentPlayer].tokens = updated[currentPlayer].tokens.map((item) =>
    item.id === tokenId
      ? { ...item, position: movedTo, home: reachedHome }
      : item,
  );
  return { players: updated, captured, reachedHome };
}

export function gameReducer(state, action) {
  const active = state.players[state.currentPlayer];
  switch (action.type) {
    case "roll":
      if (state.phase !== "ready") return state;
      return {
        ...state,
        phase: "rolling",
        captured: false,
        message: `${active.name} is rolling…`,
      };
    case "result": {
      if (state.phase !== "rolling") return state;
      const value = action.value;
      const sixes = value === 6 ? active.consecutiveSixes + 1 : 0;
      const cancelled = sixes >= 3;
      const players = state.players.map((player, index) =>
        index === state.currentPlayer
          ? { ...player, consecutiveSixes: cancelled ? 0 : sixes }
          : player,
      );
      const legal =
        !cancelled &&
        getMovableTokens(players[state.currentPlayer], value).length > 0;
      return {
        ...state,
        players,
        dice: value,
        lastDice: value,
        phase: legal ? "choosing" : "transition",
        message: cancelled
          ? `${active.name} rolled three sixes. Turn cancelled.`
          : legal
            ? `${active.name} rolled ${value}. Choose a highlighted token.`
            : `No legal move for ${active.name}. Next player…`,
      };
    }
    case "move": {
      if (state.phase !== "choosing") return state;
      const result = applyMove(
        state.players,
        state.currentPlayer,
        action.tokenId,
        state.dice,
      );
      if (!result) return state;
      const won = result.players[state.currentPlayer].tokens.every(
        (token) => token.home,
      );
      const extraRoll =
        state.dice === 6 || result.captured || result.reachedHome;
      const message = won
        ? `${active.name} wins! All four tokens are home.`
        : result.captured
          ? `${active.name} captured a token. +20 steps and an extra roll!`
          : result.reachedHome
            ? `${active.name} brought a token home. Roll again!`
            : state.dice === 6
              ? "A six means an extra roll. Keep going!"
              : `${active.name} moved ${state.dice} steps.`;
      return {
        ...state,
        ...result,
        dice: null,
        phase: won ? "won" : extraRoll ? "ready" : "transition",
        message,
      };
    }
    case "next":
      if (state.phase !== "transition") return state;
      return {
        ...state,
        dice: null,
        phase: "ready",
        currentPlayer: (state.currentPlayer + 1) % state.players.length,
        players: state.players.map((player, index) =>
          index === state.currentPlayer
            ? { ...player, consecutiveSixes: 0 }
            : player,
        ),
      };
    default:
      return state;
  }
}
