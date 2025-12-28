// Типы для игры "Разлом"

export type Position = {
  row: number; // 0-7 (соответствует 1-8)
  col: number; // 0-7 (соответствует A-H)
};

export type Side = 'human' | 'shadow'; // Сторона Людей или Изнанка

export const HeroType = {
  WARRIOR: 'Воин',
  HUNTER: 'Охотник',
  PRIEST: 'Жрец',
  SCOUT: 'Следопыт',
  MEDIC: 'Медик',
} as const;

export type HeroType = (typeof HeroType)[keyof typeof HeroType];

export const MonsterType = {
  CREATURE: 'Тварь',
  HUNTER: 'Охотник',
  GUARDIAN: 'Страж',
  SHADOW_WHISPER: 'Тень-шёпот',
} as const;

export type MonsterType = (typeof MonsterType)[keyof typeof MonsterType];

export type HeroStats = {
  maxHp: number;
  hp: number;
  attack: number;
  maxSanity: number;
  sanity: number;
};

export type Hero = {
  id: string;
  type: HeroType;
  stats: HeroStats;
  position: Position;
  side: Side;
  hasActed: boolean;
  closingPortalProgress: number; // 0-2 (нужно 3 хода)
  isStunned: boolean; // Для эффекта "Хватка"
};

export type Monster = {
  id: string;
  type: MonsterType;
  hp: number;
  maxHp: number;
  attack: number;
  speed: number;
  position: Position;
  side: Side;
  hasActed: boolean;
};

export const CardType = {
  RIFT: 'Разлом',
  SUMMON_CREATURE: 'Призыв Твари',
  SUMMON_HUNTER: 'Призыв Охотника',
  SUMMON_GUARDIAN: 'Призыв Стража',
  SUMMON_WHISPER: 'Призыв Шёпота',
  PAIN: 'Боль',
  WHISPER: 'Шёпот',
  TRAP: 'Ловушка',
  AMBUSH: 'Засада',
  PUSHBACK: 'Отброс',
  GRASP: 'Хватка',
} as const;

export type CardType = (typeof CardType)[keyof typeof CardType];

export type Card = {
  type: CardType;
};

export type Token = {
  id: string;
  position: Position;
  side: Side;
  revealed: boolean;
  card: Card;
};

export type Portal = {
  id: string;
  position: Position;
  isOpen: boolean;
  isActive: boolean; // false если закрыт
};

export type HeartOfDarkness = {
  hp: number;
  maxHp: number;
  position: Position;
};

export const GamePhase = {
  SHADOW_TURN: 'shadow',
  HERO_TURN: 'hero',
  GAME_OVER: 'gameover',
} as const;

export type GamePhase = (typeof GamePhase)[keyof typeof GamePhase];

export type GameState = {
  turn: number; // Счётчик Тьмы (0-20)
  phase: GamePhase;
  currentHeroIndex: number;

  heroes: Hero[];
  monsters: Monster[];
  tokens: Token[];
  portals: Portal[];

  heartOfDarkness: HeartOfDarkness;

  shadowDeck: Card[];
  shadowHand: Card[];
  shadowDiscard: Card[];

  gameOver: boolean;
  winner: 'heroes' | 'shadow' | null;

  messageLog: string[];
};

export type HeroAction =
  | { type: 'move'; position: Position }
  | { type: 'attack'; targetId: string }
  | { type: 'enterPortal' }
  | { type: 'deactivate' }
  | { type: 'closePortal' }
  | { type: 'endTurn' };

export const HERO_STATS: Record<HeroType, Omit<HeroStats, 'hp' | 'sanity'>> = {
  [HeroType.WARRIOR]: { maxHp: 6, attack: 3, maxSanity: 2 },
  [HeroType.HUNTER]: { maxHp: 4, attack: 4, maxSanity: 2 },
  [HeroType.PRIEST]: { maxHp: 4, attack: 2, maxSanity: 4 },
  [HeroType.SCOUT]: { maxHp: 4, attack: 2, maxSanity: 4 },
  [HeroType.MEDIC]: { maxHp: 3, attack: 1, maxSanity: 5 },
};

export const MONSTER_STATS: Record<MonsterType, { maxHp: number; attack: number; speed: number }> = {
  [MonsterType.CREATURE]: { maxHp: 2, attack: 1, speed: 2 },
  [MonsterType.HUNTER]: { maxHp: 3, attack: 2, speed: 3 },
  [MonsterType.GUARDIAN]: { maxHp: 5, attack: 2, speed: 1 },
  [MonsterType.SHADOW_WHISPER]: { maxHp: 2, attack: 1, speed: 2 },
};

export const PORTAL_EFFECTS = {
  4: { handLimit: 6, tokensPerTurn: 3, heartHp: 20 },
  3: { handLimit: 5, tokensPerTurn: 2, heartHp: 16 },
  2: { handLimit: 4, tokensPerTurn: 2, heartHp: 12 },
  1: { handLimit: 3, tokensPerTurn: 1, heartHp: 8 },
  0: { handLimit: 2, tokensPerTurn: 0, heartHp: 5 },
};
