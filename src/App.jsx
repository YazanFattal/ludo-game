import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dice5,
  Info,
  Play,
  Users,
  Volume2,
  RotateCcw,
  Maximize,
  Minimize,
  Moon,
  Sun,
} from "lucide-react";

const Button = ({ children, className = "", variant = "default", ...props }) => {
  const style =
    variant === "outline"
      ? "border border-slate-300 bg-white text-slate-800 hover:bg-slate-100"
      : "bg-indigo-600 text-white hover:bg-indigo-700";

  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center rounded-xl px-4 py-2 font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${style} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

const Card = ({ children, className = "" }) => (
  <div className={`rounded-3xl bg-white shadow-xl ${className}`}>{children}</div>
);

const CardContent = ({ children, className = "" }) => <div className={className}>{children}</div>;

const COLORS = [
  { name: "Red", bg: "bg-red-500", border: "border-red-600", soft: "bg-red-100", text: "text-red-700", emoji: "🔴" },
  { name: "Blue", bg: "bg-blue-500", border: "border-blue-600", soft: "bg-blue-100", text: "text-blue-700", emoji: "🔵" },
  { name: "Green", bg: "bg-green-500", border: "border-green-600", soft: "bg-green-100", text: "text-green-700", emoji: "🟢" },
  { name: "Yellow", bg: "bg-yellow-400", border: "border-yellow-500", soft: "bg-yellow-100", text: "text-yellow-700", emoji: "🟡" },
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

function playDiceSound(muted = false) {
  if (muted) return;

  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    [0, 0.08, 0.16, 0.24, 0.32].forEach((delay, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(220 + index * 80, now + delay);
      gain.gain.setValueAtTime(0.08, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + delay);
      osc.stop(now + delay + 0.07);
    });
  } catch (error) {
    console.log("Audio not supported", error);
  }
}

function playCaptureSound(muted = false) {
  if (muted) return;

  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;
    const notes = [660, 880, 1040, 1320];

    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + index * 0.08;
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.12, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.2);
    });
  } catch (error) {
    console.log("Capture audio not supported", error);
  }
}

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
      name: config.name?.trim() || (config.isAI ? `AI ${COLORS[colorIndex].name}` : "Funky Player"),
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
  if (!token || token.position < 0 || token.position >= TRACK_LENGTH || token.home) return null;
  return (START_OFFSETS[playerId] + token.position) % TRACK_LENGTH;
}

function homeLanePosition(playerId, token) {
  if (!token || token.position < TRACK_LENGTH || token.position > FINISH_POSITION || token.home) return null;

  const step = token.position - TRACK_LENGTH;
  const lanes = {
    0: [[5, 1], [5, 2], [5, 3], [5, 4], [5, 5]],
    1: [[1, 5], [2, 5], [3, 5], [4, 5], [5, 5]],
    2: [[5, 9], [5, 8], [5, 7], [5, 6], [5, 5]],
    3: [[9, 5], [8, 5], [7, 5], [6, 5], [5, 5]],
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

function chooseAIToken(movableTokensList, diceValue, aiPlayer, allPlayers = []) {
  if (!aiPlayer || movableTokensList.length === 0) return null;

  const scoreMove = (token) => {
    let score = 0;
    const currentPosition = token.position;
    const newPosition = currentPosition === -1 ? 0 : currentPosition + diceValue;
    const landedTrack = newPosition < TRACK_LENGTH ? (START_OFFSETS[aiPlayer.id] + newPosition) % TRACK_LENGTH : null;
    const currentTrack = currentPosition >= 0 && currentPosition < TRACK_LENGTH ? (START_OFFSETS[aiPlayer.id] + currentPosition) % TRACK_LENGTH : null;
    const currentlySafe = currentTrack !== null && SAFE_SQUARES.includes(currentTrack);
    const landingSafe = landedTrack !== null && SAFE_SQUARES.includes(landedTrack);

    if (newPosition >= FINISH_POSITION) score += 1000;

    if (landedTrack !== null && !landingSafe) {
      const enemiesOnTile = allPlayers
        .filter((player) => player.id !== aiPlayer.id)
        .flatMap((player) => player.tokens.map((enemyToken) => ({ player, enemyToken })))
        .filter(({ player, enemyToken }) => tokenTrackIndex(player.id, enemyToken) === landedTrack);

      if (enemiesOnTile.length > 0) {
        score += 750;
        const strongestEnemyPosition = Math.max(...enemiesOnTile.map(({ enemyToken }) => enemyToken.position));
        score += Math.max(0, strongestEnemyPosition) * 3;
      }
    }

    if (diceValue === 6 && currentPosition === -1) score += 420;
    score += newPosition * 6;
    if (landingSafe) score += 120;
    if (currentlySafe && !landingSafe && newPosition < FINISH_POSITION) score -= 70;

    const activeTokens = aiPlayer.tokens.filter((item) => item.position >= 0 && !item.home).length;
    if (activeTokens < 2 && diceValue === 6 && currentPosition === -1) score += 120;

    return score;
  };

  return [...movableTokensList].sort((a, b) => scoreMove(b) - scoreMove(a))[0];
}

function runLogicTests() {
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

  console.assert(players.length === 2, "createPlayers should create all player configs.");
  console.assert(players[0].isAI === false, "First player should be human.");
  console.assert(players[1].isAI === true, "Second player should be AI.");
  console.assert(players[0].tokens.length === 4, "Each player should start with 4 tokens.");
  console.assert(players[0].color.emoji === "🔴", "Player color icon should follow selected color.");
  console.assert(players[1].color.emoji === "🔵", "AI color icon should follow assigned color.");
  console.assert(unsortedPlayers.map((p) => p.id).join(",") === "0,1,2,3", "Players should be sorted clockwise by color.");
  console.assert(getMovableTokens(players[0], 5).length === 0, "Locked tokens should not move without a 6.");
  console.assert(getMovableTokens(players[0], 6).length === 4, "A 6 should unlock a token.");
  console.assert(tokenCanMove({ id: 0, position: 43, home: false }, 1) === true, "Exact roll should enter Home.");
  console.assert(tokenCanMove({ id: 0, position: 43, home: false }, 2) === false, "Too high roll should not enter Home.");
  console.assert(tokenTrackIndex(0, { position: 0, home: false }) === 0, "Red start track index should be 0.");
  console.assert(tokenTrackIndex(1, { position: 0, home: false }) === 10, "Blue start track index should be 10.");
  console.assert(homeLanePosition(0, { position: 40, home: false })?.join(",") === "5,1", "Red home lane should start at row 5 col 1.");
  console.assert(homeLanePosition(2, { position: 44, home: false })?.join(",") === "5,5", "Green final home lane should end in the center.");
  console.assert(SAFE_SQUARES.includes(0) && SAFE_SQUARES.includes(38), "Safe squares should include corner-related track starts.");
  console.assert(chooseAIToken([{ id: 0, position: -1 }, { id: 1, position: 8 }], 6, players[1], players)?.position === -1, "AI should unlock a token first when rolling 6.");

  const attacker = createPlayers([
    { name: "AI", colorIndex: 0, isAI: true },
    { name: "Enemy", colorIndex: 1, isAI: false },
  ]);
  attacker[0].tokens[0].position = 4;
  attacker[0].tokens[1].position = 12;
  attacker[1].tokens[0].position = 10;
  console.assert(chooseAIToken(attacker[0].tokens.filter((token) => tokenCanMove(token, 6)), 6, attacker[0], attacker)?.id === 0, "AI should prefer an attack when dice lands on an enemy.");
}

if (typeof window !== "undefined") {
  runLogicTests();
}

function ManualModal({ onClose }) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="flex max-h-[90dvh] w-full max-w-xl flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl"
        initial={{ scale: 0.92, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.92, y: 20 }}
      >
        <div className="border-b border-slate-100 p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-indigo-100 text-3xl shadow-lg">🎲</div>
            <div>
              <h2 className="text-2xl font-black text-slate-900">How to Play</h2>
              <p className="text-sm text-slate-500">Simple Ludo Rush guide</p>
            </div>
          </div>
        </div>

        <div className="overflow-y-auto p-5">
          <div className="space-y-3">
            <div className="rounded-3xl bg-indigo-50 p-4 ring-1 ring-indigo-100">
              <h3 className="mb-1 font-black text-indigo-700">🎲 Roll</h3>
              <p className="text-sm text-slate-700">Tap the dice when it is your turn.</p>
            </div>
            <div className="rounded-3xl bg-red-50 p-4 ring-1 ring-red-100">
              <h3 className="mb-1 font-black text-red-700">🔓 Unlock</h3>
              <p className="text-sm text-slate-700">Roll a <b>6</b> to unlock a token from your base.</p>
            </div>
            <div className="rounded-3xl bg-green-50 p-4 ring-1 ring-green-100">
              <h3 className="mb-1 font-black text-green-700">⚔️ Capture</h3>
              <p className="text-sm text-slate-700">Land on an opponent to send them back to base and get an extra roll.</p>
            </div>
            <div className="rounded-3xl bg-slate-100 p-4 ring-1 ring-slate-200">
              <h3 className="mb-1 font-black text-slate-700">★ Safe tiles</h3>
              <p className="text-sm text-slate-700">Grey star tiles are safe. Tokens cannot be captured there.</p>
            </div>
            <div className="rounded-3xl bg-amber-50 p-4 ring-1 ring-amber-100">
              <h3 className="mb-1 font-black text-amber-700">🏠 Home</h3>
              <p className="text-sm text-slate-700">Bring all 4 tokens to Home first to win the game.</p>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 bg-white p-4">
          <Button onClick={onClose} className="w-full rounded-2xl py-6 text-base">Start Game</Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function SetupScreen({ onStart }) {
  const [playerName, setPlayerName] = useState("");
  const [playerColorIndex, setPlayerColorIndex] = useState(0);
  const [aiCount, setAiCount] = useState(3);
  const [aiConfigs, setAiConfigs] = useState([
    { name: "AI Red" },
    { name: "AI Blue" },
    { name: "AI Green" },
    { name: "AI Yellow" },
  ]);

  const playerEmoji = COLORS[playerColorIndex].emoji;
  const remainingColorIndexes = COLORS.map((_, index) => index).filter((index) => index !== playerColorIndex);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-white to-amber-100 p-4 text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-4xl items-center justify-center">
        <Card className="w-full overflow-hidden rounded-[2rem] border-0 shadow-2xl">
          <CardContent className="grid gap-0 p-0 md:grid-cols-2">
            <div className="bg-slate-950 p-8 text-white">
              <div className="mb-8 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm"><Dice5 size={18} /> Ludo Rush</div>
              <h1 className="mb-4 text-5xl font-black leading-tight">Roll. Unlock. Capture.</h1>
              <p className="text-lg text-slate-300">A simple Ludo board game with 4 tokens, dice sound, captures, safe squares, and Home.</p>
              <div className="mt-8 grid grid-cols-2 gap-3">
                {COLORS.map((color) => (
                  <div key={color.name} className="rounded-2xl bg-white/10 p-4 text-center">
                    <div className={`mx-auto mb-2 h-10 w-10 rounded-full ${color.bg} shadow-lg`} />
                    <div className="mt-1 text-sm">{color.name}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="max-h-[92dvh] overflow-y-auto p-6 sm:p-8">
              <div className="mb-6 flex items-center gap-3"><Users className="text-indigo-600" /><h2 className="text-2xl font-bold">Game setup</h2></div>
              <label className="mb-2 block text-sm font-semibold text-slate-600">Choose your color</label>
              <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {COLORS.map((color, index) => (
                  <button
                    type="button"
                    key={color.name}
                    onClick={() => setPlayerColorIndex(index)}
                    className={`rounded-2xl border p-3 text-sm font-black transition ${playerColorIndex === index ? `${color.bg} border-slate-900 text-white shadow-lg` : `${color.soft} border-slate-200 text-slate-700 hover:scale-105`}`}
                  >
                    <div className={`mx-auto mb-2 h-9 w-9 rounded-full ${color.bg} shadow-md`} />
                    <div>{color.name}</div>
                  </button>
                ))}
              </div>

              <label className="mb-2 block text-sm font-semibold text-slate-600">AI opponents</label>
              <div className="mb-6 grid grid-cols-3 gap-2">
                {[1, 2, 3].map((number) => (
                  <button
                    type="button"
                    key={number}
                    onClick={() => setAiCount(number)}
                    className={`rounded-2xl border p-4 font-bold transition ${aiCount === number ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 bg-white hover:bg-slate-50"}`}
                  >
                    {number} AI
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-[80px_1fr] gap-3">
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-600">Icon</label>
                    <div className={`flex h-[58px] w-full items-center justify-center rounded-2xl border border-slate-200 text-2xl ${COLORS[playerColorIndex].soft}`}>
                      {playerEmoji}
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-600">Your player name</label>
                    <input
                      value={playerName}
                      onChange={(event) => setPlayerName(event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                      placeholder="Enter your funky name 😎"
                    />
                  </div>
                </div>

                {remainingColorIndexes.slice(0, aiCount).map((colorIndex) => (
                  <div key={colorIndex} className="grid grid-cols-[80px_1fr] gap-3 rounded-2xl bg-slate-50 p-3">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-600">AI color</label>
                      <div className={`flex h-[58px] w-full items-center justify-center rounded-2xl border border-slate-200 text-2xl ${COLORS[colorIndex].soft}`}>
                        {COLORS[colorIndex].emoji}
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-600">AI name</label>
                      <input
                        value={aiConfigs[colorIndex]?.name || `AI ${COLORS[colorIndex].name}`}
                        onChange={(event) => {
                          const next = [...aiConfigs];
                          next[colorIndex] = { ...next[colorIndex], name: event.target.value };
                          setAiConfigs(next);
                        }}
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <Button
                onClick={() => {
                  const playerConfigs = [
                    { name: playerName, colorIndex: playerColorIndex, isAI: false },
                    ...remainingColorIndexes.slice(0, aiCount).map((colorIndex) => ({
                      name: aiConfigs[colorIndex]?.name || `AI ${COLORS[colorIndex].name}`,
                      colorIndex,
                      isAI: true,
                    })),
                  ];
                  onStart({ players: createPlayers(playerConfigs) });
                }}
                className="mt-8 w-full rounded-2xl py-6 text-base"
              >
                <Play className="mr-2" size={18} /> Start game
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Dice({ value, rolling, onRoll, disabled, isAI, playerName, compact = false }) {
  const label = isAI ? `${playerName} is playing...` : "Your turn";
  const helper = isAI ? "AI rolling" : "Click to roll";

  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider shadow-lg ${isAI ? "bg-slate-900 text-white" : "bg-white text-indigo-700"}`}>{label}</div>
      <motion.button
        type="button"
        onClick={() => onRoll(false)}
        disabled={disabled}
        animate={rolling ? { rotate: [0, -16, 16, -10, 10, 0], scale: [1, 1.12, 1] } : { rotate: 0, scale: 1 }}
        transition={{ duration: 0.45 }}
        whileHover={{ scale: disabled ? 1 : 1.06 }}
        whileTap={{ scale: 0.92 }}
        className={`relative flex ${compact ? "h-12 w-12 rounded-2xl text-2xl" : "h-16 w-16 rounded-3xl text-3xl"} items-center justify-center border-[4px] border-white bg-gradient-to-br from-indigo-500 to-purple-700 font-black text-white shadow-2xl transition ${disabled ? "opacity-60" : "cursor-pointer hover:shadow-indigo-400/60"}`}
      >
        <div className="absolute inset-2 rounded-2xl border border-white/20" />
        <span className="relative z-10 drop-shadow-lg">{rolling ? "?" : value || "🎲"}</span>
      </motion.button>
      {!compact && <div className="rounded-full bg-indigo-600 px-3 py-1 text-[10px] font-bold text-white shadow-lg">{helper}</div>}
    </div>
  );
}

function tokenStackLayout(count) {
  if (count <= 1) return "flex items-center justify-center";
  if (count === 2) return "grid grid-cols-2 place-items-center gap-[2px]";
  return "grid grid-cols-2 grid-rows-2 place-items-center gap-[1px]";
}

function tokenSizeClass(count) {
  if (count <= 1) return "h-7 w-7 text-sm";
  if (count === 2) return "h-6 w-6 text-xs";
  return "h-5 w-5 text-[10px]";
}

function Board({ players, activePlayerId, movableTokens, onTokenClick, expanded = false }) {
  const baseAreas = {
    red: { rows: [1, 2], cols: [1, 2], color: COLORS[0], playerId: 0 },
    blue: { rows: [1, 2], cols: [8, 9], color: COLORS[1], playerId: 1 },
    green: { rows: [8, 9], cols: [8, 9], color: COLORS[2], playerId: 2 },
    yellow: { rows: [8, 9], cols: [1, 2], color: COLORS[3], playerId: 3 },
  };

  const homeLaneCells = [
    { row: 1, col: 5, color: COLORS[1] }, { row: 2, col: 5, color: COLORS[1] }, { row: 3, col: 5, color: COLORS[1] },
    { row: 5, col: 1, color: COLORS[0] }, { row: 5, col: 2, color: COLORS[0] }, { row: 5, col: 3, color: COLORS[0] },
    { row: 5, col: 7, color: COLORS[2] }, { row: 5, col: 8, color: COLORS[2] }, { row: 5, col: 9, color: COLORS[2] },
    { row: 7, col: 5, color: COLORS[3] }, { row: 8, col: 5, color: COLORS[3] }, { row: 9, col: 5, color: COLORS[3] },
  ];

  const piecesAtCell = (trackIndex) => players.flatMap((player) =>
    player.tokens.filter((token) => tokenTrackIndex(player.id, token) === trackIndex).map((token) => ({ player, token }))
  );

  const homePiecesAtCell = (row, col) => players.flatMap((player) =>
    player.tokens
      .filter((token) => {
        const lane = homeLanePosition(player.id, token);
        return lane && lane[0] === row && lane[1] === col;
      })
      .map((token) => ({ player, token }))
  );

  const getBase = (row, col) => Object.values(baseAreas).find((area) => area.rows.includes(row) && area.cols.includes(col));
  const getHomeLane = (row, col) => homeLaneCells.find((cell) => cell.row === row && cell.col === col);
  const isMovable = (token) => movableTokens.some((moveToken) => moveToken.id === token.id);

  return (
    <div className={`relative aspect-square w-full overflow-hidden rounded-[1.7rem] bg-white shadow-2xl ring-4 ring-slate-900/10 ${expanded ? "p-3" : "p-2"}`}>
      <div className={`grid h-full w-full grid-cols-11 grid-rows-11 rounded-[1.5rem] bg-slate-200 ${expanded ? "gap-[6px] p-2" : "gap-1 p-1"}`}>
        {Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => {
          const row = Math.floor(index / BOARD_SIZE);
          const col = index % BOARD_SIZE;
          const trackIndex = TRACK.findIndex(([r, c]) => r === row && c === col);
          const isTrack = trackIndex !== -1;
          const pieces = isTrack ? piecesAtCell(trackIndex) : [];
          const homePieces = homePiecesAtCell(row, col);
          const base = getBase(row, col);
          const homeLane = getHomeLane(row, col);
          const isCenter = row >= 4 && row <= 6 && col >= 4 && col <= 6;
          const isCenterCore = row === 5 && col === 5;
          const isSafe = SAFE_SQUARES.includes(trackIndex);
          const isRedCorner = row === 0 && col === 0;
          const isBlueCorner = row === 0 && col === 10;
          const isYellowCorner = row === 10 && col === 0;
          const isGreenCorner = row === 10 && col === 10;

          let cellClass = "bg-white";
          if (base) cellClass = `${base.color.soft} ring-1 ring-white/60`;
          if (homeLane) cellClass = `${homeLane.color.bg} shadow-inner`;
          if (isCenter) cellClass = "bg-slate-900";
          if (isTrack) cellClass = "bg-white";
          if (isSafe) cellClass = "bg-slate-200 ring-2 ring-slate-300";
          if (isRedCorner) cellClass = "bg-red-200 ring-2 ring-red-400";
          if (isBlueCorner) cellClass = "bg-blue-200 ring-2 ring-blue-400";
          if (isYellowCorner) cellClass = "bg-yellow-200 ring-2 ring-yellow-400";
          if (isGreenCorner) cellClass = "bg-green-200 ring-2 ring-green-400";

          const basePlayer = base ? players.find((p) => p.id === base.playerId) : null;
          const lockedTokens = basePlayer ? basePlayer.tokens.filter((t) => t.position === -1) : [];
          const baseCellIndex = base ? (base.rows.indexOf(row) * base.cols.length + base.cols.indexOf(col)) : -1;
          const baseToken = basePlayer ? lockedTokens[baseCellIndex] : null;
          const shouldRenderBaseToken = Boolean(base && basePlayer && baseToken);

          return (
            <div key={`${row}-${col}`} className={`relative flex items-center justify-center rounded-lg ${cellClass} shadow-sm`}>
              {base && <div className="absolute inset-1 rounded-xl bg-white/30 shadow-inner" />}

              {shouldRenderBaseToken && (
                <button
                  type="button"
                  key={`${basePlayer.id}-base-${baseToken.id}`}
                  onClick={() => basePlayer.id === activePlayerId && !basePlayer.isAI && onTokenClick(baseToken.id)}
                  className={`z-20 flex h-6 w-6 items-center justify-center rounded-full border-2 ${basePlayer.color.bg} ${basePlayer.color.border} text-xs shadow-md ${basePlayer.id === activePlayerId && isMovable(baseToken) ? "animate-pulse ring-2 ring-indigo-300" : ""}`}
                >
                  {basePlayer.color.emoji}
                </button>
              )}

              {isCenterCore && (
                <div className="z-20 flex flex-col items-center justify-center text-center">
                  <span className="text-2xl">🏁</span>
                  
                </div>
              )}

              {isSafe && pieces.length === 0 && (
                <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-slate-400 bg-slate-100 shadow-sm">
                  <span className="text-xs font-black text-slate-500">★</span>
                </div>
              )}

              {((isTrack && pieces.length > 0) || homePieces.length > 0) && (() => {
                const visibleTokens = [...pieces, ...homePieces];
                return (
                  <div className={`z-20 h-full w-full ${tokenStackLayout(visibleTokens.length)}`}>
                    {visibleTokens.map(({ player, token }) => (
                      <button
                        type="button"
                        key={`${player.id}-${token.id}`}
                        onClick={() => player.id === activePlayerId && !player.isAI && onTokenClick(token.id)}
                        className={`flex ${tokenSizeClass(visibleTokens.length)} items-center justify-center rounded-full border-2 ${player.color.bg} ${player.color.border} shadow-md transition ${player.id === activePlayerId && isMovable(token) ? "scale-110 animate-pulse ring-2 ring-indigo-300" : ""}`}
                        title={`${player.name} token ${token.id + 1}`}
                      >
                        <div className={`h-full w-full rounded-full ${player.color.bg}`} />
                      </button>
                    ))}
                  </div>
                );
              })()}

              {isTrack && pieces.length === 0 && !isSafe && <span className="text-lg text-slate-300">●</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GameScreen({ gameData, onReset }) {
  const [players, setPlayers] = useState(gameData.players);
  const [currentPlayer, setCurrentPlayer] = useState(0);
  const [dice, setDice] = useState(null);
  const [rolling, setRolling] = useState(false);
  const [waitingForMove, setWaitingForMove] = useState(false);
  const [message, setMessage] = useState("Roll the dice to start!");
  const [showManual, setShowManual] = useState(true);
  const [soundMuted, setSoundMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [expandedBoard, setExpandedBoard] = useState(false);
  const [nightMode, setNightMode] = useState(true);

  const active = players[currentPlayer];
  const winner = players.find((player) => player.tokens.every((token) => token.home));
  const movableTokens = waitingForMove ? getMovableTokens(active, dice) : [];

  async function toggleFullscreen() {
    setExpandedBoard((old) => !old);

    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
        setFullscreen(true);
      } else if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
        setFullscreen(false);
      }
    } catch (error) {
      console.log("Native fullscreen not available, using in-game expand mode", error);
    }
  }

  function nextTurn(updatedPlayers = players) {
    setDice(null);
    setWaitingForMove(false);
    setPlayers(updatedPlayers.map((p, index) => (index === currentPlayer ? { ...p, consecutiveSixes: 0 } : p)));
    setCurrentPlayer((old) => (old + 1) % updatedPlayers.length);
  }

  function rollDice(isAutoRoll = false) {
    const currentActive = players[currentPlayer];

    if (isAutoRoll && !currentActive?.isAI) return;
    if (!isAutoRoll && currentActive?.isAI) return;
    if (rolling || winner || waitingForMove) return;

    setRolling(true);
    setMessage(`${currentActive.name} is rolling...`);
    playDiceSound(soundMuted);

    setTimeout(() => {
      const value = Math.floor(Math.random() * 6) + 1;
      setDice(value);

      const newSixCount = value === 6 ? currentActive.consecutiveSixes + 1 : 0;

      if (newSixCount >= 3) {
        const reset = players.map((p, index) => (index === currentPlayer ? { ...p, consecutiveSixes: 0 } : p));
        setPlayers(reset);
        setMessage(`❌ ${currentActive.name} rolled 6-6-6. Turn cancelled.`);
        setCurrentPlayer((old) => (old + 1) % players.length);
        setDice(null);
        setWaitingForMove(false);
        setRolling(false);
        return;
      }

      const playerWithSixCount = { ...currentActive, consecutiveSixes: newSixCount };
      const legalMoves = getMovableTokens(playerWithSixCount, value);
      const updated = players.map((p, index) => (index === currentPlayer ? playerWithSixCount : p));
      setPlayers(updated);

      if (legalMoves.length === 0) {
        setMessage(`No legal move for ${currentActive.name}. Turn skipped.`);
        setRolling(false);
        setTimeout(() => nextTurn(updated), 650);
        return;
      }

      setMessage(`🎲 ${currentActive.name} rolled ${value}. Choose a highlighted token.`);
      setWaitingForMove(true);
      setRolling(false);
    }, 700);
  }

  function moveToken(tokenId) {
    if (!waitingForMove || winner) return;

    const current = players[currentPlayer];
    const token = current.tokens.find((t) => t.id === tokenId);
    if (!tokenCanMove(token, dice)) return;

    let captured = false;
    let reachedHome = false;
    let movedTo = token.position === -1 ? 0 : token.position + dice;

    let updatedPlayers = players.map((player, playerIndex) => {
      if (playerIndex !== currentPlayer) {
        return { ...player, tokens: player.tokens.map((t) => ({ ...t })) };
      }

      return {
        ...player,
        tokens: player.tokens.map((t) => (t.id === tokenId ? { ...t, position: movedTo, home: movedTo >= FINISH_POSITION } : { ...t })),
      };
    });

    reachedHome = movedTo >= FINISH_POSITION;
    const landedTrack = movedTo < TRACK_LENGTH ? (START_OFFSETS[current.id] + movedTo) % TRACK_LENGTH : null;

    if (landedTrack !== null && !SAFE_SQUARES.includes(landedTrack)) {
      updatedPlayers = updatedPlayers.map((player, playerIndex) => {
        if (playerIndex === currentPlayer) return player;

        return {
          ...player,
          tokens: player.tokens.map((enemyToken) => {
            if (tokenTrackIndex(player.id, enemyToken) === landedTrack) {
              captured = true;
              return { ...enemyToken, position: -1, home: false };
            }
            return enemyToken;
          }),
        };
      });
    }

    if (captured) {
      playCaptureSound(soundMuted);
      movedTo = Math.min(movedTo + CAPTURE_BONUS, FINISH_POSITION);
      reachedHome = movedTo >= FINISH_POSITION;

      updatedPlayers = updatedPlayers.map((player, playerIndex) => {
        if (playerIndex !== currentPlayer) return player;

        return {
          ...player,
          tokens: player.tokens.map((t) => (t.id === tokenId ? { ...t, position: movedTo, home: reachedHome } : t)),
        };
      });
    }

    setPlayers(updatedPlayers);
    setWaitingForMove(false);

    if (captured) setMessage(`⚔️ ${current.name} captured a token and gained +20 steps! Extra roll.`);
    else if (reachedHome) setMessage(`🏠 ${current.name} brought a token Home! Extra roll.`);
    else if (dice === 6) setMessage(`🎁 ${current.name} rolled a 6. Extra roll.`);
    else setMessage(`${current.name} moved ${dice} steps.`);

    const extraRoll = dice === 6 || captured || reachedHome;
    setDice(null);

    if (!extraRoll) {
      setTimeout(() => nextTurn(updatedPlayers), 650);
    } else {
      setWaitingForMove(false);
    }
  }

  useEffect(() => {
    if (!waitingForMove || rolling || winner) return undefined;

    if (movableTokens.length === 0) {
      const timer = setTimeout(() => {
        setMessage(`No legal move for ${active.name}. Turn skipped.`);
        nextTurn(players);
      }, 500);
      return () => clearTimeout(timer);
    }

    return undefined;
  }, [waitingForMove, rolling, winner, movableTokens.length, active.name]);

  useEffect(() => {
    if (!active?.isAI || winner || rolling) return undefined;

    if (!waitingForMove && dice === null) {
      const timer = setTimeout(() => rollDice(true), 2000);
      return () => clearTimeout(timer);
    }

    if (waitingForMove && movableTokens.length > 0) {
      const timer = setTimeout(() => {
        const tokenToMove = chooseAIToken(movableTokens, dice, active, players);
        if (tokenToMove) moveToken(tokenToMove.id);
      }, 2000);
      return () => clearTimeout(timer);
    }

    return undefined;
  }, [active?.id, active?.isAI, waitingForMove, dice, rolling, winner, movableTokens.length]);

  const shellClass = nightMode
    ? "bg-slate-950 bg-[radial-gradient(circle_at_top,#1e3a8a55,transparent_35%),radial-gradient(circle_at_bottom,#7c3aed44,transparent_35%)]"
    : "bg-gradient-to-br from-sky-100 via-white to-yellow-100";

  const frameClass = nightMode
    ? "border-white/10 bg-slate-100/95 shadow-black/50"
    : "border-slate-200 bg-white/95 shadow-slate-400/40";

  return (
    <div className={`h-[100dvh] overflow-hidden p-2 text-slate-900 ${shellClass}`}>
      <AnimatePresence>{showManual && <ManualModal onClose={() => setShowManual(false)} />}</AnimatePresence>

      <div className={`mx-auto flex h-full w-full max-w-[430px] flex-col gap-1 overflow-hidden rounded-[2rem] border p-2 shadow-2xl ${frameClass}`}>
        <div className="rounded-3xl bg-white p-2 shadow-lg">
          <div className="flex items-center justify-between gap-1">
            <div>
              <h1 className="text-xl font-black leading-none">Ludo Rush</h1>
              <p className="mt-1 text-[11px] leading-tight text-slate-500">Choose your color, name, and challenge the AI.</p>
            </div>

            <div className="flex items-center gap-2">
              <div className="grid grid-cols-2 gap-1">
                <Button variant="outline" onClick={() => setSoundMuted((old) => !old)} className="rounded-xl px-3 py-2 text-xs">
                  {soundMuted ? "🔇" : "🔊"}
                </Button>
                <Button variant="outline" onClick={() => setShowManual(true)} className="rounded-xl px-3 py-2 text-xs">
                  <Info size={14} />
                </Button>
                <Button variant="outline" onClick={toggleFullscreen} className="rounded-xl px-3 py-2 text-xs">
                  {expandedBoard ? <Minimize size={14} /> : <Maximize size={14} />}
                </Button>
                <Button variant="outline" onClick={() => setNightMode((old) => !old)} className="rounded-xl px-3 py-2 text-xs">
                  {nightMode ? <Sun size={14} /> : <Moon size={14} />}
                </Button>
              </div>

              <Dice
                value={dice}
                rolling={rolling}
                onRoll={rollDice}
                disabled={rolling || Boolean(winner) || waitingForMove || active.isAI}
                isAI={active.isAI}
                playerName={active.name}
              />
            </div>
          </div>
        </div>

        <Card className="rounded-3xl border-0 shadow-lg">
          <CardContent className="p-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-semibold text-slate-500">Current turn</p>
                <h2 className={`text-base font-black leading-tight ${active.color.text}`}>{active.color.emoji} {active.name}</h2>
              </div>
              <Volume2 className="text-slate-400" size={18} />
            </div>
          </CardContent>
        </Card>

        <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
          <Board players={players} activePlayerId={active.id} movableTokens={movableTokens} onTokenClick={moveToken} />
        </div>

        {expandedBoard && (
          <div className="fixed inset-0 z-[80] flex h-[100dvh] flex-col items-center justify-center overflow-hidden bg-slate-950 p-2">
            <div className="mb-2 flex w-full max-w-[520px] items-center justify-between gap-2 rounded-2xl bg-white/10 px-3 py-2 text-white">
              <div className="flex min-w-0 items-center gap-2">
                <span className="text-xl">🎲</span>
                <div className="min-w-0">
                  <p className="text-[10px] text-white/60">Expanded board</p>
                  <p className={`truncate text-base font-black ${active.color.text}`}>{active.color.emoji} {active.name}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Dice
                  value={dice}
                  rolling={rolling}
                  onRoll={rollDice}
                  disabled={rolling || Boolean(winner) || waitingForMove || active.isAI}
                  isAI={active.isAI}
                  playerName={active.name}
                  compact
                />
                <button
                  type="button"
                  onClick={() => setExpandedBoard(false)}
                  className="rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-900"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="w-full max-w-[520px] overflow-hidden rounded-[1.7rem]">
              <Board players={players} activePlayerId={active.id} movableTokens={movableTokens} onTokenClick={moveToken} expanded />
            </div>

            <p className="mt-2 w-full max-w-[520px] truncate rounded-2xl bg-white/10 px-3 py-2 text-center text-xs font-bold text-white/80">{message}</p>
          </div>
        )}

        <Card className="rounded-3xl border-0 shadow-lg">
          <CardContent className="p-2">
            <p className="mb-1 truncate rounded-xl bg-slate-100 px-2 py-1 text-center text-[10px] font-medium text-slate-700">{message}</p>
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-sm font-black">Players</h3>
              {winner && <Button onClick={onReset} className="rounded-xl px-3 py-1 text-xs"><RotateCcw size={14} className="mr-1" /> New</Button>}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(() => {
               const displayPlayers = [
                players[0],
                 players[1],
                   players[3],
                     players[2],
                        ].filter(Boolean);

              return displayPlayers.map((player) => {
                const index = players.findIndex((p) => p.id === player.id);
                const homeCount = player.tokens.filter((t) => t.home).length;
                const lockedCount = player.tokens.filter((t) => t.position === -1).length;
                const isCurrent = index === currentPlayer;

                                return (
                  <motion.div
                    key={player.id}
                    animate={isCurrent ? { scale: 1, opacity: 1 } : { scale: 0.98, opacity: 0.45 }}
                    transition={{ duration: 0.2 }}
                    className={`rounded-2xl p-2 ${player.color.soft} ${isCurrent ? "ring-2 ring-indigo-400 shadow-md" : "grayscale"}`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`flex h-7 w-7 items-center justify-center rounded-full ${player.color.bg} text-xs`}>
                        <div className={`h-full w-full rounded-full ${player.color.bg}`} />
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold">{player.name}</p>
                        <p className="text-[10px] text-slate-600">
                          L:{lockedCount} • H:{homeCount}/4
                        </p>
                      </div>
                    </div>
                  </motion.div>
                );
              });
            })()}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function App() {
  useEffect(() => {
    const favicon = document.querySelector("link[rel='icon']") || document.createElement("link");
    favicon.setAttribute("rel", "icon");
    favicon.setAttribute("href", "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><text y='50' font-size='50'>🎲</text></svg>");
    document.head.appendChild(favicon);
  }, []);

  const [gameData, setGameData] = useState(null);
  const gameKey = useMemo(() => (gameData ? gameData.players.map((p) => p.name).join("-") : "setup"), [gameData]);

  if (!gameData) return <SetupScreen onStart={setGameData} />;
  return <GameScreen key={gameKey} gameData={gameData} onReset={() => setGameData(null)} />;
}
