import type { GameState, Position, Hero, Monster } from './types';
import { positionEquals, positionToString } from './gameLogic';
import './GameBoard.css';

interface GameBoardProps {
  gameState: GameState;
  currentHero: Hero | undefined;
  onCellClick: (position: Position) => void;
  onMonsterClick: (monster: Monster) => void;
  onHeartClick: () => void;
  selectedTarget: Monster | 'heart' | null;
}

export function GameBoard({
  gameState,
  currentHero,
  onCellClick,
  onMonsterClick,
  onHeartClick,
  selectedTarget,
}: GameBoardProps) {
  const renderCell = (row: number, col: number) => {
    const position: Position = { row, col };
    const cellKey = `${row}-${col}`;

    // Найти сущности на клетке
    const hero = gameState.heroes.find(
      (h) => positionEquals(h.position, position) && h.stats.hp > 0 && h.stats.sanity > 0
    );
    const monster = gameState.monsters.find(
      (m) => positionEquals(m.position, position) && m.hp > 0
    );
    const token = gameState.tokens.find(
      (t) => positionEquals(t.position, position) && !t.revealed
    );
    const portal = gameState.portals.find((p) => positionEquals(p.position, position));
    const isHeart = positionEquals(position, gameState.heartOfDarkness.position);
    const isBase = (row === 0 && col === 0) || (row === 0 && col === 1);

    // Определяем класс клетки
    let cellClass = 'cell';
    if (isBase) cellClass += ' base';
    if (isHeart) cellClass += ' heart-cell';
    if (currentHero && positionEquals(currentHero.position, position)) {
      cellClass += ' current-hero-cell';
    }
    if (
      selectedTarget &&
      ((selectedTarget === 'heart' && isHeart) ||
        (selectedTarget !== 'heart' && monster && selectedTarget.id === monster.id))
    ) {
      cellClass += ' selected-target';
    }

    return (
      <div
        key={cellKey}
        className={cellClass}
        onClick={() => onCellClick(position)}
        title={positionToString(position)}
      >
        <div className="cell-label">{positionToString(position)}</div>

        {/* База */}
        {isBase && <div className="base-icon">🏰</div>}

        {/* Портал */}
        {portal && portal.isOpen && portal.isActive && (
          <div className="portal-icon">🌀</div>
        )}

        {/* Жетон */}
        {token && !portal?.isOpen && <div className="token-icon">❓</div>}

        {/* Герой */}
        {hero && (
          <div
            className={`hero-icon ${hero.side}`}
            title={`${hero.type} (${hero.side})`}
          >
            {getHeroIcon(hero)}
            {hero.side === 'shadow' && <span className="shadow-badge">🌑</span>}
          </div>
        )}

        {/* Монстр */}
        {monster && (
          <div
            className={`monster-icon ${monster.side}`}
            onClick={(e) => {
              e.stopPropagation();
              onMonsterClick(monster);
            }}
            title={`${monster.type} (HP: ${monster.hp}/${monster.maxHp})`}
          >
            {getMonsterIcon(monster)}
            <div className="hp-bar">
              <div
                className="hp-fill"
                style={{ width: `${(monster.hp / monster.maxHp) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Сердце Тьмы */}
        {isHeart && (
          <div
            className="heart-icon"
            onClick={(e) => {
              e.stopPropagation();
              onHeartClick();
            }}
            title={`Сердце Тьмы (${gameState.heartOfDarkness.hp}/${gameState.heartOfDarkness.maxHp})`}
          >
            💔
            <div className="hp-bar">
              <div
                className="hp-fill"
                style={{
                  width: `${(gameState.heartOfDarkness.hp / gameState.heartOfDarkness.maxHp) * 100}%`,
                }}
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="game-board">
      {Array.from({ length: 8 }, (_, row) => (
        <div key={row} className="board-row">
          {Array.from({ length: 8 }, (_, col) => renderCell(row, col))}
        </div>
      ))}
    </div>
  );
}

function getHeroIcon(hero: Hero): string {
  switch (hero.type) {
    case 'Воин':
      return '⚔️';
    case 'Охотник':
      return '🏹';
    case 'Жрец':
      return '✝️';
    case 'Следопыт':
      return '🗡️';
    case 'Медик':
      return '🏥';
    default:
      return '👤';
  }
}

function getMonsterIcon(monster: Monster): string {
  switch (monster.type) {
    case 'Тварь':
      return '🦎';
    case 'Охотник':
      return '🐺';
    case 'Страж':
      return '🛡️';
    case 'Тень-шёпот':
      return '👻';
    default:
      return '👹';
  }
}
