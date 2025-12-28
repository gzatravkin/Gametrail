import type {
  GameState,
  Hero,
  HeroAction,
  Position,
} from './types';
import {
  CardType,
  MonsterType,
  GamePhase,
} from './types';
import {
  positionEquals,
  isAdjacent,
  resolveCombat,
  getPortalEffects,
  isOnBase,
  getEntityAtPosition,
  isPortalBlockedByGuardian,
  checkVictory,
  countActivePortals,
} from './gameLogic';
import { ShadowAI } from './shadowAI';

export class HeroActionHandler {
  private shadowAI: ShadowAI;

  constructor() {
    this.shadowAI = new ShadowAI();
  }

  // Обработать действие героя
  processHeroAction(state: GameState, action: HeroAction): GameState {
    let newState = { ...state };
    const messages: string[] = [];

    const hero = newState.heroes[newState.currentHeroIndex];
    if (!hero || hero.stats.hp <= 0 || hero.stats.sanity <= 0) {
      return this.nextHero(newState);
    }

    messages.push(`\n--- ${hero.type} ---`);

    switch (action.type) {
      case 'move':
        const moveResult = this.handleMove(newState, hero, action.position);
        newState = moveResult.state;
        messages.push(...moveResult.messages);
        break;

      case 'attack':
        const attackResult = this.handleAttack(newState, hero, action.targetId);
        newState = attackResult.state;
        messages.push(...attackResult.messages);
        break;

      case 'enterPortal':
        const portalResult = this.handleEnterPortal(newState, hero);
        newState = portalResult.state;
        messages.push(...portalResult.messages);
        break;

      case 'deactivate':
        const deactivateResult = this.handleDeactivate(newState, hero);
        newState = deactivateResult.state;
        messages.push(...deactivateResult.messages);
        break;

      case 'closePortal':
        const closeResult = this.handleClosePortal(newState, hero);
        newState = closeResult.state;
        messages.push(...closeResult.messages);
        break;

      case 'endTurn':
        return this.endHeroTurn(newState, hero);
    }

    newState.messageLog = [...newState.messageLog, ...messages];

    // Проверка победных условий
    const victory = checkVictory(newState);
    if (victory.winner) {
      newState.gameOver = true;
      newState.winner = victory.winner;
      newState.messageLog.push(`\n🏆 ${victory.reason}`);
    }

    return newState;
  }

  // Движение героя
  private handleMove(
    state: GameState,
    hero: Hero,
    targetPosition: Position
  ): { state: GameState; messages: string[] } {
    const newState = { ...state };
    const messages: string[] = [];

    // Проверки
    if (!isAdjacent(hero.position, targetPosition)) {
      messages.push('❌ Можно двигаться только на соседнюю клетку');
      return { state: newState, messages };
    }

    // Проверка что клетка свободна
    const occupied = getEntityAtPosition(
      targetPosition,
      hero.side,
      newState.heroes,
      newState.monsters
    );
    if (occupied) {
      messages.push('❌ Клетка занята');
      return { state: newState, messages };
    }

    // Сбросить прогресс закрытия портала если герой двигается
    if (hero.closingPortalProgress > 0) {
      messages.push('⚠️ Прогресс закрытия портала сброшен');
      hero.closingPortalProgress = 0;
    }

    // Переместить героя
    hero.position = targetPosition;
    hero.hasActed = true;
    messages.push(`🚶 Перемещение на ${this.posToStr(targetPosition)}`);

    // Проверить жетон
    const tokenResult = this.checkToken(newState, hero);
    newState.tokens = tokenResult.state.tokens;
    newState.heroes = tokenResult.state.heroes;
    messages.push(...tokenResult.messages);

    return { state: newState, messages };
  }

  // Атака
  private handleAttack(
    state: GameState,
    hero: Hero,
    targetId: string
  ): { state: GameState; messages: string[] } {
    const newState = { ...state };
    const messages: string[] = [];

    // Найти цель
    const monsterTarget = newState.monsters.find((m) => m.id === targetId);
    const isHeartTarget = targetId === 'heart';

    if (!monsterTarget && !isHeartTarget) {
      messages.push('❌ Цель не найдена');
      return { state: newState, messages };
    }

    if (isHeartTarget) {
      // Атака на Сердце Тьмы
      if (hero.side !== 'shadow') {
        messages.push('❌ Сердце Тьмы на Изнанке');
        return { state: newState, messages };
      }

      if (!isAdjacent(hero.position, newState.heartOfDarkness.position)) {
        messages.push('❌ Нужно быть рядом с Сердцем');
        return { state: newState, messages };
      }

      // Собрать всех героев атакующих Сердце
      const attackingHeroes = newState.heroes.filter(
        (h) =>
          h.stats.hp > 0 &&
          h.stats.sanity > 0 &&
          h.side === 'shadow' &&
          isAdjacent(h.position, newState.heartOfDarkness.position)
      );

      const totalAttack = attackingHeroes.reduce((sum, h) => sum + h.stats.attack, 0);
      const roll = Math.floor(Math.random() * 6) + 1;
      const totalDamage = Math.max(0, totalAttack + roll - 5);

      newState.heartOfDarkness.hp = Math.max(0, newState.heartOfDarkness.hp - totalDamage);

      messages.push(
        `⚔️ Атака на Сердце Тьмы: ${totalAttack} + d6(${roll}) - 5 = ${totalDamage} урона`
      );
      messages.push(`💔 Сердце Тьмы: ${newState.heartOfDarkness.hp}/${newState.heartOfDarkness.maxHp} HP`);

      // Ответный урон
      const portalCount = countActivePortals(newState.portals);
      if (portalCount > 0) {
        attackingHeroes.forEach((h) => {
          h.stats.hp = Math.max(0, h.stats.hp - portalCount);
          messages.push(
            `💥 ${h.type} получает ${portalCount} урона от Сердца (осталось ${h.stats.hp} HP)`
          );
          if (h.stats.hp === 0) {
            messages.push(`💀 ${h.type} погиб!`);
          }
        });
      }

      hero.hasActed = true;
    } else if (monsterTarget) {
      // Атака на монстра
      if (monsterTarget.side !== hero.side) {
        messages.push('❌ Монстр на другой стороне');
        return { state: newState, messages };
      }

      if (!isAdjacent(hero.position, monsterTarget.position)) {
        messages.push('❌ Нужно быть рядом с целью');
        return { state: newState, messages };
      }

      // Групповой бой
      const alliesInCombat = newState.heroes.filter(
        (h) =>
          h.stats.hp > 0 &&
          h.stats.sanity > 0 &&
          h.side === hero.side &&
          isAdjacent(h.position, monsterTarget.position)
      );

      const enemiesInCombat = newState.monsters.filter(
        (m) =>
          m.hp > 0 &&
          m.side === hero.side &&
          alliesInCombat.some((h) => isAdjacent(h.position, m.position))
      );

      const attackers = alliesInCombat.map((h) => ({
        attack: h.stats.attack,
        id: h.id,
        name: h.type,
      }));
      const defenders = enemiesInCombat.map((m) => ({
        attack: m.attack,
        id: m.id,
        name: m.type,
      }));

      const combat = resolveCombat(attackers, defenders);

      messages.push(
        `⚔️ Бой: Герои(${attackers.reduce((s, a) => s + a.attack, 0)}+${combat.attackerRoll}) vs Монстры(${defenders.reduce((s, d) => s + d.attack, 0)}+${combat.defenderRoll})`
      );

      // Применить урон героям
      if (combat.attackerDamage > 0) {
        alliesInCombat.forEach((h) => {
          h.stats.hp = Math.max(0, h.stats.hp - combat.attackerDamage);
          if (h.stats.hp === 0) {
            messages.push(`💀 ${h.type} погиб!`);
          }
        });
        messages.push(`💥 Герои получают ${combat.attackerDamage} урона`);
      }

      // Применить урон монстрам
      if (combat.defenderDamage > 0) {
        enemiesInCombat.forEach((m) => {
          m.hp = Math.max(0, m.hp - combat.defenderDamage);
          if (m.hp === 0) {
            messages.push(`☠️ ${m.type} уничтожен!`);
          }
        });
        messages.push(`⚡ Монстры получают ${combat.defenderDamage} урона`);
      }

      hero.hasActed = true;
    }

    return { state: newState, messages };
  }

  // Войти в портал
  private handleEnterPortal(
    state: GameState,
    hero: Hero
  ): { state: GameState; messages: string[] } {
    const newState = { ...state };
    const messages: string[] = [];

    // Найти портал на позиции героя
    const portal = newState.portals.find(
      (p) => positionEquals(p.position, hero.position) && p.isOpen && p.isActive
    );

    if (!portal) {
      messages.push('❌ Здесь нет открытого портала');
      return { state: newState, messages };
    }

    // Проверить блокировку Стражем
    if (isPortalBlockedByGuardian(portal.position, hero.side, newState.monsters)) {
      messages.push('❌ Страж блокирует вход в портал');
      return { state: newState, messages };
    }

    // Переключить сторону
    const newSide: 'human' | 'shadow' = hero.side === 'human' ? 'shadow' : 'human';
    hero.side = newSide;
    hero.hasActed = true;

    // Сбросить прогресс закрытия
    if (hero.closingPortalProgress > 0) {
      hero.closingPortalProgress = 0;
      messages.push('⚠️ Прогресс закрытия портала сброшен');
    }

    messages.push(
      `🌀 Переход через портал на ${newSide === 'shadow' ? 'Изнанку' : 'Сторону Людей'}`
    );

    return { state: newState, messages };
  }

  // Дезактивировать жетон
  private handleDeactivate(
    state: GameState,
    hero: Hero
  ): { state: GameState; messages: string[] } {
    const newState = { ...state };
    const messages: string[] = [];

    // Найти жетон на позиции героя
    const tokenIndex = newState.tokens.findIndex(
      (t) => positionEquals(t.position, hero.position) && t.side === hero.side && !t.revealed
    );

    if (tokenIndex === -1) {
      messages.push('❌ Здесь нет нераскрытого жетона');
      return { state: newState, messages };
    }

    const token = newState.tokens[tokenIndex];

    // Дезактивировать (не срабатывает эффект)
    messages.push(`🛡️ Жетон дезактивирован: ${token.card.type}`);

    // Если это портал до открытия - он не откроется
    if (token.card.type === CardType.RIFT) {
      const portalIndex = newState.portals.findIndex((p) => p.id === token.id);
      if (portalIndex !== -1) {
        newState.portals.splice(portalIndex, 1);
        messages.push('✅ Портал предотвращён!');
      }
    }

    // Удалить жетон
    newState.tokens.splice(tokenIndex, 1);
    hero.hasActed = true;

    return { state: newState, messages };
  }

  // Закрывать портал
  private handleClosePortal(
    state: GameState,
    hero: Hero
  ): { state: GameState; messages: string[] } {
    const newState = { ...state };
    const messages: string[] = [];

    // Найти портал на позиции героя
    const portal = newState.portals.find(
      (p) => positionEquals(p.position, hero.position) && p.isOpen && p.isActive
    );

    if (!portal) {
      messages.push('❌ Здесь нет открытого портала');
      return { state: newState, messages };
    }

    // Увеличить прогресс
    hero.closingPortalProgress += 1;
    hero.hasActed = true;

    messages.push(`🔒 Закрытие портала: ${hero.closingPortalProgress}/3`);

    // Если 3 хода - портал закрыт
    if (hero.closingPortalProgress >= 3) {
      portal.isActive = false;
      hero.closingPortalProgress = 0;
      messages.push('✅ Портал закрыт!');

      // Пересчитать HP Сердца
      const effects = getPortalEffects(newState.portals);
      const currentHp = newState.heartOfDarkness.hp;
      const oldMax = newState.heartOfDarkness.maxHp;
      const newMax = effects.heartHp;

      newState.heartOfDarkness.maxHp = newMax;
      newState.heartOfDarkness.hp = Math.max(1, Math.min(currentHp, newMax - (oldMax - currentHp)));

      messages.push(
        `💔 HP Сердца пересчитано: ${newState.heartOfDarkness.hp}/${newState.heartOfDarkness.maxHp}`
      );
    }

    return { state: newState, messages };
  }

  // Проверить жетон на клетке
  private checkToken(
    state: GameState,
    hero: Hero
  ): { state: GameState; messages: string[] } {
    const newState = { ...state };
    const messages: string[] = [];

    const tokenIndex = newState.tokens.findIndex(
      (t) => positionEquals(t.position, hero.position) && t.side === hero.side && !t.revealed
    );

    if (tokenIndex === -1) return { state: newState, messages };

    const token = newState.tokens[tokenIndex];
    token.revealed = true;

    messages.push(`⚠️ Активирован жетон: ${token.card.type}`);

    // Применить эффект
    switch (token.card.type) {
      case CardType.PAIN:
        hero.stats.hp = Math.max(0, hero.stats.hp - 2);
        messages.push(`💥 -2 HP (осталось ${hero.stats.hp})`);
        if (hero.stats.hp === 0) messages.push(`💀 ${hero.type} погиб!`);
        break;

      case CardType.WHISPER:
        hero.stats.sanity = Math.max(0, hero.stats.sanity - 2);
        messages.push(`🌀 -2 Рассудка (осталось ${hero.stats.sanity})`);
        if (hero.stats.sanity === 0) messages.push(`🌀 ${hero.type} сошёл с ума!`);
        break;

      case CardType.TRAP:
        hero.hasActed = true;
        messages.push(`🕸️ Ловушка! Пропуск хода`);
        break;

      case CardType.AMBUSH:
        // Призыв Твари
        const creature = {
          id: `monster-ambush-${Date.now()}`,
          type: MonsterType.CREATURE,
          hp: 2,
          maxHp: 2,
          attack: 1,
          speed: 2,
          position: { ...hero.position },
          side: hero.side,
          hasActed: false,
        };
        newState.monsters.push(creature);
        messages.push(`👹 Засада! Появилась Тварь`);
        break;

      case CardType.PUSHBACK:
        // Отброс на 2 клетки от Сердца (упрощенно - в случайном направлении)
        const directions = [
          { row: -2, col: 0 },
          { row: 2, col: 0 },
          { row: 0, col: -2 },
          { row: 0, col: 2 },
        ];
        const dir = directions[Math.floor(Math.random() * directions.length)];
        const newPos = {
          row: Math.max(0, Math.min(7, hero.position.row + dir.row)),
          col: Math.max(0, Math.min(7, hero.position.col + dir.col)),
        };
        hero.position = newPos;
        messages.push(`💨 Отброс на ${this.posToStr(newPos)}`);
        break;

      case CardType.GRASP:
        hero.isStunned = true;
        messages.push(`🕷️ Хватка! Не можете двигаться следующий ход`);
        break;
    }

    // Удалить жетон
    newState.tokens.splice(tokenIndex, 1);

    return { state: newState, messages };
  }

  // Завершить ход героя
  private endHeroTurn(state: GameState, hero: Hero): GameState {
    let newState = { ...state };
    const messages: string[] = [];

    // Проверить базу
    if (isOnBase(hero.position) && hero.side === 'human') {
      if (hero.stats.hp < hero.stats.maxHp) {
        hero.stats.hp = Math.min(hero.stats.maxHp, hero.stats.hp + 1);
        messages.push(`💚 +1 HP на базе (${hero.stats.hp}/${hero.stats.maxHp})`);
      }
      if (hero.stats.sanity < hero.stats.maxSanity) {
        hero.stats.sanity = Math.min(hero.stats.maxSanity, hero.stats.sanity + 1);
        messages.push(`💙 +1 Рассудок на базе (${hero.stats.sanity}/${hero.stats.maxSanity})`);
      }
    }

    // Потеря рассудка на Изнанке
    if (hero.side === 'shadow') {
      hero.stats.sanity = Math.max(0, hero.stats.sanity - 1);
      messages.push(`🌑 -1 Рассудок на Изнанке (${hero.stats.sanity})`);
      if (hero.stats.sanity === 0) {
        messages.push(`🌀 ${hero.type} сошёл с ума!`);
      }
    }

    // Снять оглушение
    if (hero.isStunned) {
      hero.isStunned = false;
      messages.push(`✅ Эффект Хватки снят`);
    }

    hero.hasActed = true;
    newState.messageLog = [...newState.messageLog, ...messages];

    return this.nextHero(newState);
  }

  // Следующий герой
  private nextHero(state: GameState): GameState {
    let newState = { ...state };

    // Сбросить флаг действия текущего героя
    const currentHero = newState.heroes[newState.currentHeroIndex];
    if (currentHero) {
      currentHero.hasActed = true;
    }

    // Найти следующего живого героя
    let nextIndex = (newState.currentHeroIndex + 1) % newState.heroes.length;
    let attempts = 0;

    while (attempts < newState.heroes.length) {
      const hero = newState.heroes[nextIndex];
      if (hero.stats.hp > 0 && hero.stats.sanity > 0 && !hero.hasActed) {
        newState.currentHeroIndex = nextIndex;
        return newState;
      }
      nextIndex = (nextIndex + 1) % newState.heroes.length;
      attempts++;
    }

    // Все герои походили - ход Тени
    return this.startShadowTurn(newState);
  }

  // Начать ход Тени
  private startShadowTurn(state: GameState): GameState {
    let newState = { ...state };

    // Сбросить флаги героев
    newState.heroes = newState.heroes.map((h) => ({ ...h, hasActed: false }));

    // Выполнить ход Тени
    newState = this.shadowAI.executeShadowTurn(newState);

    // Проверка победных условий
    const victory = checkVictory(newState);
    if (victory.winner) {
      newState.gameOver = true;
      newState.winner = victory.winner;
      newState.messageLog.push(`\n🏆 ${victory.reason}`);
      newState.phase = GamePhase.GAME_OVER;
      return newState;
    }

    // Начать ход героев
    newState.phase = GamePhase.HERO_TURN;
    newState.currentHeroIndex = 0;
    newState.messageLog.push(`\n--- ХОД ГЕРОЕВ ---`);

    return newState;
  }

  private posToStr(p: Position): string {
    return `${String.fromCharCode(65 + p.col)}${p.row + 1}`;
  }
}
