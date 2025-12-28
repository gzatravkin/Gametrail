import type {
  GameState,
  Hero,
  Monster,
  Card,
  Position,
  Side,
  Portal,
  Token,
} from './types';
import {
  CardType,
  HeroType,
  MonsterType,
  HERO_STATS,
  MONSTER_STATS,
  PORTAL_EFFECTS,
  GamePhase,
} from './types';

// Утилиты для позиций
export function positionEquals(p1: Position, p2: Position): boolean {
  return p1.row === p2.row && p1.col === p2.col;
}

export function getDistance(p1: Position, p2: Position): number {
  return Math.abs(p1.row - p2.row) + Math.abs(p1.col - p2.col);
}

export function isAdjacent(p1: Position, p2: Position): boolean {
  return getDistance(p1, p2) === 1;
}

export function positionToString(p: Position): string {
  const col = String.fromCharCode(65 + p.col); // A-H
  const row = p.row + 1; // 1-8
  return `${col}${row}`;
}

// Создание колоды
export function createDeck(): Card[] {
  const deck: Card[] = [];

  // Добавляем карты согласно правилам
  for (let i = 0; i < 4; i++) deck.push({ type: CardType.RIFT });
  for (let i = 0; i < 4; i++) deck.push({ type: CardType.SUMMON_CREATURE });
  for (let i = 0; i < 3; i++) deck.push({ type: CardType.SUMMON_HUNTER });
  for (let i = 0; i < 2; i++) deck.push({ type: CardType.SUMMON_GUARDIAN });
  for (let i = 0; i < 2; i++) deck.push({ type: CardType.SUMMON_WHISPER });
  for (let i = 0; i < 3; i++) deck.push({ type: CardType.PAIN });
  for (let i = 0; i < 2; i++) deck.push({ type: CardType.WHISPER });
  for (let i = 0; i < 2; i++) deck.push({ type: CardType.TRAP });
  for (let i = 0; i < 2; i++) deck.push({ type: CardType.AMBUSH });
  for (let i = 0; i < 2; i++) deck.push({ type: CardType.PUSHBACK });
  for (let i = 0; i < 1; i++) deck.push({ type: CardType.GRASP });

  return shuffleDeck(deck);
}

export function shuffleDeck(deck: Card[]): Card[] {
  const newDeck = [...deck];
  for (let i = newDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
  }
  return newDeck;
}

// Создание героев
export function createHeroes(): Hero[] {
  const heroTypes = [HeroType.WARRIOR, HeroType.HUNTER, HeroType.PRIEST, HeroType.MEDIC];
  const basePosition = { row: 0, col: 0 }; // A1

  return heroTypes.map((type, index) => ({
    id: `hero-${index}`,
    type,
    stats: {
      ...HERO_STATS[type],
      hp: HERO_STATS[type].maxHp,
      sanity: HERO_STATS[type].maxSanity,
    },
    position: { ...basePosition, col: index < 2 ? 0 : 1 }, // A1-A2
    side: 'human' as Side,
    hasActed: false,
    closingPortalProgress: 0,
    isStunned: false,
  }));
}

// Подсчет активных порталов
export function countActivePortals(portals: Portal[]): number {
  return portals.filter((p) => p.isActive && p.isOpen).length;
}

// Получение эффектов порталов
export function getPortalEffects(portals: Portal[]) {
  const count = countActivePortals(portals) as 0 | 1 | 2 | 3 | 4;
  return PORTAL_EFFECTS[count] || PORTAL_EFFECTS[0];
}

// Проверка победных условий
export function checkVictory(state: GameState): { winner: 'heroes' | 'shadow' | null; reason: string } {
  // Тень побеждает если счетчик достиг 20
  if (state.turn >= 20) {
    return { winner: 'shadow', reason: 'Тьма поглотила мир (20 ходов прошло)' };
  }

  // Тень побеждает если все герои мертвы или безумны
  const aliveHeroes = state.heroes.filter((h) => h.stats.hp > 0 && h.stats.sanity > 0);
  if (aliveHeroes.length === 0) {
    return { winner: 'shadow', reason: 'Все герои погибли или сошли с ума' };
  }

  // Герои побеждают если Сердце Тьмы уничтожено
  if (state.heartOfDarkness.hp <= 0) {
    return { winner: 'heroes', reason: 'Сердце Тьмы уничтожено!' };
  }

  return { winner: null, reason: '' };
}

// Бросок кубика d6
export function rollDice(): number {
  return Math.floor(Math.random() * 6) + 1;
}

// Групповой бой
export function resolveCombat(
  attackers: { attack: number; id: string; name: string }[],
  defenders: { attack: number; id: string; name: string }[]
): {
  attackerDamage: number;
  defenderDamage: number;
  attackerRoll: number;
  defenderRoll: number;
} {
  const attackerTotal = attackers.reduce((sum, a) => sum + a.attack, 0);
  const defenderTotal = defenders.reduce((sum, d) => sum + d.attack, 0);

  const attackerRoll = rollDice();
  const defenderRoll = rollDice();

  const attackerScore = attackerTotal + attackerRoll;
  const defenderScore = defenderTotal + defenderRoll;

  let attackerDamage = 0;
  let defenderDamage = 0;

  if (attackerScore > defenderScore) {
    defenderDamage = Math.max(1, attackerScore - defenderScore);
  } else if (defenderScore > attackerScore) {
    attackerDamage = Math.max(1, defenderScore - attackerScore);
  } else {
    // Ничья
    attackerDamage = 1;
    defenderDamage = 1;
  }

  return { attackerDamage, defenderDamage, attackerRoll, defenderRoll };
}

// Проверка может ли герой выполнить действие
export function canHeroAct(hero: Hero): boolean {
  return hero.stats.hp > 0 && hero.stats.sanity > 0 && !hero.hasActed;
}

// Проверка находится ли герой на базе
export function isOnBase(position: Position): boolean {
  return (position.row === 0 && position.col === 0) || (position.row === 0 && position.col === 1);
}

// Получение существа по позиции
export function getEntityAtPosition(
  position: Position,
  side: Side,
  heroes: Hero[],
  monsters: Monster[]
): Hero | Monster | null {
  const hero = heroes.find((h) => positionEquals(h.position, position) && h.side === side);
  if (hero) return hero;

  const monster = monsters.find((m) => positionEquals(m.position, position) && m.side === side);
  if (monster) return monster;

  return null;
}

// Проверка блокировки входа в портал Стражем
export function isPortalBlockedByGuardian(
  position: Position,
  side: Side,
  monsters: Monster[]
): boolean {
  return monsters.some(
    (m) =>
      m.type === MonsterType.GUARDIAN &&
      m.side === side &&
      m.hp > 0 &&
      isAdjacent(m.position, position)
  );
}

// Получить соседние клетки
export function getAdjacentPositions(position: Position): Position[] {
  const adjacent: Position[] = [];
  const directions = [
    { row: -1, col: 0 },
    { row: 1, col: 0 },
    { row: 0, col: -1 },
    { row: 0, col: 1 },
  ];

  for (const dir of directions) {
    const newPos = { row: position.row + dir.row, col: position.col + dir.col };
    if (newPos.row >= 0 && newPos.row < 8 && newPos.col >= 0 && newPos.col < 8) {
      adjacent.push(newPos);
    }
  }

  return adjacent;
}

// Создание монстра
export function createMonster(
  type: MonsterType,
  position: Position,
  side: Side,
  idCounter: number
): Monster {
  const stats = MONSTER_STATS[type];
  return {
    id: `monster-${idCounter}`,
    type,
    hp: stats.maxHp,
    maxHp: stats.maxHp,
    attack: stats.attack,
    speed: stats.speed,
    position,
    side,
    hasActed: false,
  };
}

// Инициализация игрового состояния
export function initializeGame(): GameState {
  const deck = createDeck();
  const heroes = createHeroes();

  // Тень берет 6 карт для начальных жетонов
  const initialCards = deck.splice(0, 6);

  // 4 карты Разлома (порталы) + 2 проклятия
  const riftCards = initialCards.filter((c) => c.type === CardType.RIFT);
  const curseCards = initialCards.filter((c) => c.type !== CardType.RIFT);

  // Создаем жетоны (размещаем случайно на стороне Людей, кроме базы)
  const tokens: Token[] = [];
  const usedPositions: Set<string> = new Set(['0-0', '0-1']); // База

  [...riftCards, ...curseCards].forEach((card, index) => {
    let position: Position;
    do {
      position = {
        row: Math.floor(Math.random() * 8),
        col: Math.floor(Math.random() * 8),
      };
    } while (usedPositions.has(`${position.row}-${position.col}`));

    usedPositions.add(`${position.row}-${position.col}`);

    tokens.push({
      id: `token-${index}`,
      position,
      side: 'human',
      revealed: false,
      card,
    });
  });

  // Создаем порталы (еще не открыты)
  const portals: Portal[] = tokens
    .filter((t) => t.card.type === CardType.RIFT)
    .map((t) => ({
      id: t.id,
      position: t.position,
      isOpen: false,
      isActive: true,
    }));

  // Создаем начальных монстров (2 Твари + 1 Охотник)
  const monsters: Monster[] = [];
  let monsterCounter = 0;

  for (let i = 0; i < 2; i++) {
    let position: Position;
    do {
      position = {
        row: Math.floor(Math.random() * 8),
        col: Math.floor(Math.random() * 8),
      };
    } while (usedPositions.has(`${position.row}-${position.col}`));

    usedPositions.add(`${position.row}-${position.col}`);
    monsters.push(createMonster(MonsterType.CREATURE, position, 'human', monsterCounter++));
  }

  // Добавляем Охотника
  let hunterPos: Position;
  do {
    hunterPos = {
      row: Math.floor(Math.random() * 8),
      col: Math.floor(Math.random() * 8),
    };
  } while (usedPositions.has(`${hunterPos.row}-${hunterPos.col}`));

  monsters.push(createMonster(MonsterType.HUNTER, hunterPos, 'human', monsterCounter++));

  return {
    turn: 0,
    phase: GamePhase.SHADOW_TURN,
    currentHeroIndex: 0,
    heroes,
    monsters,
    tokens,
    portals,
    heartOfDarkness: {
      hp: 20,
      maxHp: 20,
      position: { row: 7, col: 7 }, // H8
    },
    shadowDeck: deck,
    shadowHand: [],
    shadowDiscard: [],
    gameOver: false,
    winner: null,
    messageLog: ['Игра началась! Тьма наступает...'],
  };
}
