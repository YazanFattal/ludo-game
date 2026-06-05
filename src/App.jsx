import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dice5, Info, Play, Users, Volume2, Trophy, RotateCcw, MousePointer2 } from "lucide-react";
const Button = ({ children, className = "", ...props }) => (
  <button
    className={`rounded-xl bg-indigo-600 px-4 py-2 font-bold text-white hover:bg-indigo-700 transition ${className}`}
    {...props}
  >
    {children}
  </button>
);

const Card = ({ children, className = "" }) => (
  <div className={`rounded-3xl bg-white shadow-xl ${className}`}>
    {children}
  </div>
);

const CardContent = ({ children, className = "" }) => (
  <div className={className}>{children}</div>
);
const COLORS = [
  { name: "Red", bg: "bg-red-500", border: "border-red-600", soft: "bg-red-100", text: "text-red-700", emoji: "🐉" },
  { name: "Blue", bg: "bg-blue-500", border: "border-blue-600", soft: "bg-blue-100", text: "text-blue-700", emoji: "🦈" },
  { name: "Green", bg: "bg-green-500", border: "border-green-600", soft: "bg-green-100", text: "text-green-700", emoji: "🐢" },
  { name: "Yellow", bg: "bg-yellow-400", border: "border-yellow-500", soft: "bg-yellow-100", text: "text-yellow-700", emoji: "🦁" },
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

function playDiceSound() {
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

function playCaptureSound() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    const notes = [660, 880, 1040, 1320];

    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq, now + index * 0.08);

      gain.gain.setValueAtTime(0.12, now + index * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.08 + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + index * 0.08);
      osc.stop(now + index * 0.08 + 0.2);
    });
  } catch (error) {
    console.log("Capture audio not supported", error);
  }
}

function createPlayers(count, names) {
  return Array.from({ length: count }, (_, index) => ({
    id: index,
    name: names[index]?.trim() || `Player ${index + 1}`,
    isAI: index !== 0,
    color: COLORS[index],
    consecutiveSixes: 0,
    tokens: Array.from({ length: 4 }, (_, tokenIndex) => ({
      id: tokenIndex,
      position: -1,
      home: false,
    })),
  }));
}

function tokenTrackIndex(playerId, token) {
  if (!token || token.position < 0 || token.position >= TRACK_LENGTH || token.home) return null;
  return (START_OFFSETS[playerId] + token.position) % TRACK_LENGTH;
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

function runLogicTests() {
  const players = createPlayers(2, ["A", "B"]);
  console.assert(players[0].tokens.length === 4, "Each player should start with 4 tokens.");
  console.assert(getMovableTokens(players[0], 5).length === 0, "Locked tokens should not move without a 6.");
  console.assert(getMovableTokens(players[0], 6).length === 4, "A 6 should unlock a token.");
  console.assert(tokenCanMove({ id: 0, position: 43, home: false }, 1) === true, "Exact roll should enter Home.");
  console.assert(tokenCanMove({ id: 0, position: 43, home: false }, 2) === false, "Too high roll should not enter Home.");
  console.assert(tokenTrackIndex(0, { position: 0, home: false }) === 0, "Red start track index should be 0.");
  console.assert(tokenTrackIndex(1, { position: 0, home: false }) === 10, "Blue start track index should be 10.");
}

if (typeof window !== "undefined") {
  runLogicTests();
}

function ManualModal({ onClose }) {
  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl" initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}>
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-2xl bg-indigo-100 p-3 text-indigo-700"><Info size={26} /></div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">How to play Ludo Rush</h2>
            <p className="text-sm text-slate-500">Core Ludo rules 🎲</p>
          </div>
        </div>

        <div className="space-y-3 text-slate-700">
          <p>Each player starts with 4 locked tokens in Base.</p>
          <p>Roll a 6 to unlock a token. Rolling a 6 gives one extra roll.</p>
          <p>Three 6s in a row cancels your turn.</p>
          <p>Move clockwise. You need the exact number to enter Home.</p>
          <p>Landing on an opponent captures them and sends them back to Base.</p>
          <p>Capturing gives an extra roll and a +20 step bonus.</p>
          <p>Star squares are safe. Tokens cannot be captured there.</p>
          <p className="rounded-2xl bg-slate-100 p-3 text-sm">After rolling, click one highlighted token to move it.</p>
        </div>

        <Button onClick={onClose} className="mt-6 w-full rounded-2xl py-6 text-base">Got it, start the game</Button>
      </motion.div>
    </motion.div>
  );
}

function SetupScreen({ onStart }) {
  const [playerName, setPlayerName] = useState("Yazan");
  const [aiCount, setAiCount] = useState(3);

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
                    <div className="text-3xl">{color.emoji}</div>
                    <div className="mt-1 text-sm">{color.name}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-8">
              <div className="mb-6 flex items-center gap-3"><Users className="text-indigo-600" /><h2 className="text-2xl font-bold">Game setup</h2></div>

              <label className="mb-2 block text-sm font-semibold text-slate-600">AI opponents</label>
              <div className="mb-6 grid grid-cols-3 gap-2">
                {[1, 2, 3].map((number) => (
                  <button
                    key={number}
                    onClick={() => setAiCount(number)}
                    className={`rounded-2xl border p-4 font-bold transition ${aiCount === number ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 bg-white hover:bg-slate-50"}`}
                  >
                    {number} AI
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-600">🎮 Your player name</label>
                  <input
                    value={playerName}
                    onChange={(event) => setPlayerName(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                    placeholder="Your name"
                  />
                </div>
              </div>

              <Button onClick={() => {
                  const aiNames = ["AI Dragon", "AI Shark", "AI Turtle"];
                  const names = [playerName, ...aiNames.slice(0, aiCount)];
                  onStart({ players: createPlayers(aiCount + 1, names) });
                }} className="mt-8 w-full rounded-2xl py-6 text-base"><Play className="mr-2" size={18} /> Start game</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Dice({ value, rolling }) {
   return (
    <div className="flex h-[120px] w-[120px] shrink-0 items-center justify-center">
      <motion.div
        animate={
          rolling
            ? { rotate: [0, 20, -20, 360], scale: [1, 1.08, 0.96, 1] }
            : { rotate: 0, scale: 1 }
        }
        transition={{ duration: 0.5 }}
        className="flex h-24 w-24 items-center justify-center rounded-3xl bg-white text-5xl font-black shadow-xl ring-1 ring-slate-200"
      >
        {rolling ? "🎲" : value || "?"}
      </motion.div>
    </div>
  );
}

function Board({ players, activePlayerId, movableTokens, onTokenClick }) {
  const baseAreas = {
    red: { rows: [0, 1, 2, 3], cols: [0, 1, 2, 3], color: COLORS[0], playerId: 0, renderCell: [1, 1] },
    blue: { rows: [0, 1, 2, 3], cols: [7, 8, 9, 10], color: COLORS[1], playerId: 1, renderCell: [1, 8] },
    green: { rows: [7, 8, 9, 10], cols: [7, 8, 9, 10], color: COLORS[2], playerId: 2, renderCell: [8, 8] },
    yellow: { rows: [7, 8, 9, 10], cols: [0, 1, 2, 3], color: COLORS[3], playerId: 3, renderCell: [8, 1] },
  };

  const homeLaneCells = [
    { row: 1, col: 5, color: COLORS[1] }, { row: 2, col: 5, color: COLORS[1] }, { row: 3, col: 5, color: COLORS[1] },
    { row: 5, col: 1, color: COLORS[0] }, { row: 5, col: 2, color: COLORS[0] }, { row: 5, col: 3, color: COLORS[0] },
    { row: 5, col: 7, color: COLORS[2] }, { row: 5, col: 8, color: COLORS[2] }, { row: 5, col: 9, color: COLORS[2] },
    { row: 7, col: 5, color: COLORS[3] }, { row: 8, col: 5, color: COLORS[3] }, { row: 9, col: 5, color: COLORS[3] },
  ];

  const piecesAtCell = (trackIndex) => {
    return players.flatMap((player) =>
      player.tokens
        .filter((token) => tokenTrackIndex(player.id, token) === trackIndex)
        .map((token) => ({ player, token }))
    );
  };

  const getBase = (row, col) => Object.values(baseAreas).find((area) => area.rows.includes(row) && area.cols.includes(col));
  const getHomeLane = (row, col) => homeLaneCells.find((cell) => cell.row === row && cell.col === col);
  const isMovable = (token) => movableTokens.some((moveToken) => moveToken.id === token.id);

  return (
    <div className="relative aspect-square w-full max-w-[650px] overflow-hidden rounded-[2rem] bg-white p-3 shadow-2xl ring-8 ring-slate-900/10">
      <div className="grid h-full w-full grid-cols-11 grid-rows-11 gap-1 rounded-[1.5rem] bg-slate-200 p-1">
        {Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => {
          const row = Math.floor(index / BOARD_SIZE);
          const col = index % BOARD_SIZE;
          const trackIndex = TRACK.findIndex(([r, c]) => r === row && c === col);
          const isTrack = trackIndex !== -1;
          const pieces = isTrack ? piecesAtCell(trackIndex) : [];
          const base = getBase(row, col);
          const homeLane = getHomeLane(row, col);
          const isCenter = row >= 4 && row <= 6 && col >= 4 && col <= 6;
          const isCenterCore = row === 5 && col === 5;
          const isSafe = SAFE_SQUARES.includes(trackIndex);

          let cellClass = "bg-white";
          if (base) cellClass = `${base.color.soft}`;
          if (homeLane) cellClass = `${homeLane.color.bg}`;
          if (isCenter) cellClass = "bg-slate-900";
          if (isTrack) cellClass = "bg-white";
          if (isSafe) cellClass = "bg-amber-100";

          const basePlayer = base ? players.find((p) => p.id === base.playerId) : null;
          const lockedTokens = basePlayer ? basePlayer.tokens.filter((t) => t.position === -1) : [];
          const shouldRenderBaseTokens = base && basePlayer && base.renderCell[0] === row && base.renderCell[1] === col;

          return (
            <div key={`${row}-${col}`} className={`relative flex items-center justify-center rounded-lg ${cellClass} shadow-sm`}>
              {base && <div className="absolute inset-1 rounded-xl bg-white/30 shadow-inner" />}

              {shouldRenderBaseTokens && lockedTokens.length > 0 && (
                <div className="z-20 grid grid-cols-2 gap-1 rounded-2xl bg-white/80 p-1 shadow-inner">
                  {lockedTokens.map((token) => (
                    <button
                      type="button"
                      key={`${basePlayer.id}-base-${token.id}`}
                      onClick={() => basePlayer.id === activePlayerId && !basePlayer.isAI && onTokenClick(token.id)}
                      className={`flex h-7 w-7 items-center justify-center rounded-full border-2 ${basePlayer.color.bg} ${basePlayer.color.border} text-base shadow-lg ${basePlayer.id === activePlayerId && isMovable(token) ? "animate-pulse ring-4 ring-indigo-300" : ""}`}
                    >
                      {basePlayer.color.emoji}
                    </button>
                  ))}
                </div>
              )}

              {isCenterCore && <span className="z-20 text-3xl">🏁</span>}
              {isSafe && pieces.length === 0 && <span className="text-sm font-black text-amber-600">★</span>}

              {isTrack && pieces.length > 0 && (
                <div className="z-20 flex flex-wrap items-center justify-center gap-1">
                  {pieces.map(({ player, token }) => (
                    <button
                      type="button"
                      key={`${player.id}-${token.id}`}
                      onClick={() => player.id === activePlayerId && !player.isAI && onTokenClick(token.id)}
                      className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${player.color.bg} ${player.color.border} text-lg shadow-lg transition ${player.id === activePlayerId && isMovable(token) ? "scale-110 animate-pulse ring-4 ring-indigo-300" : ""}`}
                      title={`${player.name} token ${token.id + 1}`}
                    >
                      {player.color.emoji}
                    </button>
                  ))}
                </div>
              )}

              {isTrack && pieces.length === 0 && !isSafe && <span className="text-lg text-slate-300">●</span>}
            </div>
          );
        })}
      </div>

      <div className="pointer-events-none absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-3xl bg-white shadow-xl ring-4 ring-slate-200" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 flex h-28 w-28 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-slate-950 text-4xl shadow-2xl">🏆</div>
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

  const active = players[currentPlayer];
  const winner = players.find((player) => player.tokens.every((token) => token.home));
  const movableTokens = waitingForMove ? getMovableTokens(active, dice) : [];

  React.useEffect(() => {
    if (!active?.isAI || winner || rolling) return;

    if (!waitingForMove && dice === null) {
      const timer = setTimeout(() => rollDice(), 800);
      return () => clearTimeout(timer);
    }

    if (waitingForMove && movableTokens.length > 0) {
      const timer = setTimeout(() => {
        const tokenToMove = movableTokens.find((token) => token.position >= 0) || movableTokens[0];
        moveToken(tokenToMove.id);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [active?.id, active?.isAI, waitingForMove, dice, rolling, winner, movableTokens.length]);

  function nextTurn(updatedPlayers = players) {
    setDice(null);
    setWaitingForMove(false);
    setPlayers(updatedPlayers.map((p, index) => (index === currentPlayer ? { ...p, consecutiveSixes: 0 } : p)));
    setCurrentPlayer((old) => (old + 1) % updatedPlayers.length);
  }

  function rollDice() {
    if (rolling || winner || waitingForMove) return;

    setRolling(true);
    setMessage(`${active.name} is rolling...`);
    playDiceSound();

    setTimeout(() => {
      const value = Math.floor(Math.random() * 6) + 1;
      setDice(value);

      const newSixCount = value === 6 ? active.consecutiveSixes + 1 : 0;

      if (newSixCount >= 3) {
        const reset = players.map((p, index) => (index === currentPlayer ? { ...p, consecutiveSixes: 0 } : p));
        setPlayers(reset);
        setMessage(`❌ ${active.name} rolled 6-6-6. Turn cancelled.`);
        setCurrentPlayer((old) => (old + 1) % players.length);
        setDice(null);
        setWaitingForMove(false);
        setRolling(false);
        return;
      }

      const playerWithSixCount = { ...active, consecutiveSixes: newSixCount };
      const legalMoves = getMovableTokens(playerWithSixCount, value);
      const updated = players.map((p, index) => (index === currentPlayer ? playerWithSixCount : p));
      setPlayers(updated);

      if (legalMoves.length === 0) {
        setMessage(`No legal move for ${active.name}. Turn skipped.`);
        setRolling(false);
        setTimeout(() => nextTurn(updated), 650);
        return;
      }

      setMessage(`🎲 ${active.name} rolled ${value}. Choose a highlighted token.`);
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

    const landedTrack = movedTo < TRACK_LENGTH ? (START_OFFSETS[currentPlayer] + movedTo) % TRACK_LENGTH : null;

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
      playCaptureSound();
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
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-indigo-100 p-4 text-slate-900">
      <AnimatePresence>{showManual && <ManualModal onClose={() => setShowManual(false)} />}</AnimatePresence>

      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1fr_360px]">
        <main className="flex flex-col items-center gap-5">
          <div className="flex w-full max-w-[650px] items-center justify-between rounded-3xl bg-white p-4 shadow-lg">
            <div>
              <h1 className="text-3xl font-black">Ludo Rush</h1>
              <p className="text-sm text-slate-500">You play Red. AI opponents roll and move automatically.</p>
            </div>
            <Button variant="outline" onClick={() => setShowManual(true)} className="rounded-2xl"><Info size={18} className="mr-2" /> Manual</Button>
          </div>

          <Board players={players} activePlayerId={currentPlayer} movableTokens={movableTokens} onTokenClick={moveToken} />
        </main>

        <aside className="space-y-4">
          <Card className="rounded-[2rem] border-0 shadow-xl">
            <CardContent className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-500">Current turn</p>
                  <h2 className={`text-2xl font-black ${active.color.text}`}>{active.color.emoji} {active.name}</h2>
                </div>
                <Volume2 className="text-slate-400" />
              </div>

              <div className="mb-5 flex justify-center"><Dice value={dice} rolling={rolling} /></div>
              <Button onClick={rollDice} disabled={rolling || Boolean(winner) || waitingForMove || active.isAI} className="w-full rounded-2xl py-6 text-base"><Dice5 className="mr-2" size={19} /> Roll dice</Button>

              {waitingForMove && !active.isAI && <p className="mt-3 flex items-center justify-center gap-2 rounded-2xl bg-indigo-100 p-3 text-sm font-bold text-indigo-700"><MousePointer2 size={16} /> Choose a token</p>}
              {active.isAI && <p className="mt-3 rounded-2xl bg-slate-900 p-3 text-center text-sm font-bold text-white">🤖 AI is playing...</p>}
              <p className="mt-4 rounded-2xl bg-slate-100 p-3 text-center text-sm font-medium text-slate-700">{message}</p>
            </CardContent>
          </Card>

          {winner && (
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
              <Card className="rounded-[2rem] border-0 bg-amber-100 shadow-xl">
                <CardContent className="p-6 text-center">
                  <Trophy className="mx-auto mb-2 text-amber-600" size={42} />
                  <h2 className="text-2xl font-black">{winner.name} wins!</h2>
                  <p className="mb-4 text-slate-600">All 4 tokens reached Home.</p>
                  <Button onClick={onReset} className="rounded-2xl"><RotateCcw className="mr-2" size={18} /> New game</Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          <Card className="rounded-[2rem] border-0 shadow-xl">
            <CardContent className="p-6">
              <h3 className="mb-4 text-lg font-black">Players</h3>
              <div className="space-y-3">
                {players.map((player, index) => {
                  const homeCount = player.tokens.filter((t) => t.home).length;
                  const lockedCount = player.tokens.filter((t) => t.position === -1).length;

                  return (
                    <div key={player.id} className={`rounded-2xl p-3 ${player.color.soft}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-10 w-10 items-center justify-center rounded-full ${player.color.bg} text-xl`}>{player.color.emoji}</div>
                          <div>
                            <p className="font-bold">{player.name}</p>
                            <p className="text-xs text-slate-600">Locked: {lockedCount} • Home: {homeCount}/4</p>
                          </div>
                        </div>
                        {index === currentPlayer && !winner && <span className="rounded-full bg-white px-3 py-1 text-xs font-bold">Turn</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </aside>
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
