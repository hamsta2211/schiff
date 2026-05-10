import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Player, Enemy, Bullet, XPOrb, Particle, Vector, GameState } from '../types';

interface NeonCanvasProps {
  gameState: GameState;
  onLevelUp: (player: Player) => void;
  onGameOver: (score: number) => void;
  onDamage?: () => void;
  playerStats: Partial<Player>;
  joystickDir?: Vector;
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
  onDamage,
  playerStats,
  joystickDir
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
    health: 100,
    maxHealth: 100,
    speed: 4,
    level: 1,
    xp: 0,
    xpNext: 100,
    fireRate: 3,
    damage: 10,
    projCount: 1,
  });

  // Sync player stats from props (Level Up rewards) and Reset on Menu
  useEffect(() => {
    if (gameState === 'MENU' || gameState === 'GAME_OVER') {
      // Reset logic
      enemiesRef.current = [];
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
        health: 100,
        maxHealth: 100,
        speed: 4,
        level: 1,
        xp: 0,
        xpNext: 100,
        fireRate: 3,
        damage: 10,
        projCount: 1,
      };
    } else if (playerStats && Object.keys(playerStats).length > 0) {
      playerRef.current = { ...playerRef.current, ...playerStats as Player };
    }
  }, [playerStats, gameState]);

  const enemiesRef = useRef<Enemy[]>([]);
  const bulletsRef = useRef<Bullet[]>([]);
  const xpOrbsRef = useRef<XPOrb[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const keysRef = useRef<Set<string>>(new Set());
  const lastFireRef = useRef<number>(0);
  const spawnTimerRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);

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
    if (gameState !== 'PLAYING') {
      requestRef.current = requestAnimationFrame(gameLoop);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    frameCountRef.current++;

    // 1. Update Player
    const p = playerRef.current;
    let dx = 0, dy = 0;
    
    // Keyboard Input
    if (keysRef.current.has('KeyW') || keysRef.current.has('ArrowUp')) dy -= 1;
    if (keysRef.current.has('KeyS') || keysRef.current.has('ArrowDown')) dy += 1;
    if (keysRef.current.has('KeyA') || keysRef.current.has('ArrowLeft')) dx -= 1;
    if (keysRef.current.has('KeyD') || keysRef.current.has('ArrowRight')) dx += 1;

    // Joystick Input
    if (joystickDir && (joystickDir.x !== 0 || joystickDir.y !== 0)) {
      dx = joystickDir.x;
      dy = joystickDir.y;
    }

    if (dx !== 0 || dy !== 0) {
      if (!joystickDir || (joystickDir.x === 0 && joystickDir.y === 0)) {
        const mag = Math.sqrt(dx * dx + dy * dy);
        dx /= mag;
        dy /= mag;
      }
      p.pos.x += dx * p.speed;
      p.pos.y += dy * p.speed;
    }

    // Wrap/Clamp player
    p.pos.x = Math.max(p.radius, Math.min(width - p.radius, p.pos.x));
    p.pos.y = Math.max(p.radius, Math.min(height - p.radius, p.pos.y));

    // 2. Firing Logic (Auto-aim at nearest enemy)
    const now = Date.now();
    if (now - lastFireRef.current > 1000 / p.fireRate && enemiesRef.current.length > 0) {
      lastFireRef.current = now;
      
      // Find nearest enemy
      let nearest: Enemy | null = null;
      let minDist = Infinity;
      for (const e of enemiesRef.current) {
        const d = Math.sqrt((e.pos.x - p.pos.x)**2 + (e.pos.y - p.pos.y)**2);
        if (d < minDist) {
          minDist = d;
          nearest = e;
        }
      }

      if (nearest) {
        const angle = Math.atan2(nearest.pos.y - p.pos.y, nearest.pos.x - p.pos.x);
        
        // Shoot multi-projectiles
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
    spawnTimerRef.current--;
    if (spawnTimerRef.current <= 0) {
      spawnEnemy(width, height);
      spawnTimerRef.current = Math.max(10, 60 - p.level * 2);
    }

    // 4. Update Entities
    // Enemies
    enemiesRef.current.forEach(e => {
        const angle = Math.atan2(p.pos.y - e.pos.y, p.pos.x - e.pos.x);
        e.vel.x = Math.cos(angle) * e.speed;
        e.vel.y = Math.sin(angle) * e.speed;
        e.pos.x += e.vel.x;
        e.pos.y += e.vel.y;

        // Player Collision
        const d = Math.sqrt((e.pos.x - p.pos.x)**2 + (e.pos.y - p.pos.y)**2);
        if (d < e.radius + p.radius) {
            const damage = e.damage / 60;
            p.health -= damage;
            if (onDamage && frameCountRef.current % 10 === 0) onDamage();
            
            if (p.health <= 0 && gameState === 'PLAYING') {
                onGameOver(Math.floor(p.level * 100 + p.xp));
            }
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
                b.distanceTraveled = b.maxDistance + 1; // Mark for removal
                
                if (e.health <= 0) {
                    // Kill effects
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
    });

    // Cleanup Bullets & Dead Enemies
    bulletsRef.current = bulletsRef.current.filter(b => b.distanceTraveled < b.maxDistance);
    enemiesRef.current = enemiesRef.current.filter(e => e.health > 0);

    // XP Orbs
    xpOrbsRef.current.forEach(orb => {
        const d = Math.sqrt((orb.pos.x - p.pos.x)**2 + (orb.pos.y - p.pos.y)**2);
        if (d < 150) { // Magnet effect
            const angle = Math.atan2(p.pos.y - orb.pos.y, p.pos.x - orb.pos.x);
            orb.vel.x += Math.cos(angle) * 0.5;
            orb.vel.y += Math.sin(angle) * 0.5;
        }
        orb.pos.x += orb.vel.x;
        orb.pos.y += orb.vel.y;
        orb.vel.x *= 0.95; // Friction
        orb.vel.y *= 0.95;

        if (d < p.radius + orb.radius) {
            p.xp += orb.value;
            orb.value = 0; // Mark for removal
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

    // 5. Draw
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, width, height);

    // Draw Grid
    ctx.strokeStyle = COLORS.grid;
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

    // Draw Entities with Glow
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
        // Triangle/Square based on type
        if (e.radius > 15) { // Elite
            ctx.rect(e.pos.x - e.radius, e.pos.y - e.radius, e.radius*2, e.radius*2);
        } else {
            ctx.arc(e.pos.x, e.pos.y, e.radius, 0, Math.PI * 2);
        }
        ctx.fill();
    });

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

    // HUD (Internal to Canvas for performance)
    ctx.shadowBlur = 0;
    
    // Health Bar
    const healthBarW = 200;
    const hpPerc = Math.max(0, p.health / p.maxHealth);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(20, 20, healthBarW, 10);
    ctx.fillStyle = COLORS.player;
    ctx.fillRect(20, 20, healthBarW * hpPerc, 10);

    // XP Bar
    const xpPerc = p.xp / p.xpNext;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(20, 40, width - 40, 6);
    ctx.fillStyle = COLORS.xp;
    ctx.fillRect(20, 40, (width - 40) * xpPerc, 6);

    ctx.fillStyle = 'white';
    ctx.font = '14px monospace';
    ctx.fillText(`LVL ${p.level}`, 20, 65);

    requestRef.current = requestAnimationFrame(gameLoop);
  }, [gameState, onGameOver, onLevelUp, onDamage, spawnEnemy, joystickDir]);

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
