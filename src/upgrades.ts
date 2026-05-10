import { Upgrade } from './types';

export const UPGRADES: Upgrade[] = [
  {
    id: 'firerate',
    name: 'Schnellfeuer',
    description: 'Erhöht die Feuerrate um 20%',
    onApply: (p) => ({ ...p, fireRate: p.fireRate * 1.2 }),
  },
  {
    id: 'damage',
    name: 'Energieschub',
    description: 'Erhöht den Schaden um 25%',
    onApply: (p) => ({ ...p, damage: p.damage * 1.25 }),
  },
  {
    id: 'speed',
    name: 'Hyper-Antrieb',
    description: 'Erhöht die Bewegungsgeschwindigkeit um 15%',
    onApply: (p) => ({ ...p, speed: p.speed * 1.15 }),
  },
  {
    id: 'health',
    name: 'Nano-Panzerung',
    description: 'Erhöht max. Gesundheit um 20 und heilt den Spieler',
    onApply: (p) => ({ 
      ...p, 
      maxHealth: p.maxHealth + 20, 
      health: Math.min(p.health + 40, p.maxHealth + 20) 
    }),
  },
  {
    id: 'projectiles',
    name: 'Mehrfachschuss',
    description: 'Fügt ein zusätzliches Projektil hinzu',
    onApply: (p) => ({ ...p, projCount: p.projCount + 1 }),
  },
  {
    id: 'lifesteal',
    name: 'Siphon-Impuls',
    description: 'Heilt 20 Gesundheitspunkte',
    onApply: (p) => ({ ...p, health: Math.min(p.health + 20, p.maxHealth) }),
  }
];

export function getRandomUpgrades(count: number): Upgrade[] {
  const shuffled = [...UPGRADES].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}
