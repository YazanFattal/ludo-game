import test from "node:test";
import assert from "node:assert/strict";
import {
  createPlayers,
  TRACK,
  homeLanePosition,
  chooseAIToken,
  getMovableTokens,
} from "./game.js";
import { applyMove, gameReducer, initialGame } from "./engine.js";

const players = () =>
  createPlayers([
    { name: "Human", colorIndex: 0 },
    { name: "AI", colorIndex: 1, isAI: true },
  ]);
const roll = (state, value) =>
  gameReducer(gameReducer(state, { type: "roll" }), { type: "result", value });

test("the complete 40-square track has no duplicates and every home-lane step exists", () => {
  assert.equal(TRACK.length, 40);
  assert.equal(new Set(TRACK.map((cell) => cell.join(","))).size, 40);
  for (let id = 0; id < 4; id++)
    for (let position = 40; position <= 44; position++)
      assert.ok(homeLanePosition(id, { position }));
});

test("a capture returns all enemies on the tile to base and awards exactly 20 steps", () => {
  const original = players();
  original[0].tokens[0].position = 5;
  original[1].tokens[0].position = 1;
  original[1].tokens[1].position = 1;
  const result = applyMove(original, 0, 0, 6);
  assert.equal(result.captured, true);
  assert.equal(result.players[0].tokens[0].position, 31);
  assert.equal(result.players[1].tokens[0].position, -1);
  assert.equal(result.players[1].tokens[1].position, -1);
  assert.equal(original[0].tokens[0].position, 5, "input state is not mutated");
});

test("safe squares allow opponents to share a tile without a capture or bonus", () => {
  const original = players();
  original[0].tokens[0].position = 4;
  original[1].tokens[0].position = 0;
  const result = applyMove(original, 0, 0, 6);
  assert.equal(result.captured, false);
  assert.equal(result.players[0].tokens[0].position, 10);
  assert.equal(result.players[1].tokens[0].position, 0);
});

test("capture bonus can finish a token and cannot exceed the finish position", () => {
  const original = players();
  original[0].tokens[0].position = 29;
  original[1].tokens[0].position = 21;
  const result = applyMove(original, 0, 0, 2);
  assert.equal(result.captured, true);
  assert.equal(result.reachedHome, true);
  assert.deepEqual(result.players[0].tokens[0], {
    id: 0,
    position: 44,
    home: true,
  });
});

test("exact finish grants an extra roll; overshoots and finished tokens are rejected", () => {
  const original = players();
  original[0].tokens[0].position = 43;
  assert.equal(applyMove(original, 0, 0, 2), null);
  const result = applyMove(original, 0, 0, 1);
  assert.equal(result.reachedHome, true);
  assert.equal(applyMove(result.players, 0, 0, 1), null);
});

test("six unlocks a token, grants an extra roll, and three sixes cancel the turn", () => {
  let state = initialGame(players());
  state = gameReducer(roll(state, 6), { type: "move", tokenId: 0 });
  assert.equal(state.players[0].tokens[0].position, 0);
  assert.equal(state.phase, "ready");
  state = gameReducer(roll(state, 6), { type: "move", tokenId: 0 });
  const before = state.players[0].tokens[0].position;
  state = roll(state, 6);
  assert.equal(state.phase, "transition");
  assert.equal(state.players[0].tokens[0].position, before);
  assert.equal(state.players[0].consecutiveSixes, 0);
  state = gameReducer(state, { type: "next" });
  assert.equal(state.currentPlayer, 1);
});

test("no legal move passes the turn and duplicate rolls or moves cannot race a pending transition", () => {
  let state = roll(initialGame(players()), 2);
  assert.equal(state.phase, "transition");
  assert.equal(gameReducer(state, { type: "roll" }), state);
  assert.equal(gameReducer(state, { type: "move", tokenId: 0 }), state);
  state = gameReducer(state, { type: "next" });
  assert.equal(state.currentPlayer, 1);
  assert.equal(state.phase, "ready");
  const rolling = gameReducer(state, { type: "roll" });
  assert.equal(gameReducer(rolling, { type: "roll" }), rolling);
});

test("the fourth token home wins and blocks any further roll", () => {
  const original = players();
  original[0].tokens.forEach((token, index) => {
    token.position = index === 3 ? 43 : 44;
    token.home = index !== 3;
  });
  const state = gameReducer(roll(initialGame(original), 1), {
    type: "move",
    tokenId: 3,
  });
  assert.equal(state.phase, "won");
  assert.match(state.message, /Human wins/);
  assert.equal(gameReducer(state, { type: "roll" }), state);
});

test("AI prefers an exact finish, and complete seeded AI matches reach a winner", () => {
  const original = players();
  original[1].tokens[0].position = 43;
  original[1].tokens[1].position = 15;
  assert.equal(
    chooseAIToken(getMovableTokens(original[1], 1), 1, original[1], original)
      .id,
    0,
  );
  for (let seed = 1; seed <= 10; seed++) {
    let random = seed;
    let state = initialGame(
      createPlayers([0, 1, 2, 3].map((id) => ({ colorIndex: id, isAI: true }))),
    );
    let moves = 0;
    while (state.phase !== "won" && moves++ < 10000) {
      if (state.phase === "ready") {
        random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
        state = roll(state, (random % 6) + 1);
      } else if (state.phase === "transition")
        state = gameReducer(state, { type: "next" });
      else if (state.phase === "choosing") {
        const active = state.players[state.currentPlayer];
        const token = chooseAIToken(
          getMovableTokens(active, state.dice),
          state.dice,
          active,
          state.players,
        );
        assert.ok(token);
        state = gameReducer(state, { type: "move", tokenId: token.id });
      }
      for (const player of state.players)
        for (const token of player.tokens) {
          assert.ok(token.position >= -1 && token.position <= 44);
          assert.equal(token.home, token.position === 44);
        }
    }
    assert.equal(state.phase, "won", `AI match ${seed} finished`);
  }
});
