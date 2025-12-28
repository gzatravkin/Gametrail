import { useState } from 'react';
import type { GameState, HeroAction, Position, Monster } from './types';
import { initializeGame, positionEquals, getDistance } from './gameLogic';
import { HeroActionHandler } from './heroActions';
import { GameBoard } from './GameBoard';
import { GameInfo } from './GameInfo';
import { MessageLog } from './MessageLog';
import './App.css';

function App() {
  const [gameState, setGameState] = useState<GameState>(() => initializeGame());
  const [selectedTarget, setSelectedTarget] = useState<Monster | 'heart' | null>(null);
  const [actionHandler] = useState(() => new HeroActionHandler());

  const currentHero = gameState.heroes[gameState.currentHeroIndex];

  const handleAction = (action: HeroAction) => {
    if (gameState.gameOver) return;

    const newState = actionHandler.processHeroAction(gameState, action);
    setGameState(newState);
    setSelectedTarget(null);
  };

  const handleCellClick = (position: Position) => {
    if (gameState.gameOver || !currentHero) return;

    // Проверяем можно ли переместиться
    const canMove =
      !currentHero.hasActed &&
      getDistance(currentHero.position, position) === 1 &&
      !gameState.monsters.some(
        (m) => positionEquals(m.position, position) && m.side === currentHero.side && m.hp > 0
      ) &&
      !gameState.heroes.some(
        (h) => positionEquals(h.position, position) && h.id !== currentHero.id && h.stats.hp > 0
      );

    if (canMove) {
      handleAction({ type: 'move', position });
    }
  };

  const handleMonsterClick = (monster: Monster) => {
    if (gameState.gameOver || !currentHero || currentHero.hasActed) return;

    if (
      monster.side === currentHero.side &&
      getDistance(currentHero.position, monster.position) === 1
    ) {
      setSelectedTarget(monster);
    }
  };

  const handleAttack = () => {
    if (!selectedTarget || !currentHero) return;

    if (selectedTarget === 'heart') {
      handleAction({ type: 'attack', targetId: 'heart' });
    } else {
      handleAction({ type: 'attack', targetId: selectedTarget.id });
    }
  };

  const handleEnterPortal = () => {
    const portal = gameState.portals.find(
      (p) =>
        positionEquals(p.position, currentHero.position) && p.isOpen && p.isActive
    );

    if (portal) {
      handleAction({ type: 'enterPortal' });
    }
  };

  const handleDeactivate = () => {
    const token = gameState.tokens.find(
      (t) =>
        positionEquals(t.position, currentHero.position) &&
        t.side === currentHero.side &&
        !t.revealed
    );

    if (token) {
      handleAction({ type: 'deactivate' });
    }
  };

  const handleClosePortal = () => {
    const portal = gameState.portals.find(
      (p) =>
        positionEquals(p.position, currentHero.position) && p.isOpen && p.isActive
    );

    if (portal) {
      handleAction({ type: 'closePortal' });
    }
  };

  const handleEndTurn = () => {
    handleAction({ type: 'endTurn' });
  };

  const handleHeartClick = () => {
    if (gameState.gameOver || !currentHero || currentHero.hasActed) return;

    if (
      currentHero.side === 'shadow' &&
      getDistance(currentHero.position, gameState.heartOfDarkness.position) === 1
    ) {
      setSelectedTarget('heart');
    }
  };

  const restartGame = () => {
    setGameState(initializeGame());
    setSelectedTarget(null);
  };

  // Проверка доступных действий
  const canEnterPortal =
    currentHero &&
    !currentHero.hasActed &&
    gameState.portals.some(
      (p) =>
        positionEquals(p.position, currentHero.position) && p.isOpen && p.isActive
    );

  const canDeactivate =
    currentHero &&
    !currentHero.hasActed &&
    gameState.tokens.some(
      (t) =>
        positionEquals(t.position, currentHero.position) &&
        t.side === currentHero.side &&
        !t.revealed
    );

  const canClosePortal =
    currentHero &&
    !currentHero.hasActed &&
    gameState.portals.some(
      (p) =>
        positionEquals(p.position, currentHero.position) && p.isOpen && p.isActive
    );

  const canAttack = selectedTarget !== null;

  return (
    <div className="app">
      <header>
        <h1>⚔️ РАЗЛОМ ⚔️</h1>
        <p className="subtitle">Тьма наступает. Герои сражаются за выживание.</p>
      </header>

      <div className="game-container">
        <div className="game-main">
          <GameInfo gameState={gameState} currentHero={currentHero} />

          <GameBoard
            gameState={gameState}
            currentHero={currentHero}
            onCellClick={handleCellClick}
            onMonsterClick={handleMonsterClick}
            onHeartClick={handleHeartClick}
            selectedTarget={selectedTarget}
          />

          <div className="action-panel">
            {!gameState.gameOver ? (
              <>
                <div className="current-hero">
                  {currentHero && currentHero.stats.hp > 0 && currentHero.stats.sanity > 0 ? (
                    <>
                      <h3>
                        {currentHero.type}{' '}
                        <span className="side-badge">
                          {currentHero.side === 'human' ? '🏰 Люди' : '🌑 Изнанка'}
                        </span>
                      </h3>
                      <div className="hero-stats">
                        <span>❤️ {currentHero.stats.hp}/{currentHero.stats.maxHp}</span>
                        <span>⚔️ {currentHero.stats.attack}</span>
                        <span>🧠 {currentHero.stats.sanity}/{currentHero.stats.maxSanity}</span>
                      </div>
                      {currentHero.closingPortalProgress > 0 && (
                        <div className="closing-progress">
                          🔒 Закрытие: {currentHero.closingPortalProgress}/3
                        </div>
                      )}
                      {currentHero.isStunned && <div className="stunned">🕷️ Хватка</div>}
                    </>
                  ) : (
                    <p>Нет доступных героев</p>
                  )}
                </div>

                <div className="actions">
                  {selectedTarget && (
                    <div className="selected-target">
                      Цель:{' '}
                      {selectedTarget === 'heart'
                        ? '💔 Сердце Тьмы'
                        : `${selectedTarget.type}`}
                    </div>
                  )}

                  <button onClick={handleAttack} disabled={!canAttack}>
                    ⚔️ Атаковать
                  </button>
                  <button onClick={handleEnterPortal} disabled={!canEnterPortal}>
                    🌀 Войти в портал
                  </button>
                  <button onClick={handleDeactivate} disabled={!canDeactivate}>
                    🛡️ Дезактивировать
                  </button>
                  <button onClick={handleClosePortal} disabled={!canClosePortal}>
                    🔒 Закрывать портал
                  </button>
                  <button
                    onClick={handleEndTurn}
                    disabled={!currentHero || currentHero.hasActed}
                  >
                    ⏭️ Завершить ход
                  </button>
                </div>
              </>
            ) : (
              <div className="game-over">
                <h2>🏆 ИГРА ОКОНЧЕНА</h2>
                <p className="winner">
                  {gameState.winner === 'heroes' ? '✨ Победа Героев!' : '👹 Победа Тени!'}
                </p>
                <button onClick={restartGame} className="restart-btn">
                  🔄 Новая игра
                </button>
              </div>
            )}
          </div>
        </div>

        <MessageLog messages={gameState.messageLog} />
      </div>

      <footer>
        <p>Кликайте на соседние клетки чтобы двигаться. Кликайте на монстров/Сердце чтобы атаковать.</p>
      </footer>
    </div>
  );
}

export default App;
