import { createRoot } from "react-dom/client";
import Board from "../src/Board.jsx";
import { createPlayers } from "../src/game.js";
import "../src/index.css";

const players = createPlayers(
  [0, 1, 2, 3].map((id) => ({ colorIndex: id, name: `Player ${id + 1}` })),
);
const count = Number(new URLSearchParams(location.search).get("count")) || 1;
// Put up to all 16 tokens on safe square 0, using each player's existing start offset.
players
  .flatMap((player) => player.tokens.map((token) => ({ player, token })))
  .slice(0, count)
  .forEach(({ player, token }) => {
    token.position = (40 - player.id * 10) % 40;
  });
createRoot(document.getElementById("root")).render(
  <div style={{ width: "min(95vw, 600px)", margin: "20px auto" }}>
    <Board
      players={players}
      activePlayerId={0}
      movableTokens={[]}
      onTokenClick={() => {}}
    />
  </div>,
);
