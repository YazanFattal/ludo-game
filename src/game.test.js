import test from "node:test";
import assert from "node:assert/strict";
import {
  createPlayers,
  getMovableTokens,
  tokenCanMove,
  tokenTrackIndex,
  homeLanePosition,
  SAFE_SQUARES,
  chooseAIToken,
} from "./game.js";

test("original game rule and AI assertions", () => {
  const players = createPlayers([
    { name: "A", colorIndex: 0, isAI: false },
    { name: "B", colorIndex: 1, isAI: true },
  ]);

  const unsortedPlayers = createPlayers([
    { name: "Green", colorIndex: 2, isAI: false },
    { name: "Red", colorIndex: 0, isAI: true },
    { name: "Yellow", colorIndex: 3, isAI: true },
    { name: "Blue", colorIndex: 1, isAI: true },
  ]);

  assert.ok(
    players.length === 2,
    "createPlayers should create all player configs.",
  );
  assert.ok(players[0].isAI === false, "First player should be human.");
  assert.ok(players[1].isAI === true, "Second player should be AI.");
  assert.ok(
    players[0].tokens.length === 4,
    "Each player should start with 4 tokens.",
  );
  assert.ok(
    players[0].color.emoji === "🔴",
    "Player color icon should follow selected color.",
  );
  assert.ok(
    players[1].color.emoji === "🔵",
    "AI color icon should follow assigned color.",
  );
  assert.ok(
    unsortedPlayers.map((p) => p.id).join(",") === "0,1,2,3",
    "Players should be sorted clockwise by color.",
  );
  assert.ok(
    getMovableTokens(players[0], 5).length === 0,
    "Locked tokens should not move without a 6.",
  );
  assert.ok(
    getMovableTokens(players[0], 6).length === 4,
    "A 6 should unlock a token.",
  );
  assert.ok(
    tokenCanMove({ id: 0, position: 43, home: false }, 1) === true,
    "Exact roll should enter Home.",
  );
  assert.ok(
    tokenCanMove({ id: 0, position: 43, home: false }, 2) === false,
    "Too high roll should not enter Home.",
  );
  assert.ok(
    tokenTrackIndex(0, { position: 0, home: false }) === 0,
    "Red start track index should be 0.",
  );
  assert.ok(
    tokenTrackIndex(1, { position: 0, home: false }) === 10,
    "Blue start track index should be 10.",
  );
  assert.ok(
    homeLanePosition(0, { position: 40, home: false })?.join(",") === "5,1",
    "Red home lane should start at row 5 col 1.",
  );
  assert.ok(
    homeLanePosition(2, { position: 44, home: false })?.join(",") === "5,5",
    "Green final home lane should end in the center.",
  );
  assert.ok(
    SAFE_SQUARES.includes(0) && SAFE_SQUARES.includes(38),
    "Safe squares should include corner-related track starts.",
  );
  assert.ok(
    chooseAIToken(
      [
        { id: 0, position: -1 },
        { id: 1, position: 8 },
      ],
      6,
      players[1],
      players,
    )?.position === -1,
    "AI should unlock a token first when rolling 6.",
  );

  const attacker = createPlayers([
    { name: "AI", colorIndex: 0, isAI: true },
    { name: "Enemy", colorIndex: 1, isAI: false },
  ]);
  attacker[0].tokens[0].position = 5;
  attacker[0].tokens[1].position = 12;
  // The old fixture landed on safe square 10 and put the enemy on square 20.
  // Use an actual capturable enemy on square 11; the AI scoring is unchanged.
  attacker[1].tokens[0].position = 1;
  assert.ok(
    chooseAIToken(
      attacker[0].tokens.filter((token) => tokenCanMove(token, 6)),
      6,
      attacker[0],
      attacker,
    )?.id === 0,
    "AI should prefer an attack when dice lands on an enemy.",
  );
});
