import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Player, Enemy, Bullet, XPOrb, Particle, Vector, GameState, Entity } from '../types';

interface NeonCanvasProps {
  gameState: GameState;
  onLevelUp: (player: Player) => void;
  onGameOver: (score: number) => void;
  onScoreUpdate?: (score: number) => void;
  onStatsUpdate?: (stats: { health: number; maxHealth: number; level: number; xp: number; xpNext: number }) => void;
  onDamage?: () => void;
  onBossStart?: () => void;
  onBossEnd?: () => void;
  playerStats: Partial<Player>;
  joystickDir?: Vector;
  startLevel?: number;
}

const COLORS = {
  player: '#00ccff',
  enemyPrimary: '#ff0055',
  enemySecondary: '#ff9900',
  bullet: '#ffffff',
  xp: '#00ff00',
  background: '#050a14',
  grid: '#1a2a4a'
};

export const NeonCanvas: React.FC<NeonCanvasProps> = ({ 
  gameState, 
  onLevelUp, 
  onGameOver,
  onScoreUpdate,
  onStatsUpdate,
  onDamage,
  onBossStart,
  onBossEnd,
  playerStats,
  joystickDir,
  startLevel = 1
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(null);
  
  // Game Entities Refs (to avoid Re-renders)
  const playerRef = useRef<Player>({
    id: 'player',
    pos: { x: 400, y: 300 },
    vel: { x: 0, y: 0 },
    radius: 12,
    color: COLORS.player,
    health: 100 + (Math.max(1, startLevel) - 1) * 20,
    maxHealth: 100 + (Math.max(1, startLevel) - 1) * 20,
    speed: 4 + (Math.max(1, startLevel) > 5 ? 1 : 0),
    level: Math.max(1, startLevel),
    xp: 0,
    xpNext: 100 * Math.max(1, startLevel),
    score: 0,
    fireRate: 3 + (Math.max(1, startLevel) - 1) * 0.5,
    damage: 10 + (Math.max(1, startLevel) - 1) * 5,
    projCount: 1 + Math.floor((Math.max(1, startLevel) - 1) / 3),
  });

  // Sync player stats from props (Level Up rewards)
  useEffect(() => {
    if (playerStats && Object.keys(playerStats).length > 0) {
      // We only want to merge "functional" stats from upgrades, 
      // not the persistent game state like score, position, etc.
      // which the game logic handles internally in the ref.
      const { 
        score, xp, xpNext, pos, vel, level, id, color, 
        ...upgradableStats 
      } = playerStats as any;
      
      playerRef.current = {
        ...playerRef.current,
        ...upgradableStats
      };
    }
  }, [playerStats]);

  // Reset on Menu or Game Over
  useEffect(() => {
    if (gameState === 'MENU' || gameState === 'GAME_OVER') {
      // Reset logic
      enemiesRef.current = [];
      bossRef.current = null;
      lastBossSpawnLevelRef.current = -1;
      bulletsRef.current = [];
      xpOrbsRef.current = [];
      particlesRef.current = [];
      spawnTimerRef.current = 0;
      
      playerRef.current = {
        id: 'player',
        pos: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
        vel: { x: 0, y: 0 },
        radius: 12,
        color: COLORS.player,
        health: 100 + (startLevel - 1) * 20,
        maxHealth: 100 + (startLevel - 1) * 20,
        speed: 4 + (startLevel > 5 ? 1 : 0),
        level: startLevel,
        xp: 0,
        xpNext: 100 * startLevel,
        score: 0,
        fireRate: 3 + (startLevel - 1) * 0.5,
        damage: 10 + (startLevel - 1) * 5,
        projCount: 1 + Math.floor((startLevel - 1) / 3),
      };
    }
  }, [gameState, startLevel]);

  const enemiesRef = useRef<Enemy[]>([]);
  const bossRef = useRef<Enemy | null>(null);
  const lastBossSpawnLevelRef = useRef<number>(-1);
  const bulletsRef = useRef<Bullet[]>([]);
  const xpOrbsRef = useRef<XPOrb[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const keysRef = useRef<Set<string>>(new Set());
  const lastFireRef = useRef<number>(0);
  const lastBossFireRef = useRef<number>(0);
  const spawnTimerRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const joystickDirRef = useRef<Vector>({ x: 0, y: 0 });
  const arenaTransitionRef = useRef(0);

  // Update joystick ref whenever prop changes
  useEffect(() => {
    if (joystickDir) {
      joystickDirRef.current = joystickDir;
    }
  }, [joystickDir]);

  // Input Handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => keysRef.current.add(e.code);
    const handleKeyUp = (e: KeyboardEvent) => keysRef.current.delete(e.code);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const spawnEnemy = useCallback((width: number, height: number) => {
    const side = Math.floor(Math.random() * 4);
    let x = 0, y = 0;
    const margin = 50;

    if (side === 0) { x = Math.random() * width; y = -margin; }
    else if (side === 1) { x = width + margin; y = Math.random() * height; }
    else if (side === 2) { x = Math.random() * width; y = height + margin; }
    else { x = -margin; y = Math.random() * height; }

    const level = playerRef.current.level;
    const isElite = Math.random() < (0.05 + level * 0.01);

    enemiesRef.current.push({
      id: Math.random().toString(),
      pos: { x, y },
      vel: { x: 0, y: 0 },
      radius: isElite ? 18 : 10,
      color: isElite ? COLORS.enemySecondary : COLORS.enemyPrimary,
      health: (10 + level * 5) * (isElite ? 3 : 1),
      maxHealth: (10 + level * 5) * (isElite ? 3 : 1),
      speed: (1.5 + Math.random() * 0.5) * (isElite ? 0.8 : 1),
      damage: 10 + Math.floor(level / 2),
      value: isElite ? 50 : 15,
    });
  }, []);

  const spawnBoss = useCallback((width: number, height: number) => {
    const level = playerRef.current.level;
    bossRef.current = {
      id: 'boss-' + level,
      pos: { x: width / 2, y: -100 },
      vel: { x: 0, y: 0 },
      radius: 40,
      color: '#ff00ff',
      health: 5000 + level * 1000,
      maxHealth: 5000 + level * 1000,
      speed: 1,
      damage: 25,
      value: 100,
    };
  }, []);

  const createExplosion = (pos: Vector, color: string, count: number = 10) => {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 4 + 1;
        particlesRef.current.push({
            id: Math.random().toString(),
            pos: { ...pos },
            vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
            radius: Math.random() * 3 + 1,
            color,
            life: 1,
            maxLife: 1,
            opacity: 1
        });
    }
  };

  const gameLoop = useCallback((time: number) => {
    if (gameState !== 'PLAYING' && gameState !== 'BOSS_INTRO' && gameState !== 'BOSS_FIGHT' && gameState !== 'PAUSED') {
      requestRef.current = requestAnimationFrame(gameLoop);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    const p = playerRef.current;
    
    if (gameState === 'PLAYING' || gameState === 'BOSS_INTRO' || gameState === 'BOSS_FIGHT') {
      frameCountRef.current++;

      // Boss milestone detection
      const isBossMilestone = p.level > 0 && p.level % 10 === 0;
      if (gameState === 'PLAYING' && isBossMilestone && !bossRef.current && p.level !== lastBossSpawnLevelRef.current) {
        lastBossSpawnLevelRef.current = p.level;
        if (onBossStart) onBossStart();
        enemiesRef.current = []; // Clear small fry
        spawnBoss(width, height);
      }

      // 1. Update Player
      let dx = 0, dy = 0;
    
    // Keyboard Input
    if (keysRef.current.has('KeyW') || keysRef.current.has('ArrowUp')) dy -= 1;
    if (keysRef.current.has('KeyS') || keysRef.current.has('ArrowDown')) dy += 1;
    if (keysRef.current.has('KeyA') || keysRef.current.has('ArrowLeft')) dx -= 1;
    if (keysRef.current.has('KeyD') || keysRef.current.has('ArrowRight')) dx += 1;

    // Joystick Input
    const jDir = joystickDirRef.current;
    if (jDir.x !== 0 || jDir.y !== 0) {
      dx = jDir.x;
      dy = jDir.y;
    }

    if (dx !== 0 || dy !== 0) {
      if (jDir.x === 0 && jDir.y === 0) {
        const mag = Math.sqrt(dx * dx + dy * dy);
        dx /= mag;
        dy /= mag;
      }
      p.pos.x += dx * p.speed;
      p.pos.y += dy * p.speed;
    }

    p.pos.x = Math.max(p.radius, Math.min(width - p.radius, p.pos.x));
    p.pos.y = Math.max(p.radius, Math.min(height - p.radius, p.pos.y));

    // 2. Firing Logic
    const now = Date.now();
    const hasTargets = enemiesRef.current.length > 0 || bossRef.current;
    if (now - lastFireRef.current > 1000 / p.fireRate && hasTargets) {
      lastFireRef.current = now;
      
      let nearest: Entity | null = null;
      let minDist = Infinity;
      
      if (bossRef.current) {
        nearest = bossRef.current;
      } else {
        for (const e of enemiesRef.current) {
          const d = Math.sqrt((e.pos.x - p.pos.x)**2 + (e.pos.y - p.pos.y)**2);
          if (d < minDist) {
            minDist = d;
            nearest = e;
          }
        }
      }

      if (nearest) {
        const angle = Math.atan2(nearest.pos.y - p.pos.y, nearest.pos.x - p.pos.x);
        const spread = 0.2;
        const baseAngle = angle - ((p.projCount - 1) * spread) / 2;

        for (let i = 0; i < p.projCount; i++) {
          const shootAngle = baseAngle + i * spread;
          bulletsRef.current.push({
            id: Math.random().toString(),
            pos: { ...p.pos },
            vel: { x: Math.cos(shootAngle) * 8, y: Math.sin(shootAngle) * 8 },
            radius: 4,
            color: COLORS.bullet,
            damage: p.damage,
            distanceTraveled: 0,
            maxDistance: 800
          });
        }
      }
    }

    // 3. Spawning
    if (gameState === 'PLAYING') {
      spawnTimerRef.current--;
      if (spawnTimerRef.current <= 0) {
        spawnEnemy(width, height);
        spawnTimerRef.current = Math.max(10, 60 - p.level * 2);
      }
    }

    // Arena Transition Logic
    if (gameState === 'BOSS_INTRO' || gameState === 'BOSS_FIGHT') {
      arenaTransitionRef.current = Math.min(1, arenaTransitionRef.current + 0.01);
    } else {
      arenaTransitionRef.current = Math.max(0, arenaTransitionRef.current - 0.01);
    }

    // Boss Behavior
    if (bossRef.current) {
      const b = bossRef.current;
      // Hover at top with sine wave
      const targetX = width / 2 + Math.sin(frameCountRef.current * 0.02) * (width * 0.3);
      const targetY = 150 + Math.cos(frameCountRef.current * 0.01) * 50;
      
      b.pos.x += (targetX - b.pos.x) * 0.02;
      b.pos.y += (targetY - b.pos.y) * 0.02;

      // Boss pattern: Circular burst every 2.5 seconds
      if (now - lastBossFireRef.current > 2500) {
        lastBossFireRef.current = now;
        const bulletCount = 8 + Math.floor(p.level / 5);
        for(let i=0; i<bulletCount; i++) {
          const angle = (Math.PI * 2 / bulletCount) * i + (frameCountRef.current * 0.1);
          enemiesRef.current.push({
            id: 'boss-bullet-' + Math.random(),
            pos: { ...b.pos },
            vel: { x: Math.cos(angle) * 3, y: Math.sin(angle) * 3 },
            radius: 8,
            color: '#ff00ff',
            health: 1,
            maxHealth: 1,
            speed: 3,
            damage: 5,
            value: 0
          });
        }
      }
    }

    // Periodically update score and stats
    if (frameCountRef.current % 10 === 0) {
      if (onScoreUpdate) onScoreUpdate(p.score);
      if (onStatsUpdate) {
        onStatsUpdate({
          health: p.health,
          maxHealth: p.maxHealth,
          level: p.level,
          xp: p.xp,
          xpNext: p.xpNext
        });
      }
    }

    // 4. Update Entities
    enemiesRef.current.forEach(e => {
        // Boss bullets move straight, regular enemies home in
        if (e.value > 0) {
          const angle = Math.atan2(p.pos.y - e.pos.y, p.pos.x - e.pos.x);
          e.vel.x = Math.cos(angle) * e.speed;
          e.vel.y = Math.sin(angle) * e.speed;
        }
        e.pos.x += e.vel.x;
        e.pos.y += e.vel.y;

        const d = Math.sqrt((e.pos.x - p.pos.x)**2 + (e.pos.y - p.pos.y)**2);
        if (d < e.radius + p.radius) {
            const damage = e.damage / (e.value === 0 ? 1 : 60);
            p.health -= damage;
            if (e.value === 0) e.health = 0; // Boss bullet disappears
            if (onDamage && frameCountRef.current % 10 === 0) onDamage();
            if (p.health <= 0) onGameOver(p.score);
        }
    });

    // Bullets
    bulletsRef.current.forEach(b => {
        b.pos.x += b.vel.x;
        b.pos.y += b.vel.y;
        b.distanceTraveled += Math.sqrt(b.vel.x**2 + b.vel.y**2);

        // Enemy Collision
        enemiesRef.current.forEach(e => {
            const d = Math.sqrt((e.pos.x - b.pos.x)**2 + (e.pos.y - b.pos.y)**2);
            if (d < e.radius + b.radius) {
                e.health -= b.damage;
                b.distanceTraveled = b.maxDistance + 1;
                
                if (e.health <= 0 && e.value > 0) {
                    createExplosion(e.pos, e.color);
                    xpOrbsRef.current.push({
                        id: Math.random().toString(),
                        pos: { ...e.pos },
                        vel: { x: (Math.random()-0.5)*2, y: (Math.random()-0.5)*2 },
                        radius: 5,
                        color: COLORS.xp,
                        value: e.value
                    });
                }
            }
        });

        // Boss Collision
        if (bossRef.current) {
          const b = bossRef.current;
          const d = Math.sqrt((b.pos.x - b.pos.x)**2 + (b.pos.y - b.pos.y)**2); // Typo check: b.pos and b.pos? No, b.pos and b.pos is wrong.
        }
    });
    
    // Fix Boss collision separately
    if (bossRef.current) {
      const b = bossRef.current;
      bulletsRef.current.forEach(bull => {
        const d = Math.sqrt((b.pos.x - bull.pos.x)**2 + (b.pos.y - bull.pos.y)**2);
        if (d < b.radius + bull.radius) {
          b.health -= bull.damage;
          bull.distanceTraveled = bull.maxDistance + 1;
          if (b.health <= 0) {
            createExplosion(b.pos, b.color, 50);
            // No immediate score, orbs will give score
            const orbCount = 20;
            const orbValue = b.value / orbCount; // 100 / 20 = 5
            for(let i=0; i<orbCount; i++) {
              xpOrbsRef.current.push({
                id: 'orb-' + Math.random(),
                pos: { x: b.pos.x + (Math.random()-0.5)*50, y: b.pos.y + (Math.random()-0.5)*50 },
                vel: { x: (Math.random()-0.5)*10, y: (Math.random()-0.5)*10 },
                radius: 8,
                color: COLORS.xp,
                value: orbValue
              });
            }
            bossRef.current = null;
            if (onBossEnd) onBossEnd();
          }
        }
      });
    }

    bulletsRef.current = bulletsRef.current.filter(b => b.distanceTraveled < b.maxDistance);
    enemiesRef.current = enemiesRef.current.filter(e => e.health > 0);

    // XP Orbs
    xpOrbsRef.current.forEach(orb => {
        const d = Math.sqrt((orb.pos.x - p.pos.x)**2 + (orb.pos.y - p.pos.y)**2);
        if (d < 150) { 
            const angle = Math.atan2(p.pos.y - orb.pos.y, p.pos.x - orb.pos.x);
            orb.vel.x += Math.cos(angle) * 0.5;
            orb.vel.y += Math.sin(angle) * 0.5;
        }
        orb.pos.x += orb.vel.x;
        orb.pos.y += orb.vel.y;
        orb.vel.x *= 0.95; 
        orb.vel.y *= 0.95;

        if (d < p.radius + orb.radius) {
            p.xp += orb.value;
            p.score += orb.value;
            orb.value = 0; 
            if (p.xp >= p.xpNext) {
                p.level++;
                p.xp -= p.xpNext;
                p.xpNext = Math.floor(p.xpNext * 1.2 + 50);
                onLevelUp({ ...p });
            }
        }
    });
    xpOrbsRef.current = xpOrbsRef.current.filter(o => o.value > 0);

    // Particles
    particlesRef.current.forEach(part => {
        part.pos.x += part.vel.x;
        part.pos.y += part.vel.y;
        part.life -= 0.02;
        part.opacity = part.life;
    });
    particlesRef.current = particlesRef.current.filter(p => p.life > 0);
    }

    // 5. Draw
    // Background with Arena Effect
    const baseColor = { r: 5, g: 10, b: 20 };
    const arenaColor = { r: 40, g: 5, b: 40 };
    const r = Math.floor(baseColor.r + (arenaColor.r - baseColor.r) * arenaTransitionRef.current);
    const g = Math.floor(baseColor.g + (arenaColor.g - baseColor.g) * arenaTransitionRef.current);
    const b = Math.floor(baseColor.b + (arenaColor.b - baseColor.b) * arenaTransitionRef.current);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(0, 0, width, height);

    // Grid
    ctx.strokeStyle = arenaTransitionRef.current > 0.5 ? '#ff00ff44' : COLORS.grid;
    ctx.lineWidth = 1;
    const gridSize = 50;
    const offsetX = -(p.pos.x % gridSize);
    const offsetY = -(p.pos.y % gridSize);

    ctx.beginPath();
    for (let x = offsetX; x < width; x += gridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
    }
    for (let y = offsetY; y < height; y += gridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
    }
    ctx.stroke();

    if (arenaTransitionRef.current > 0) {
      // Warp lines
      ctx.strokeStyle = `rgba(255, 0, 255, ${arenaTransitionRef.current * 0.1})`;
      ctx.beginPath();
      for(let i=0; i<width; i+=100) {
        const x = (i + frameCountRef.current * 10) % width;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      ctx.stroke();
    }

    ctx.shadowBlur = 15;

    // Bullets
    ctx.shadowColor = COLORS.bullet;
    ctx.fillStyle = COLORS.bullet;
    bulletsRef.current.forEach(b => {
        ctx.beginPath();
        ctx.arc(b.pos.x, b.pos.y, b.radius, 0, Math.PI * 2);
        ctx.fill();
    });

    // XP Orbs
    ctx.shadowColor = COLORS.xp;
    ctx.fillStyle = COLORS.xp;
    xpOrbsRef.current.forEach(o => {
        ctx.beginPath();
        ctx.arc(o.pos.x, o.pos.y, o.radius, 0, Math.PI * 2);
        ctx.fill();
    });

    // Enemies
    enemiesRef.current.forEach(e => {
        ctx.shadowColor = e.color;
        ctx.fillStyle = e.color;
        ctx.beginPath();
        if (e.radius > 15) { // Elite
            ctx.rect(e.pos.x - e.radius, e.pos.y - e.radius, e.radius*2, e.radius*2);
        } else {
            ctx.arc(e.pos.x, e.pos.y, e.radius, 0, Math.PI * 2);
        }
        ctx.fill();
    });

    // Boss
    if (bossRef.current) {
      const b = bossRef.current;
      ctx.shadowBlur = 25;
      ctx.shadowColor = b.color;
      ctx.fillStyle = b.color;
      
      const segments = 8;
      const angleStep = (Math.PI * 2) / segments;
      const t = frameCountRef.current * 0.05;
      
      ctx.beginPath();
      for (let i = 0; i < segments; i++) {
        const angle = i * angleStep + t;
        const rad = b.radius + Math.sin(t * 3 + i) * 10;
        const x = b.pos.x + Math.cos(angle) * rad;
        const y = b.pos.y + Math.sin(angle) * rad;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();

      // Boss Health
      const hpWidth = 300;
      const bx = b.pos.x - hpWidth / 2;
      const by = b.pos.y - b.radius - 40;
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(bx, by, hpWidth, 8);
      ctx.fillStyle = '#ff00ff';
      ctx.fillRect(bx, by, (b.health / b.maxHealth) * hpWidth, 8);
      ctx.strokeStyle = '#fff';
      ctx.strokeRect(bx, by, hpWidth, 8);
    }

    // Particles
    particlesRef.current.forEach(part => {
        ctx.shadowColor = part.color;
        ctx.globalAlpha = part.opacity;
        ctx.fillStyle = part.color;
        ctx.beginPath();
        ctx.arc(part.pos.x, part.pos.y, part.radius, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Player
    ctx.shadowColor = COLORS.player;
    ctx.fillStyle = COLORS.player;
    ctx.beginPath();
    ctx.moveTo(p.pos.x, p.pos.y - p.radius * 1.2);
    ctx.lineTo(p.pos.x - p.radius, p.pos.y + p.radius);
    ctx.lineTo(p.pos.x + p.radius, p.pos.y + p.radius);
    ctx.closePath();
    ctx.fill();

    requestRef.current = requestAnimationFrame(gameLoop);
  }, [gameState, onGameOver, onLevelUp, onScoreUpdate, onStatsUpdate, onDamage, spawnEnemy, spawnBoss]); // Removed joystickDir to stabilize loop

  useEffect(() => {
    requestRef.current = requestAnimationFrame(gameLoop);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [gameLoop]);

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="block w-full h-full cursor-crosshair"
    />
  );
};
