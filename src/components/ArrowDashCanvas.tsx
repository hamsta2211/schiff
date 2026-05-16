import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameState, Vector } from '../types';

interface ArrowDashCanvasProps {
  gameState: GameState;
  onGameOver: (score: number) => void;
  onScoreUpdate: (score: number) => void;
  onDamage: () => void;
  onBossStart: () => void;
  onBossEnd: () => void;
  joystickDir?: Vector;
}

const COLORS = {
  background: '#050a14',
  player: '#00ccff',
  obstacle: '#ff0055',
  boss: '#ff00ff',
  laser: '#ff0000',
  laserWarning: 'rgba(255, 0, 0, 0.3)',
};

export const ArrowDashCanvas: React.FC<ArrowDashCanvasProps> = ({
  gameState,
  onGameOver,
  onScoreUpdate,
  onDamage,
  onBossStart,
  onBossEnd,
  joystickDir
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(null);

  // Constants
  const GRAVITY = 0.4;
  const JUMP_STRENGTH = -8;
  const OBSTACLE_SPEED = 4;
  const OBSTACLE_WIDTH = 60;
  const GAP_SIZE = 200; // fair gap

  // State
  const playerRef = useRef({
    pos: { x: 100, y: window.innerHeight / 2 },
    vel: { x: 0, y: 0 },
    radius: 15,
    health: 5,
    invulnerable: 0,
  });

  const obstaclesRef = useRef<{ x: number; gapTop: number; passed: boolean }[]>([]);
  const scoreRef = useRef(0);
  const frameCountRef = useRef(0);

  // Boss state
  const bossRef = useRef({
    pos: { x: window.innerWidth - 100, y: window.innerHeight / 2 },
    vel: { x: 0, y: 3 },
    radius: 40,
    health: 500,
    maxHealth: 500,
    lasering: 0, // 0 = no, 1 = charging, 2 = firing
    laserTimer: 0,
    laserY: 0,
    level: 1,
  });

  const bulletsRef = useRef<{ pos: Vector; vel: Vector; radius: number; enemy: boolean }[]>([]);
  const particlesRef = useRef<{ pos: Vector; vel: Vector; life: number; color: string }[]>([]);

  // Controls (Flappy style or Joystick vertical?)
  // The Prompt: "Hindernisse: Generiere vertikale Säulen mit Lücken... Teleportation: Nach jeweils 50 Punkten wechselt der Status zu 'Teleporting'"
  // If player uses WASD/joystick, maybe they can move freely in 2D? Let's use standard flap via touch/click/space if playing arrow dash, OR joystick for smooth movement.
  // Actually, Arrow Dash might imply you move with joystick. Let's make it joystick based for consistency with Joystick UI, just constrained by screen bounds. Arrow Dash can use joystick Y and X but auto-scrolls.
  // Wait, "Manövrierbarkeit des Schiffes schaffbar" -> probably free movement.
  
  const createExplosion = (pos: Vector, color: string, count = 10) => {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 5 + 2;
        particlesRef.current.push({
            pos: { ...pos },
            vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
            life: 1.0,
            color
        });
    }
  };

  const initGame = useCallback(() => {
    playerRef.current = {
      pos: { x: 100, y: window.innerHeight / 2 },
      vel: { x: 0, y: 0 },
      radius: 15,
      health: 5,
      invulnerable: 0,
    };
    bossRef.current.level = 1;
    bossRef.current.maxHealth = 500;
    bossRef.current.health = 500;
    bossRef.current.vel = { x: 0, y: 3 };
    obstaclesRef.current = [];
    scoreRef.current = 0;
    bulletsRef.current = [];
    particlesRef.current = [];
  }, []);

  // Use jDir
  const jDirRef = useRef<Vector>({ x: 0, y: 0 });
  useEffect(() => {
    if (joystickDir) jDirRef.current = joystickDir;
  }, [joystickDir]);

  // Keyboard
  useEffect(() => {
    const keys: Record<string, boolean> = {};
    const handleKeyDown = (e: KeyboardEvent) => { keys[e.key] = true; };
    const handleKeyUp = (e: KeyboardEvent) => { keys[e.key] = false; };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    const interval = setInterval(() => {
      let dx = 0, dy = 0;
      if (keys['w'] || keys['W'] || keys['ArrowUp']) dy -= 1;
      if (keys['s'] || keys['S'] || keys['ArrowDown']) dy += 1;
      if (keys['a'] || keys['A'] || keys['ArrowLeft']) dx -= 1;
      if (keys['d'] || keys['D'] || keys['ArrowRight']) dx += 1;
      
      if (dx !== 0 || dy !== 0) {
        // Keyboard overrides joystick
        jDirRef.current = { x: dx, y: dy };
      } else {
        if (!joystickDir || (joystickDir.x === 0 && joystickDir.y === 0)) {
           jDirRef.current = { x: 0, y: 0 };
        }
      }
    }, 16);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      clearInterval(interval);
    }
  }, [joystickDir]);

  const gameLoop = useCallback((time: number) => {
    if (!['ARROW_DASH', 'ARROW_DASH_TELEPORT', 'ARROW_DASH_BOSS', 'ARROW_DASH_COUNTDOWN'].includes(gameState)) {
      requestRef.current = requestAnimationFrame(gameLoop);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Resize
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const { width, height } = canvas;

    frameCountRef.current++;
    const p = playerRef.current;

    if (gameState === 'ARROW_DASH' || gameState === 'ARROW_DASH_BOSS') {
      // Move Player
      p.pos.x += jDirRef.current.x * 9;
      p.pos.y += jDirRef.current.y * 9;

      // Clamp
      p.pos.x = Math.max(p.radius, Math.min(width - p.radius, p.pos.x));
      p.pos.y = Math.max(p.radius, Math.min(height - p.radius, p.pos.y));

      if (p.invulnerable > 0) p.invulnerable--;

      // Player shooting
      if (frameCountRef.current % 15 === 0) {
        let velX = 15;
        let velY = 0;
        
        if (gameState === 'ARROW_DASH_BOSS') {
          const b = bossRef.current;
          const dx = b.pos.x - p.pos.x;
          const dy = b.pos.y - p.pos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 0) {
            velX = (dx / dist) * 15;
            velY = (dy / dist) * 15;
          }
        }

        bulletsRef.current.push({
          pos: { x: p.pos.x + p.radius, y: p.pos.y },
          vel: { x: velX, y: velY },
          radius: 4,
          enemy: false
        });
      }
    }

    if (gameState === 'ARROW_DASH') {
      // Spawn Obstacles
      if (frameCountRef.current % 100 === 0) {
        let lastGap = height / 2;
        if (obstaclesRef.current.length > 0) {
          lastGap = obstaclesRef.current[obstaclesRef.current.length - 1].gapTop + GAP_SIZE / 2;
        }
        
        // Ensure gap is reachable
        const range = 200;
        let nextGapY = lastGap + (Math.random() * range * 2 - range);
        nextGapY = Math.max(GAP_SIZE, Math.min(height - GAP_SIZE, nextGapY));

        obstaclesRef.current.push({
          x: width + 50,
          gapTop: nextGapY - GAP_SIZE / 2,
          passed: false
        });
      }

      // Update Obstacles
      obstaclesRef.current.forEach(obs => {
        obs.x -= OBSTACLE_SPEED;

        if (!obs.passed && p.pos.x > obs.x + OBSTACLE_WIDTH) {
          obs.passed = true;
          scoreRef.current += 1;
          onScoreUpdate(scoreRef.current);

          if (scoreRef.current % 20 === 0) {
            onBossStart();
          }
        }

        // Collision Check
        if (p.invulnerable <= 0) {
          const inX = p.pos.x + p.radius > obs.x && p.pos.x - p.radius < obs.x + OBSTACLE_WIDTH;
          const inY = p.pos.y - p.radius < obs.gapTop || p.pos.y + p.radius > obs.gapTop + GAP_SIZE;
          if (inX && inY) {
            onDamage();
            onGameOver(scoreRef.current);
          }
        }
      });

      obstaclesRef.current = obstaclesRef.current.filter(o => o.x > -OBSTACLE_WIDTH);
    }

    if (gameState === 'ARROW_DASH_BOSS') {
      // Ensure boss is within screen and obstacles are cleared
      obstaclesRef.current = [];
      const b = bossRef.current;
      if (b.pos.x > width) {
        b.pos.x = width - 100; // Force boss into view
      }

      // Boss Float
      b.pos.y += b.vel.y;
      if (b.pos.y < b.radius || b.pos.y > height - b.radius) b.vel.y *= -1;

      // Boss pattern
      if (b.lasering === 0) {
        // Random shots
        const shotRate = Math.max(15, 40 - b.level * 4);
        if (frameCountRef.current % shotRate === 0) {
          bulletsRef.current.push({
            pos: { x: b.pos.x - b.radius, y: b.pos.y },
            vel: { x: -8 - b.level, y: (Math.random() - 0.5) * (4 + b.level) },
            radius: 6,
            enemy: true
          });
        }
        
        const laserChance = 0.005 + b.level * 0.001;
        if (Math.random() < laserChance) {
          b.lasering = 1; // charging
          b.laserTimer = 0;
          b.laserY = b.pos.y;
        }
      } else if (b.lasering === 1) {
        b.laserTimer++;
        b.laserY = b.pos.y;
        if (b.laserTimer > 90) {
          b.lasering = 2;
          b.laserTimer = 0;
        }
      } else if (b.lasering === 2) {
        b.laserTimer++;
        b.laserY = b.pos.y;
        // laser hits player?
        if (p.pos.y + p.radius > b.laserY - 20 && p.pos.y - p.radius < b.laserY + 20) {
          if (p.invulnerable <= 0) {
            p.health--;
            p.invulnerable = 90;
            onDamage();
            if (p.health <= 0) onGameOver(scoreRef.current);
          }
        }
        if (b.laserTimer > 60) {
          b.lasering = 0;
          b.laserTimer = 0;
        }
      }

      // Boss Collision
      const db = Math.sqrt((b.pos.x - p.pos.x)**2 + (b.pos.y - p.pos.y)**2);
      if (db < b.radius + p.radius && p.invulnerable <= 0) {
         p.health--;
         p.invulnerable = 90;
         onDamage();
         if (p.health <= 0) onGameOver(scoreRef.current);
      }
    }

    // Bullets update
    bulletsRef.current.forEach(bullet => {
      bullet.pos.x += bullet.vel.x;
      bullet.pos.y += bullet.vel.y;

      if (gameState === 'ARROW_DASH') {
        const obs = obstaclesRef.current.find(o => bullet.pos.x > o.x && bullet.pos.x < o.x + OBSTACLE_WIDTH);
        if (obs) {
           const hitsWall = bullet.pos.y < obs.gapTop || bullet.pos.y > obs.gapTop + GAP_SIZE;
           if (hitsWall) bullet.pos.x = -100; // destroy
        }
      }

      if (gameState === 'ARROW_DASH_BOSS') {
        const b = bossRef.current;
        if (!bullet.enemy) {
          const db = Math.sqrt((b.pos.x - bullet.pos.x)**2 + (b.pos.y - bullet.pos.y)**2);
          if (db < b.radius + bullet.radius) {
            b.health--;
            bullet.pos.x = -100; // destroy
            createExplosion(bullet.pos, '#ff0ff', 5);
            if (b.health <= 0) {
              onBossEnd();
              scoreRef.current += 100;
              b.level += 1;
              b.maxHealth += 25;
              b.health = b.maxHealth; // reset for next boss
              b.vel.y = (b.vel.y > 0 ? 1 : -1) * (3 + b.level * 0.5);
              obstaclesRef.current = [];
            }
          }
        } else {
           const dp = Math.sqrt((p.pos.x - bullet.pos.x)**2 + (p.pos.y - bullet.pos.y)**2);
           if (dp < p.radius + bullet.radius && p.invulnerable <= 0) {
              p.health--;
              p.invulnerable = 90;
              bullet.pos.x = -100;
              onDamage();
              if (p.health <= 0) onGameOver(scoreRef.current);
           }
        }
      }
    });

    bulletsRef.current = bulletsRef.current.filter(b => b.pos.x > -50 && b.pos.x < width + 50 && b.pos.y > -50 && b.pos.y < height + 50);

    // Filter particles
    particlesRef.current.forEach(pt => {
      pt.pos.x += pt.vel.x;
      pt.pos.y += pt.vel.y;
      pt.life -= 0.05;
    });
    particlesRef.current = particlesRef.current.filter(pt => pt.life > 0);

    // DRAWING
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, width, height);

    if (gameState === 'ARROW_DASH' || gameState === 'ARROW_DASH_BOSS') {
      // Warp stripes background
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.beginPath();
      for (let i = 0; i < height; i += 50) {
         ctx.moveTo((frameCountRef.current * 10 + i * 3) % width, i);
         ctx.lineTo((frameCountRef.current * 10 + i * 3 + 100) % width, i);
      }
      ctx.stroke();

      // Bullets
      ctx.shadowBlur = 10;
      bulletsRef.current.forEach(b => {
        ctx.fillStyle = b.enemy ? '#ff0055' : '#00ccff';
        ctx.shadowColor = ctx.fillStyle;
        ctx.beginPath();
        ctx.arc(b.pos.x, b.pos.y, b.radius, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.shadowBlur = 0;

      // Obstacles
      ctx.fillStyle = COLORS.obstacle;
      ctx.shadowColor = COLORS.obstacle;
      ctx.shadowBlur = 10;
      obstaclesRef.current.forEach(obs => {
        ctx.fillRect(obs.x, 0, OBSTACLE_WIDTH, obs.gapTop);
        ctx.fillRect(obs.x, obs.gapTop + GAP_SIZE, OBSTACLE_WIDTH, height - (obs.gapTop + GAP_SIZE));
      });
      ctx.shadowBlur = 0;

      // Boss
      if (gameState === 'ARROW_DASH_BOSS') {
        const b = bossRef.current;
        
        ctx.fillStyle = COLORS.boss;
        ctx.shadowColor = COLORS.boss;
        ctx.shadowBlur = 20;

        ctx.beginPath();
        ctx.arc(b.pos.x, b.pos.y, b.radius, 0, Math.PI * 2);
        ctx.fill();

        if (b.lasering === 1) {
          ctx.fillStyle = COLORS.laserWarning;
          ctx.fillRect(0, b.laserY - 2, width, 4);
        } else if (b.lasering === 2) {
          ctx.fillStyle = COLORS.laser;
          ctx.shadowBlur = 30;
          ctx.shadowColor = COLORS.laser;
          ctx.fillRect(0, b.laserY - 20, width, 40);
          ctx.shadowBlur = 0;
        }

        // Health bar
        ctx.fillStyle = '#fff';
        ctx.fillRect(b.pos.x - 40, b.pos.y - b.radius - 20, 80, 5);
        ctx.fillStyle = '#ff00ff';
        ctx.fillRect(b.pos.x - 40, b.pos.y - b.radius - 20, 80 * (b.health / b.maxHealth), 5);
      }

      // Player
      if (p.invulnerable === 0 || Math.floor(frameCountRef.current / 5) % 2 === 0) {
        ctx.fillStyle = COLORS.player;
        ctx.shadowColor = COLORS.player;
        ctx.shadowBlur = 15;
        
        ctx.beginPath();
        ctx.moveTo(p.pos.x + p.radius, p.pos.y);
        ctx.lineTo(p.pos.x - p.radius, p.pos.y - p.radius);
        ctx.lineTo(p.pos.x - p.radius / 2, p.pos.y);
        ctx.lineTo(p.pos.x - p.radius, p.pos.y + p.radius);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Draw Particles
      particlesRef.current.forEach(pt => {
        ctx.fillStyle = pt.color;
        ctx.globalAlpha = pt.life;
        ctx.beginPath();
        ctx.arc(pt.pos.x, pt.pos.y, 3, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1.0;
      
    } else if (gameState === 'ARROW_DASH_TELEPORT') {
      obstaclesRef.current = [];
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = '#00ccff';
      ctx.lineWidth = 5;
      ctx.beginPath();
      for(let i=0; i<50; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.random() * 200, y);
      }
      ctx.stroke();
    } else if (gameState === 'ARROW_DASH_COUNTDOWN') {
      // Draw background
      // Warp stripes background
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.beginPath();
      for (let i = 0; i < height; i += 50) {
         ctx.moveTo((frameCountRef.current * 10 + i * 3) % width, i);
         ctx.lineTo((frameCountRef.current * 10 + i * 3 + 100) % width, i);
      }
      ctx.stroke();

      // Draw Player
      ctx.fillStyle = COLORS.player;
      ctx.shadowColor = COLORS.player;
      ctx.shadowBlur = 15;
      
      ctx.beginPath();
      ctx.moveTo(p.pos.x + p.radius, p.pos.y);
      ctx.lineTo(p.pos.x - p.radius, p.pos.y - p.radius);
      ctx.lineTo(p.pos.x - p.radius / 2, p.pos.y);
      ctx.lineTo(p.pos.x - p.radius, p.pos.y + p.radius);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Draw countdown text
      const elapsed = Date.now() - countdownStartRef.current;
      const remaining = Math.max(0, 2000 - elapsed);
      const seconds = Math.ceil(remaining / 1000);
      
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 120px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Add pulsing effect
      const alpha = 0.5 + 0.5 * Math.abs(Math.sin((elapsed / 1000) * Math.PI));
      ctx.globalAlpha = alpha;
      ctx.fillText(seconds.toString(), width / 2, height / 2);
      ctx.globalAlpha = 1.0;
    }

    requestRef.current = requestAnimationFrame(gameLoop);
  }, [gameState, onGameOver, onScoreUpdate, onDamage, onBossStart, onBossEnd, joystickDir]);

  const [lastState, setLastState] = useState<GameState>(gameState);

  const prevGameState = useRef<GameState | undefined>(undefined);
  const countdownStartRef = useRef<number>(0);

  useEffect(() => {
    if (gameState === 'ARROW_DASH') {
      if (
        prevGameState.current !== 'ARROW_DASH_PAUSED' &&
        prevGameState.current !== 'ARROW_DASH_BOSS' &&
        prevGameState.current !== 'ARROW_DASH' &&
        prevGameState.current !== 'ARROW_DASH_TELEPORT' &&
        prevGameState.current !== 'ARROW_DASH_COUNTDOWN'
      ) {
        initGame();
      }
    }
    
    if (gameState === 'ARROW_DASH_TELEPORT' && prevGameState.current !== 'ARROW_DASH_TELEPORT') {
      obstaclesRef.current = [];
    }

    if (gameState === 'ARROW_DASH_BOSS' && prevGameState.current !== 'ARROW_DASH_BOSS') {
      bossRef.current.pos = { x: window.innerWidth - 100, y: window.innerHeight / 2 };
      bossRef.current.health = bossRef.current.maxHealth;
    }

    if (gameState === 'ARROW_DASH_COUNTDOWN' && prevGameState.current !== 'ARROW_DASH_COUNTDOWN') {
      countdownStartRef.current = Date.now();
      playerRef.current.pos.y = window.innerHeight / 2; // Center player vertically
      playerRef.current.vel = { x: 0, y: 0 };
    }

    prevGameState.current = gameState;
  }, [gameState, initGame]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(gameLoop);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [gameLoop]);

  // Hearts UI inside Canvas wrapper?
  // UI usually belongs in App.tsx but we can render it here over canvas
  return (
    <div className="absolute inset-0 z-0">
      <canvas ref={canvasRef} className="block w-full h-full" />
      
      {/* HUD for Arrow Dash */}
      {['ARROW_DASH', 'ARROW_DASH_BOSS', 'ARROW_DASH_COUNTDOWN'].includes(gameState) && (
        <div className="absolute top-4 left-4 z-10 flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
             <div 
               key={i} 
               className={`w-6 h-6 rotate-45 transform transition-colors duration-300 ${i < playerRef.current.health ? 'bg-[#ff0055]' : 'bg-white/10'}`} 
             />
          ))}
          <div className="ml-8 text-2xl font-black text-white">{scoreRef.current}</div>
        </div>
      )}
    </div>
  );
};
