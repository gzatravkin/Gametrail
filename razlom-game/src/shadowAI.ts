import type {
  GameState,
  Position,
  Token,
  Side,
} from './types';
import {
  CardType,
  MonsterType,
} from './types';
import {
  getPortalEffects,
  countActivePortals,
  positionEquals,
  getAdjacentPositions,
  getDistance,
  createMonster,
} from './gameLogic';

// AI для Тени
export class ShadowAI {
  private monsterIdCounter: number;

  constructor() {
    this.monsterIdCounter = 1000;
  }

  // Выполнить ход Тени
  executeShadowTurn(state: GameState): GameState {
    let newState = { ...state };
    const messages: string[] = [];

    messages.push(`\n--- ХОД ТЕНИ ${newState.turn + 1} ---`);

    // 1. Увеличить счетчик Тьмы
    newState.turn += 1;
    messages.push(`Счётчик Тьмы: ${newState.turn}/20`);

    // 2. Проверка порталов (на ходу 3 открываются)
    if (newState.turn === 3) {
      messages.push('🌀 РАЗЛОМЫ ОТКРЫВАЮТСЯ!');
      newState.portals = newState.portals.map((p) => ({ ...p, isOpen: true }));
      newState.tokens = newState.tokens.filter((t) => t.card.type !== CardType.RIFT);
    }

    // 3. Добор карт до лимита
    const effects = getPortalEffects(newState.portals);
    while (newState.shadowHand.length < effects.handLimit && newState.shadowDeck.length > 0) {
      const card = newState.shadowDeck.pop()!;
      newState.shadowHand.push(card);
    }

    messages.push(`Карт в руке Тени: ${newState.shadowHand.length}/${effects.handLimit}`);

    // 4. Розыгрыш карт (призывы)
    if (newState.turn >= 3) {
      const summonResult = this.playSummonCards(newState);
      newState = summonResult.state;
      messages.push(...summonResult.messages);
    }

    // 5. Размещение жетонов
    if (newState.turn >= 3 && effects.tokensPerTurn > 0) {
      const tokenResult = this.placeTokens(newState, effects.tokensPerTurn);
      newState = tokenResult.state;
      messages.push(...tokenResult.messages);
    }

    // 6. Движение монстров
    const moveResult = this.moveMonsters(newState);
    newState = moveResult.state;
    messages.push(...moveResult.messages);

    // 7. Атаки монстров
    const attackResult = this.attackWithMonsters(newState);
    newState = attackResult.state;
    messages.push(...attackResult.messages);

    // Обновить лог
    newState.messageLog = [...newState.messageLog, ...messages];

    // Сбросить флаги действий монстров
    newState.monsters = newState.monsters.map((m) => ({ ...m, hasActed: false }));

    return newState;
  }

  // Разыграть карты призыва
  private playSummonCards(state: GameState): { state: GameState; messages: string[] } {
    const newState = { ...state };
    const messages: string[] = [];
    const activePortals = newState.portals.filter((p) => p.isActive && p.isOpen);
    const portalCount = countActivePortals(newState.portals);

    if (activePortals.length === 0) {
      return { state: newState, messages };
    }

    // Определяем какие монстры можем призывать
    const canSummon = (cardType: CardType): boolean => {
      if (cardType === CardType.SUMMON_CREATURE) return portalCount >= 1;
      if (cardType === CardType.SUMMON_HUNTER) return portalCount >= 2;
      if (cardType === CardType.SUMMON_GUARDIAN) return portalCount >= 3;
      if (cardType === CardType.SUMMON_WHISPER) return portalCount >= 3;
      return false;
    };

    // Попытаться призвать монстров
    const summonCards = newState.shadowHand.filter(
      (c) =>
        c.type === CardType.SUMMON_CREATURE ||
        c.type === CardType.SUMMON_HUNTER ||
        c.type === CardType.SUMMON_GUARDIAN ||
        c.type === CardType.SUMMON_WHISPER
    );

    for (const card of summonCards) {
      if (!canSummon(card.type)) continue;

      // Выбираем портал (приоритет - ближайший к героям)
      const portal = this.selectPortalForSummon(activePortals, newState);
      if (!portal) continue;

      // Проверяем свободно ли место
      const occupied = [
        ...newState.monsters.map((m) => m.position),
        ...newState.heroes.map((h) => h.position),
      ].some((p) => positionEquals(p, portal.position));

      if (occupied) continue;

      // Создаем монстра
      let monsterType: MonsterType;
      if (card.type === CardType.SUMMON_CREATURE) monsterType = MonsterType.CREATURE;
      else if (card.type === CardType.SUMMON_HUNTER) monsterType = MonsterType.HUNTER;
      else if (card.type === CardType.SUMMON_GUARDIAN) monsterType = MonsterType.GUARDIAN;
      else monsterType = MonsterType.SHADOW_WHISPER;

      const monster = createMonster(
        monsterType,
        portal.position,
        portal.position.row === 7 && portal.position.col === 7 ? 'shadow' : 'human',
        this.monsterIdCounter++
      );

      newState.monsters.push(monster);
      newState.shadowHand = newState.shadowHand.filter((c) => c !== card);
      newState.shadowDiscard.push(card);

      messages.push(`👹 Призван ${monsterType} на портале ${this.posToStr(portal.position)}`);
    }

    return { state: newState, messages };
  }

  // Выбрать портал для призыва (ближайший к героям)
  private selectPortalForSummon(portals: any[], state: GameState): any {
    const aliveHeroes = state.heroes.filter((h) => h.stats.hp > 0);
    if (aliveHeroes.length === 0) return portals[0];

    let bestPortal = portals[0];
    let minDistance = Infinity;

    for (const portal of portals) {
      for (const hero of aliveHeroes) {
        const dist = getDistance(portal.position, hero.position);
        if (dist < minDistance) {
          minDistance = dist;
          bestPortal = portal;
        }
      }
    }

    return bestPortal;
  }

  // Разместить жетоны
  private placeTokens(state: GameState, count: number): { state: GameState; messages: string[] } {
    const newState = { ...state };
    const messages: string[] = [];

    // Выбираем карты проклятий из руки
    const curseCards = newState.shadowHand.filter(
      (c) =>
        c.type === CardType.PAIN ||
        c.type === CardType.WHISPER ||
        c.type === CardType.TRAP ||
        c.type === CardType.AMBUSH ||
        c.type === CardType.PUSHBACK ||
        c.type === CardType.GRASP
    );

    let placed = 0;
    for (let i = 0; i < Math.min(count, curseCards.length); i++) {
      const card = curseCards[i];

      // Найти подходящую позицию (в радиусе 1 от монстра)
      const position = this.findTokenPosition(newState);
      if (!position) continue;

      // Определяем сторону по карте
      const side: Side =
        card.type === CardType.PAIN ||
        card.type === CardType.WHISPER ||
        card.type === CardType.TRAP
          ? 'human'
          : 'shadow';

      const token: Token = {
        id: `token-${Date.now()}-${i}`,
        position,
        side,
        revealed: false,
        card,
      };

      newState.tokens.push(token);
      newState.shadowHand = newState.shadowHand.filter((c) => c !== card);

      placed++;
      messages.push(`🎯 Размещён жетон на ${this.posToStr(position)}`);
    }

    if (placed > 0) {
      messages.push(`Всего жетонов размещено: ${placed}`);
    }

    return { state: newState, messages };
  }

  // Найти позицию для жетона (в радиусе 1 от монстра)
  private findTokenPosition(state: GameState): Position | null {
    const monsters = state.monsters.filter((m) => m.hp > 0);
    if (monsters.length === 0) return null;

    // Попытаться разместить около монстров
    for (const monster of monsters) {
      const adjacent = getAdjacentPositions(monster.position);
      for (const pos of adjacent) {
        // Проверяем что позиция свободна
        const occupied =
          [...state.monsters, ...state.heroes].some((e) => positionEquals(e.position, pos)) ||
          state.tokens.some((t) => positionEquals(t.position, pos));

        if (!occupied) {
          return pos;
        }
      }
    }

    return null;
  }

  // Двигать монстров к целям
  private moveMonsters(state: GameState): { state: GameState; messages: string[] } {
    const newState = { ...state };
    const messages: string[] = [];

    const aliveHeroes = newState.heroes.filter((h) => h.stats.hp > 0 && h.stats.sanity > 0);

    for (const monster of newState.monsters) {
      if (monster.hp <= 0) continue;

      // Найти ближайшего героя на той же стороне
      const targets = aliveHeroes.filter((h) => h.side === monster.side);
      if (targets.length === 0) continue;

      let closestHero = targets[0];
      let minDist = getDistance(monster.position, closestHero.position);

      for (const hero of targets) {
        const dist = getDistance(monster.position, hero.position);
        if (dist < minDist) {
          minDist = dist;
          closestHero = hero;
        }
      }

      // Двигаемся к цели
      const movesCount = monster.type === MonsterType.HUNTER ? 2 : 1;
      for (let i = 0; i < Math.min(movesCount, monster.speed); i++) {
        const nextPos = this.getNextMoveTowards(monster.position, closestHero.position, newState);
        if (nextPos && !positionEquals(nextPos, monster.position)) {
          monster.position = nextPos;
        }
      }
    }

    return { state: newState, messages };
  }

  // Получить следующий ход в направлении цели
  private getNextMoveTowards(from: Position, to: Position, state: GameState): Position | null {
    const adjacent = getAdjacentPositions(from);
    let bestPos = from;
    let bestDist = getDistance(from, to);

    for (const pos of adjacent) {
      // Проверяем что клетка не занята
      const monsterOccupied = state.monsters.some(
        (m) => positionEquals(m.position, pos) && m.hp > 0
      );
      const heroOccupied = state.heroes.some(
        (h) => positionEquals(h.position, pos) && h.stats.hp > 0
      );

      if (!monsterOccupied && !heroOccupied) {
        const dist = getDistance(pos, to);
        if (dist < bestDist) {
          bestDist = dist;
          bestPos = pos;
        }
      }
    }

    return bestPos;
  }

  // Атаковать героев
  private attackWithMonsters(state: GameState): { state: GameState; messages: string[] } {
    const newState = { ...state };
    const messages: string[] = [];

    for (const monster of newState.monsters) {
      if (monster.hp <= 0) continue;

      // Найти героев в радиусе 1
      const targets = newState.heroes.filter(
        (h) =>
          h.stats.hp > 0 &&
          h.stats.sanity > 0 &&
          h.side === monster.side &&
          getDistance(h.position, monster.position) === 1
      );

      if (targets.length > 0) {
        const target = targets[Math.floor(Math.random() * targets.length)];

        // Простая атака
        if (monster.type === MonsterType.SHADOW_WHISPER) {
          target.stats.sanity = Math.max(0, target.stats.sanity - monster.attack);
          messages.push(
            `👻 ${monster.type} атакует ${target.type}: -${monster.attack} рассудка (осталось ${target.stats.sanity})`
          );
        } else {
          target.stats.hp = Math.max(0, target.stats.hp - monster.attack);
          messages.push(
            `⚔️ ${monster.type} атакует ${target.type}: -${monster.attack} HP (осталось ${target.stats.hp})`
          );
        }

        if (target.stats.hp === 0) {
          messages.push(`💀 ${target.type} погиб!`);
        } else if (target.stats.sanity === 0) {
          messages.push(`🌀 ${target.type} сошёл с ума!`);
        }
      }
    }

    return { state: newState, messages };
  }

  private posToStr(p: Position): string {
    return `${String.fromCharCode(65 + p.col)}${p.row + 1}`;
  }
}
