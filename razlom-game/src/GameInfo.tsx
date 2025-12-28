import type { GameState, Hero } from './types';
import { countActivePortals, getPortalEffects } from './gameLogic';
import './GameInfo.css';

interface GameInfoProps {
  gameState: GameState;
  currentHero: Hero | undefined;
}

export function GameInfo({ gameState, currentHero }: GameInfoProps) {
  const activePortals = countActivePortals(gameState.portals);
  const effects = getPortalEffects(gameState.portals);

  const aliveHeroes = gameState.heroes.filter(
    (h) => h.stats.hp > 0 && h.stats.sanity > 0
  );

  return (
    <div className="game-info">
      <div className="info-section">
        <h3>⏱️ Счётчик Тьмы</h3>
        <div className="darkness-counter">
          <div className="counter-value">{gameState.turn} / 20</div>
          <div className="counter-bar">
            <div
              className="counter-fill"
              style={{ width: `${(gameState.turn / 20) * 100}%` }}
            />
          </div>
          {gameState.turn < 3 && (
            <div className="warning">⚠️ Порталы откроются на ходу 3!</div>
          )}
        </div>
      </div>

      <div className="info-section">
        <h3>🌀 Порталы</h3>
        <div className="portal-info">
          <div>Активных: {activePortals} / 4</div>
          <div className="portal-effects">
            <small>
              💔 HP Сердца: {effects.heartHp} | 🎴 Лимит руки: {effects.handLimit} |
              🎯 Жетонов/ход: {effects.tokensPerTurn}
            </small>
          </div>
        </div>
      </div>

      <div className="info-section">
        <h3>💔 Сердце Тьмы</h3>
        <div className="heart-info">
          <div className="heart-hp">
            {gameState.heartOfDarkness.hp} / {gameState.heartOfDarkness.maxHp}
          </div>
          <div className="hp-bar">
            <div
              className="hp-fill"
              style={{
                width: `${(gameState.heartOfDarkness.hp / gameState.heartOfDarkness.maxHp) * 100}%`,
              }}
            />
          </div>
        </div>
      </div>

      <div className="info-section">
        <h3>👥 Герои ({aliveHeroes.length}/4)</h3>
        <div className="heroes-list">
          {gameState.heroes.map((hero) => (
            <div
              key={hero.id}
              className={`hero-item ${hero.stats.hp === 0 || hero.stats.sanity === 0 ? 'dead' : ''} ${
                currentHero?.id === hero.id ? 'active' : ''
              }`}
            >
              <div className="hero-name">
                {hero.type}
                {hero.side === 'shadow' && ' 🌑'}
              </div>
              <div className="hero-stats-mini">
                <span className={hero.stats.hp === 0 ? 'critical' : ''}>
                  ❤️ {hero.stats.hp}
                </span>
                <span className={hero.stats.sanity === 0 ? 'critical' : ''}>
                  🧠 {hero.stats.sanity}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="info-section">
        <h3>👹 Монстры ({gameState.monsters.filter((m) => m.hp > 0).length})</h3>
        <div className="monsters-summary">
          <div>
            🦎 Твари:{' '}
            {gameState.monsters.filter((m) => m.type === 'Тварь' && m.hp > 0).length}
          </div>
          <div>
            🐺 Охотники:{' '}
            {gameState.monsters.filter((m) => m.type === 'Охотник' && m.hp > 0).length}
          </div>
          <div>
            🛡️ Стражи:{' '}
            {gameState.monsters.filter((m) => m.type === 'Страж' && m.hp > 0).length}
          </div>
          <div>
            👻 Тени-шёпот:{' '}
            {gameState.monsters.filter((m) => m.type === 'Тень-шёпот' && m.hp > 0).length}
          </div>
        </div>
      </div>
    </div>
  );
}
