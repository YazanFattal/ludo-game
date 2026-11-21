import { useEffect, useReducer, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Bot,
  Check,
  ChevronRight,
  Dice5,
  Flag,
  Info,
  Maximize2,
  Minimize2,
  Moon,
  RotateCcw,
  ShieldCheck,
  Sun,
  Trophy,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import {
  COLORS,
  chooseAIToken,
  createPlayers,
  getMovableTokens,
} from "./game.js";
import { gameReducer, initialGame } from "./engine.js";
import { playCaptureSound, playDiceSound } from "./audio.js";
import Board from "./Board.jsx";

function IconButton({ label, children, ...props }) {
  return (
    <button
      type="button"
      className="icon-button"
      aria-label={label}
      title={label}
      {...props}
    >
      {children}
    </button>
  );
}

function Brand() {
  return (
    <a
      className="brand"
      href="#"
      aria-label="Ludo Rush home"
      onClick={(event) => event.preventDefault()}
    >
      <span className="brand-mark">
        <Dice5 size={23} aria-hidden="true" />
      </span>
      <span>
        Ludo<span className="brand-light">Rush</span>
        <span className="brand-dot">.</span>
      </span>
    </a>
  );
}

function ThemeButton({ theme, setTheme }) {
  return (
    <IconButton
      label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
    </IconButton>
  );
}

function Dialog({ title, children, onClose, className = "" }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    const opener = document.activeElement;
    dialog.showModal();
    return () => {
      dialog.close();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);
  function trapFocus(event) {
    if (event.key !== "Tab") return;
    const controls = [
      ...ref.current.querySelectorAll(
        'button:not([disabled]), a[href], input:not([disabled]), [tabindex="0"]',
      ),
    ];
    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
  return (
    <dialog
      ref={ref}
      className={`dialog ${className}`}
      aria-labelledby="dialog-title"
      onKeyDown={trapFocus}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      <div className="dialog-heading">
        <h2 id="dialog-title">{title}</h2>
        <IconButton label="Close dialog" onClick={onClose}>
          <X size={20} />
        </IconButton>
      </div>
      {children}
    </dialog>
  );
}

function Rules({ onClose }) {
  const rules = [
    [
      Dice5,
      "Make your entrance",
      "Roll a six to unlock a token. A six also gives you another roll. Three sixes in a row cancel your turn.",
    ],
    [
      ArrowUpRight,
      "Choose your move",
      "Move clockwise around the outer track, then along your colored lane. Pick a highlighted token after rolling.",
    ],
    [
      ShieldCheck,
      "Capture & take cover",
      "Land on an opponent to send it to base. You gain 20 steps and another roll. Star squares protect every token on them.",
    ],
    [
      Flag,
      "Bring it home",
      "An exact roll brings a token home and earns another roll. Get all four home first to win.",
    ],
  ];
  return (
    <Dialog title="A little luck. A little strategy." onClose={onClose}>
      <p className="dialog-intro">Your quick guide to Ludo Rush.</p>
      <div className="rules-list">
        {rules.map(([Icon, title, text], index) => (
          <div className="rule" key={title}>
            <span className="rule-icon">
              <Icon size={23} aria-hidden="true" />
            </span>
            <div>
              <h3>
                <span>0{index + 1}</span> {title}
              </h3>
              <p>{text}</p>
            </div>
          </div>
        ))}
      </div>
      <button className="primary-button" onClick={onClose}>
        Got it, let’s play <ArrowRight size={18} />
      </button>
    </Dialog>
  );
}

function Setup({ onStart, theme, setTheme }) {
  const [name, setName] = useState("");
  const [colorIndex, setColorIndex] = useState(0);
  const [aiCount, setAiCount] = useState(3);
  const [aiNames, setAiNames] = useState([
    "AI Red",
    "AI Blue",
    "AI Green",
    "AI Yellow",
  ]);
  const [rules, setRules] = useState(false);
  const remaining = COLORS.map((_, index) => index)
    .filter((index) => index !== colorIndex)
    .slice(0, aiCount);
  function start(event) {
    event.preventDefault();
    onStart({
      players: createPlayers([
        { name: name || "You", colorIndex, isAI: false },
        ...remaining.map((index) => ({
          name: aiNames[index],
          colorIndex: index,
          isAI: true,
        })),
      ]),
    });
  }
  return (
    <div className="setup-shell">
      <header className="site-header">
        <Brand />
        <div className="header-actions">
          <IconButton label="How to play" onClick={() => setRules(true)}>
            <Info size={19} />
          </IconButton>
          <ThemeButton theme={theme} setTheme={setTheme} />
        </div>
      </header>
      <main className="setup-main">
        <section className="setup-story">
          <div className="eyebrow">
            <span className="live-dot" /> THE CLASSIC. WITH A TWIST.
          </div>
          <h1>
            Good moves.
            <br />
            Great <span>rivalries.</span>
          </h1>
          <p>
            Four tokens. One way home.
            <br />
            Take on the AI and make every roll count.
          </p>
          <div className="preview-board" aria-hidden="true">
            <Board
              players={createPlayers(
                COLORS.map((_, index) => ({ colorIndex: index, isAI: true })),
              )}
              activePlayerId={-1}
              movableTokens={[]}
              onTokenClick={() => {}}
              decorative
            />
          </div>
          <div className="story-footer">
            <span>
              <Bot size={17} /> 1–3 AI opponents
            </span>
            <span>
              <ShieldCheck size={17} /> No sign-up. Just play.
            </span>
          </div>
        </section>
        <section className="setup-card">
          <div className="eyebrow">YOUR NEXT RIVALRY STARTS HERE</div>
          <h2>Make yourself at home.</h2>
          <p className="setup-intro">Pick your color. Meet your competition.</p>
          <form onSubmit={start}>
            <label className="field-label" htmlFor="player-name">
              Your name <span>Optional</span>
            </label>
            <input
              id="player-name"
              maxLength={24}
              placeholder="What should we call you?"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="nickname"
            />
            <fieldset>
              <legend>Choose your color</legend>
              <div className="color-picker">
                {COLORS.map((color, index) => (
                  <button
                    type="button"
                    key={color.name}
                    className={`color-option color-${index} ${index === colorIndex ? "selected" : ""}`}
                    onClick={() => setColorIndex(index)}
                    aria-pressed={index === colorIndex}
                  >
                    <span className="color-swatch">
                      {index === colorIndex && <Check size={20} />}
                    </span>
                    {color.name}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>AI opponents</legend>
              <div className="opponent-picker">
                {[1, 2, 3].map((number) => (
                  <button
                    type="button"
                    key={number}
                    aria-pressed={aiCount === number}
                    className={number === aiCount ? "selected" : ""}
                    onClick={() => setAiCount(number)}
                  >
                    <Bot size={17} />
                    {number} {number === 1 ? "opponent" : "opponents"}
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="opponent-list">
              {remaining.map((index) => (
                <div className={`opponent-row color-${index}`} key={index}>
                  <span className="player-avatar">
                    <Bot size={17} />
                  </span>
                  <label className="sr-only" htmlFor={`ai-name-${index}`}>
                    {COLORS[index].name} AI name
                  </label>
                  <input
                    id={`ai-name-${index}`}
                    maxLength={24}
                    value={aiNames[index]}
                    onChange={(event) =>
                      setAiNames((old) =>
                        old.map((value, i) =>
                          i === index ? event.target.value : value,
                        ),
                      )
                    }
                  />
                  <span className="ai-badge">AI</span>
                </div>
              ))}
            </div>
            <button type="submit" className="primary-button">
              Let’s play <ArrowRight size={19} />
            </button>
            <p className="setup-note">A quick game. A well-earned victory.</p>
          </form>
        </section>
      </main>
      <footer className="site-footer">
        <span>A familiar game. A fresh roll.</span>
        <span>MADE FOR A LITTLE FRIENDLY COMPETITION</span>
      </footer>
      {rules && <Rules onClose={() => setRules(false)} />}
    </div>
  );
}

function Dice({ value, rolling, disabled, onRoll }) {
  const pips = {
    1: [5],
    2: [1, 9],
    3: [1, 5, 9],
    4: [1, 3, 7, 9],
    5: [1, 3, 5, 7, 9],
    6: [1, 3, 4, 6, 7, 9],
  };
  return (
    <button
      type="button"
      className={`dice ${rolling ? "is-rolling" : ""}`}
      onClick={onRoll}
      disabled={disabled}
      aria-label={`Roll dice${value ? `, last roll ${value}` : ""}`}
    >
      <span className="dice-face" aria-hidden="true">
        {value && !rolling ? (
          Array.from({ length: 9 }, (_, index) => (
            <span
              key={index}
              className={pips[value].includes(index + 1) ? "pip" : ""}
            />
          ))
        ) : (
          <Dice5 size={34} />
        )}
      </span>
    </button>
  );
}

function PlayerCard({ player, active }) {
  const home = player.tokens.filter((token) => token.home).length;
  const locked = player.tokens.filter((token) => token.position === -1).length;
  return (
    <div
      className={`player-card color-${player.id} ${active ? "is-active" : ""}`}
      aria-current={active ? "true" : undefined}
    >
      <span className="player-avatar">
        {player.isAI ? (
          <Bot size={19} />
        ) : (
          <span>{player.name.slice(0, 1).toUpperCase()}</span>
        )}
      </span>
      <div className="player-details">
        <div className="player-name">
          {player.name}
          <span className="player-type">{player.isAI ? "AI" : "YOU"}</span>
        </div>
        <div className="player-counts">
          <span>{locked} in base</span>
          <span>{home}/4 home</span>
        </div>
        <div
          className="home-progress"
          role="progressbar"
          aria-label={`${player.name} tokens home`}
          aria-valuenow={home}
          aria-valuemin={0}
          aria-valuemax={4}
        >
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={i < home ? "filled" : ""} />
          ))}
        </div>
      </div>
      <span className="turn-dot" aria-hidden="true" />
    </div>
  );
}

function Game({ gameData, onReset, theme, setTheme }) {
  const [state, dispatch] = useReducer(
    gameReducer,
    gameData.players,
    initialGame,
  );
  const [rules, setRules] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [muted, setMuted] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);
  const shellRef = useRef(null);
  const active = state.players[state.currentPlayer];
  const movable =
    state.phase === "choosing" ? getMovableTokens(active, state.dice) : [];
  const winner = state.phase === "won" ? active : null;
  const paused = rules || confirmReset;
  const canRoll = state.phase === "ready" && !active.isAI && !paused;

  useEffect(() => {
    if (paused) return undefined;
    let timer;
    if (state.phase === "rolling")
      timer = setTimeout(
        () =>
          dispatch({
            type: "result",
            value: Math.floor(Math.random() * 6) + 1,
          }),
        700,
      );
    else if (state.phase === "transition")
      timer = setTimeout(() => dispatch({ type: "next" }), 850);
    else if (active.isAI && state.phase === "ready")
      timer = setTimeout(() => dispatch({ type: "roll" }), 1300);
    else if (active.isAI && state.phase === "choosing")
      timer = setTimeout(() => {
        const token = chooseAIToken(
          getMovableTokens(active, state.dice),
          state.dice,
          active,
          state.players,
        );
        if (token) dispatch({ type: "move", tokenId: token.id });
      }, 1300);
    return () => clearTimeout(timer);
  }, [state, active, paused]);

  useEffect(() => {
    if (state.phase === "rolling") playDiceSound(muted);
    if (state.captured) playCaptureSound(muted);
  }, [state.phase, state.captured, muted]);

  useEffect(() => {
    function syncFullscreen() {
      const fullscreen = Boolean(document.fullscreenElement);
      setNativeFullscreen(fullscreen);
      if (!fullscreen) setExpanded(false);
    }
    function escape(event) {
      if (event.key === "Escape" && !document.fullscreenElement)
        setExpanded(false);
    }
    document.addEventListener("fullscreenchange", syncFullscreen);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreen);
      document.removeEventListener("keydown", escape);
    };
  }, []);

  async function toggleExpand() {
    if (expanded) {
      setExpanded(false);
      if (document.fullscreenElement)
        await document.exitFullscreen().catch(() => {});
    } else {
      setExpanded(true);
      // In-page expansion stays playable when native fullscreen is unavailable.
      if (shellRef.current.requestFullscreen)
        await shellRef.current.requestFullscreen().catch(() => {});
    }
  }

  function reset() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    onReset();
  }

  const actionLabel = winner
    ? "Victory is yours."
    : state.phase === "rolling"
      ? "A little suspense…"
      : state.phase === "choosing"
        ? active.isAI
          ? "Planning the next move…"
          : "Make your move."
        : active.isAI
          ? "Your rival is thinking…"
          : state.phase === "transition"
            ? "Passing the dice…"
            : "Your turn to roll.";
  return (
    <div
      ref={shellRef}
      className={`game-shell ${expanded ? "is-expanded" : ""}`}
    >
      <header className="site-header">
        <Brand />
        <span className="match-label">
          <span className="live-dot" /> LOCAL MATCH <span>·</span>{" "}
          {state.players.length} PLAYERS
        </span>
        <div className="header-actions">
          <IconButton
            label={muted ? "Unmute sound" : "Mute sound"}
            aria-pressed={muted}
            onClick={() => setMuted(!muted)}
          >
            {muted ? <VolumeX size={19} /> : <Volume2 size={19} />}
          </IconButton>
          <IconButton label="How to play" onClick={() => setRules(true)}>
            <Info size={19} />
          </IconButton>
          <ThemeButton theme={theme} setTheme={setTheme} />
          <IconButton
            label={
              expanded || nativeFullscreen
                ? "Exit expanded board"
                : "Expand board"
            }
            aria-pressed={expanded}
            onClick={toggleExpand}
          >
            {expanded ? <Minimize2 size={19} /> : <Maximize2 size={19} />}
          </IconButton>
        </div>
      </header>
      <main className="game-main">
        <section className="board-panel" aria-label="Game board">
          <div className="board-heading">
            <div>
              <span className="eyebrow">THE RACE HOME</span>
              <h1>Every roll is a new chance.</h1>
            </div>
            <span className="board-key">
              <ShieldCheck size={15} /> Stars are safe
            </span>
          </div>
          <div className="board-region">
            <Board
              players={state.players}
              activePlayerId={active.id}
              movableTokens={paused ? [] : movable}
              onTokenClick={(tokenId) => dispatch({ type: "move", tokenId })}
            />
          </div>
          <div className="board-caption">
            <span>
              <span className={`color-dot color-${active.id}`} />
              {winner ? `${active.name} wins` : `${active.color.name} to play`}
            </span>
            <span>ROLL. RACE. REPEAT.</span>
          </div>
        </section>
        <aside className="game-sidebar" aria-label="Match controls">
          <section className={`turn-panel color-${active.id}`}>
            <div className="turn-heading">
              <span className="eyebrow">
                {winner ? "THE WINNER" : "ON THE MOVE"}
              </span>
              <span className="turn-badge">
                {winner ? <Trophy size={15} /> : <span className="live-dot" />}
                {winner ? "FINISHED" : active.isAI ? "AI TURN" : "YOUR TURN"}
              </span>
            </div>
            <div className="active-name">{active.name}</div>
            <div className="dice-row">
              <Dice
                value={state.lastDice}
                rolling={state.phase === "rolling"}
                disabled={!canRoll}
                onRoll={() => dispatch({ type: "roll" })}
              />
              <div className="dice-copy">
                <h2>{actionLabel}</h2>
                <p>
                  {state.phase === "choosing" && !active.isAI
                    ? `Move ${state.dice} ${state.dice === 1 ? "step" : "steps"} with a token below.`
                    : winner
                      ? "All four tokens, safely home."
                      : active.isAI
                        ? "Sit back. Your turn is coming."
                        : "Tap the dice and see what’s next."}
                </p>
              </div>
            </div>
            <div
              className="token-actions"
              role="group"
              aria-label="Choose a token"
            >
              {active.tokens.map((token) => (
                <button
                  key={token.id}
                  type="button"
                  disabled={
                    paused ||
                    active.isAI ||
                    !movable.some((item) => item.id === token.id)
                  }
                  onClick={() => dispatch({ type: "move", tokenId: token.id })}
                  aria-label={`Move ${active.color.name} token ${token.id + 1}`}
                >
                  <span>{token.home ? <Flag size={13} /> : token.id + 1}</span>
                  <span>Token {token.id + 1}</span>
                </button>
              ))}
            </div>
          </section>
          <div
            className="match-message"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            <span className="message-icon">
              {winner ? <Trophy size={17} /> : <Info size={17} />}
            </span>
            <p>{state.message}</p>
          </div>
          <section className="players-panel">
            <div className="section-heading">
              <h2>The players</h2>
              <span>{state.players.length} AT THE TABLE</span>
            </div>
            <div className="players-list">
              {state.players.map((player) => (
                <PlayerCard
                  key={player.id}
                  player={player}
                  active={player.id === active.id}
                />
              ))}
            </div>
          </section>
          <button
            className="new-game-button"
            onClick={() => (winner ? reset() : setConfirmReset(true))}
          >
            <RotateCcw size={16} /> New game <ChevronRight size={16} />
          </button>
          <div className="sidebar-note">
            <Dice5 size={16} />
            <span>A little luck goes a long way.</span>
          </div>
        </aside>
      </main>
      <footer className="game-footer">
        <span>GOOD COMPANY. GREAT COMPETITION.</span>
        <span>
          Ludo Rush <span className="brand-dot">✦</span>
        </span>
      </footer>
      {rules && <Rules onClose={() => setRules(false)} />}
      {confirmReset && (
        <Dialog
          title="Ready for a fresh roll?"
          onClose={() => setConfirmReset(false)}
        >
          <p className="dialog-intro">
            Starting a new game ends this match and returns you to player setup.
          </p>
          <div className="dialog-actions">
            <button
              className="secondary-button"
              onClick={() => setConfirmReset(false)}
            >
              Keep playing
            </button>
            <button className="primary-button" onClick={reset}>
              New game <ArrowRight size={17} />
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

export default function App() {
  const [gameData, setGameData] = useState(null);
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem("ludo-theme");
      return saved === "light" || saved === "dark"
        ? saved
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    } catch {
      return "light";
    }
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("ludo-theme", theme);
    } catch {
      /* Private browsing can disable storage. */
    }
  }, [theme]);
  return gameData ? (
    <Game
      gameData={gameData}
      onReset={() => setGameData(null)}
      theme={theme}
      setTheme={setTheme}
    />
  ) : (
    <Setup onStart={setGameData} theme={theme} setTheme={setTheme} />
  );
}
