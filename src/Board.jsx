import { Flag, Star, Trophy } from "lucide-react";
import {
  BOARD_SIZE,
  COLORS,
  SAFE_SQUARES,
  TRACK,
  homeLanePosition,
  tokenTrackIndex,
} from "./game.js";

const BASES = [
  { row: 2, col: 2 },
  { row: 2, col: 7 },
  { row: 7, col: 7 },
  { row: 7, col: 2 },
];
const LANES = COLORS.flatMap((_, id) =>
  [40, 41, 42, 43].map((position) => ({
    id,
    cell: homeLanePosition(id, { position }),
  })),
);

function Token({ player, token, enabled, onClick, decorative }) {
  const label = `${player.color.name} token ${token.id + 1}, ${player.name}${token.position === -1 ? ", in base" : ""}`;
  if (decorative)
    return (
      <span className={`token color-${player.id}`}>
        <span>{token.id + 1}</span>
      </span>
    );
  return (
    <button
      type="button"
      className={`token color-${player.id} ${enabled ? "can-move" : ""}`}
      disabled={!enabled}
      aria-label={label}
      onClick={() => onClick(token.id)}
    >
      <span>{token.id + 1}</span>
    </button>
  );
}

export default function Board({
  players,
  activePlayerId,
  movableTokens,
  onTokenClick,
  decorative = false,
}) {
  const canMove = (player, token) =>
    player.id === activePlayerId &&
    !player.isAI &&
    movableTokens.some((item) => item.id === token.id);
  const cells = new Map();
  for (const player of players) {
    for (const token of player.tokens) {
      const trackIndex = tokenTrackIndex(player.id, token);
      const lane = homeLanePosition(player.id, token);
      const cell = trackIndex !== null ? TRACK[trackIndex] : lane;
      if (!cell) continue;
      const key = cell.join("-");
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push({ player, token });
    }
  }
  return (
    <div
      className="board"
      role={decorative ? undefined : "group"}
      aria-label={decorative ? undefined : "Ludo board, 11 by 11 squares"}
      data-testid={decorative ? "preview-board" : "board"}
    >
      <div className="board-grid">
        {Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => {
          const row = Math.floor(index / BOARD_SIZE);
          const col = index % BOARD_SIZE;
          const trackIndex = TRACK.findIndex(
            ([r, c]) => row === r && col === c,
          );
          const lane = LANES.find(
            ({ cell }) => cell[0] === row && cell[1] === col,
          );
          const safe = SAFE_SQUARES.includes(trackIndex);
          const start = [0, 10, 20, 30].indexOf(trackIndex);
          const pieces = cells.get(`${row}-${col}`) || [];
          const center = row === 5 && col === 5;
          return (
            <div
              key={index}
              data-cell={`${row}-${col}`}
              className={`board-cell ${trackIndex >= 0 ? "track-cell" : ""} ${safe ? "safe-cell" : ""} ${lane ? `lane-cell color-${lane.id}` : ""} ${start >= 0 ? `start-cell color-${start}` : ""} ${center ? "center-cell" : ""}`}
              style={{ gridRow: row + 1, gridColumn: col + 1 }}
            >
              {center && <Trophy aria-hidden="true" />}
              {safe && !pieces.length && (
                <Star className="safe-star" aria-hidden="true" />
              )}
              {lane && !pieces.length && (
                <span className="lane-dot" aria-hidden="true" />
              )}
              {pieces.length > 0 && (
                <div
                  className="token-group"
                  data-count={pieces.length}
                  style={{
                    "--stack-cols": Math.ceil(Math.sqrt(pieces.length)),
                    "--stack-rows": Math.ceil(
                      pieces.length / Math.ceil(Math.sqrt(pieces.length)),
                    ),
                  }}
                >
                  {pieces.map(({ player, token }) => (
                    <Token
                      key={`${player.id}-${token.id}`}
                      player={player}
                      token={token}
                      enabled={canMove(player, token)}
                      onClick={onTokenClick}
                      decorative={decorative}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {COLORS.map((color, id) => {
          const player = players.find((item) => item.id === id);
          const home = player?.tokens.filter((token) => token.home).length || 0;
          return (
            <div
              className={`base color-${id} ${player?.id === activePlayerId ? "active-base" : ""} ${!player ? "empty-base" : ""}`}
              key={id}
              style={{
                gridRow: `${BASES[id].row} / span 4`,
                gridColumn: `${BASES[id].col} / span 4`,
              }}
            >
              <div className="base-heading">
                <span>{color.name}</span>
                <span>
                  <Flag aria-hidden="true" /> {home}/4
                </span>
              </div>
              <div className="base-slots">
                {[0, 1, 2, 3].map((tokenId) => {
                  const token = player?.tokens.find(
                    (item) => item.id === tokenId && item.position === -1,
                  );
                  return (
                    <div className="base-slot" key={tokenId}>
                      {token ? (
                        <Token
                          player={player}
                          token={token}
                          enabled={canMove(player, token)}
                          onClick={onTokenClick}
                          decorative={decorative}
                        />
                      ) : (
                        <span className="empty-slot" aria-hidden="true">
                          {player?.tokens[tokenId]?.home ? <Flag /> : "·"}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              <span className="base-name">{player?.name || "Open seat"}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
