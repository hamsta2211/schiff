export interface Vector {
  x: number;
  y: number;
}

export interface Entity {
  id: string;
  pos: Vector;
  vel: Vector;
  radius: number;
  color: string;
}

export interface Player extends Entity {
  health: number;
  maxHealth: number;
  speed: number;
  level: number;
  xp: number;
  xpNext: number;
  score: number;
  fireRate: number; // bullets per second
  damage: number;
  projCount: number;
}

export interface Enemy extends Entity {
  health: number;
  maxHealth: number;
  speed: number;
  damage: number;
  value: number; // XP value
}

export interface Bullet extends Entity {
  damage: number;
  distanceTraveled: number;
  maxDistance: number;
}

export interface XPOrb extends Entity {
  value: number;
}

export interface Particle extends Entity {
  life: number;
  maxLife: number;
  opacity: number;
}

export type GameState = 'MENU' | 'PLAYING' | 'PAUSED' | 'LEVEL_UP' | 'GAME_OVER' | 'AUTH' | 'LEADERBOARD' | 'BOSS_INTRO' | 'BOSS_FIGHT' | 'ARROW_DASH' | 'ARROW_DASH_TELEPORT' | 'ARROW_DASH_BOSS' | 'ARROW_DASH_GAME_OVER' | 'ARROW_DASH_PAUSED' | 'ARROW_DASH_COUNTDOWN' | 'ARROW_DASH_MENU' | 'ARROW_DASH_LEADERBOARD';

export interface Upgrade {
  id: string;
  name: string;
  description: string;
  onApply: (player: Player) => Player;
}
