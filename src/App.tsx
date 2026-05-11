import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { NeonCanvas } from './components/NeonCanvas';
import { Joystick } from './components/Joystick';
import { SupabaseAuth } from './components/SupabaseAuth';
import { Leaderboard } from './components/Leaderboard';
import { supabase } from './lib/supabase';
import { GameState, Player, Upgrade, Vector } from './types';
import { getRandomUpgrades } from './upgrades';
import confetti from 'canvas-confetti';
import { Shield, Zap, Sword, Heart, Wind, Gamepad2, Info, Maximize2, Minimize2, Trophy, User, LogOut } from 'lucide-react';

export default function App() {
  const [gameState, setGameState] = useState<GameState>('MENU');
  const [playerStats, setPlayerStats] = useState<Partial<Player>>({});
  const [upgrades, setUpgrades] = useState<Upgrade[]>([]);
  const [score, setScore] = useState(0);
  const [isShaking, setIsShaking] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [joystickDir, setJoystickDir] = useState<Vector>({ x: 0, y: 0 });
  const [joystickPos, setJoystickPos] = useState<Vector | null>(null);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [username, setUsername] = useState<string>('');
  
  // Track the full state passed from the game to apply upgrades correctly
  const [currentPlayerState, setCurrentPlayerState] = useState<Player | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
    
    // Auth Check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        setUsername(session.user.user_metadata.username || session.user.email?.split('@')[0] || 'Player');
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        setUsername(session.user.user_metadata.username || session.user.email?.split('@')[0] || 'Player');
      }
    });

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (gameState !== 'PLAYING') return;
    // Don't trigger if touching a button
    if ((e.target as HTMLElement).closest('button')) return;

    const touch = e.touches[0];
    setJoystickPos({ x: touch.clientX, y: touch.clientY });
  };

  const handleTouchEnd = () => {
    setJoystickPos(null);
    setJoystickDir({ x: 0, y: 0 });
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch((e) => {
        console.error(`Error attempting to enable full-screen mode: ${e.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const triggerShake = useCallback(() => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 200);
  }, []);

  const startGame = () => {
    setGameState('PLAYING');
    setPlayerStats({});
    setCurrentPlayerState(null);
    setScore(0);
  };

  const handleLevelUp = useCallback((player: Player) => {
    setCurrentPlayerState(player);
    setGameState('LEVEL_UP');
    setUpgrades(getRandomUpgrades(3));
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#00ccff', '#00ff00', '#ff0055']
    });
  }, []);

  const handleGameOver = useCallback(async (finalScore: number) => {
    setGameState('GAME_OVER');
    setScore(finalScore);

    // Save Score to Supabase
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      try {
        await supabase.from('high_scores').insert({
          user_id: session.user.id,
          username: session.user.user_metadata.username || session.user.email?.split('@')[0],
          score: finalScore,
        });
      } catch (err) {
        console.error('Failed to save score:', err);
      }
    }
  }, []);

  const applyUpgrade = (upgrade: Upgrade) => {
    setPlayerStats((prev) => {
      // Note: In real logic we'd need the current player state.
      // But for simplicity, we let the Canvas handle the apply since it has the ref.
      // Wait, let's pass a function to update the internal ref.
      return { ...prev, _triggerUpgrade: upgrade.id } as any; 
    });
    // Actually, it's better to calculate it here or the canvas updates it.
    // Let's assume playerStats is merged into playerRef.current in NeonCanvas.
    // I'll modify NeonCanvas to handle this better.
    setGameState('PLAYING');
  };

  const menuVariants = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 1.1 }
  };

  return (
    <div 
      ref={containerRef}
      className={`relative w-screen h-screen bg-[#050a14] overflow-hidden font-sans text-white ${isShaking ? 'shake' : ''}`}
      onTouchStart={handleTouchStart}
    >
      {/* Game Canvas */}
      <NeonCanvas 
        gameState={gameState} 
        onLevelUp={handleLevelUp} 
        onGameOver={handleGameOver}
        onDamage={triggerShake}
        playerStats={playerStats}
        joystickDir={joystickDir}
      />

      {/* Joystick for Mobile */}
      {gameState === 'PLAYING' && joystickPos && (
        <Joystick 
          position={joystickPos} 
          onMove={setJoystickDir} 
          onEnd={handleTouchEnd}
        />
      )}

      {/* Global Controls */}
      <div className="absolute top-6 right-6 z-[60] flex items-center gap-4">
        {session && (
          <div className="flex items-center gap-3 px-4 py-2 bg-white/5 border border-white/10 rounded-xl backdrop-blur-md">
            <span className="text-sm font-bold text-[#00ccff]">{username}</span>
            <button 
              onClick={() => supabase.auth.signOut()}
              className="p-1 hover:text-[#ff0055] transition-colors"
              title="Abmelden"
            >
              <LogOut size={16} />
            </button>
          </div>
        )}
        <button
          onClick={toggleFullscreen}
          className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all active:scale-95 group backdrop-blur-md"
          title="Toggle Fullscreen"
        >
          {isFullscreen ? (
            <Minimize2 size={20} className="text-white group-hover:text-[#00ccff] transition-colors" />
          ) : (
            <Maximize2 size={20} className="text-white group-hover:text-[#00ccff] transition-colors" />
          )}
        </button>
      </div>

      {/* Overlay UI */}
      <AnimatePresence>
        {gameState === 'MENU' && (
          <motion.div 
            key="menu"
            variants={menuVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-50 px-4 md:px-6 text-center overflow-y-auto pt-20"
          >
            <motion.div
              initial={{ y: -50 }}
              animate={{ y: 0 }}
              className="mb-8 md:mb-12 shrink-0"
            >
              <h1 className="text-6xl md:text-9xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-[#00ccff] to-[#ff0055] drop-shadow-[0_0_15px_rgba(0,204,255,0.5)]">
                SHIFF
              </h1>
            </motion.div>

            <div className="flex flex-col gap-4 w-full max-w-sm">
              <button 
                onClick={startGame}
                className="group relative px-8 py-4 bg-[#00ccff] text-[#050a14] font-bold text-2xl rounded-lg overflow-hidden transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(0,204,255,0.4)]"
              >
                <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500" />
                JETZT SPIELEN
              </button>
              
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => setGameState('LEADERBOARD')}
                  className="flex items-center justify-center gap-2 p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors font-bold text-sm"
                >
                  <Trophy size={16} className="text-[#ff9900]" />
                  Bestenliste
                </button>
                <button 
                  onClick={() => setGameState('AUTH')}
                  className="flex items-center justify-center gap-2 p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors font-bold text-sm"
                >
                  <User size={16} className="text-[#00ccff]" />
                  {session ? 'Konto' : 'Anmelden'}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-[10px] font-bold uppercase tracking-widest text-gray-500 mt-2">
                <div className="flex items-center gap-2 p-3 bg-white/5 rounded-lg border border-white/10">
                  <Gamepad2 size={16} className="text-[#00ccff]" />
                  <span>WASD zum Bewegen</span>
                </div>
                <div className="flex items-center gap-2 p-3 bg-white/5 rounded-lg border border-white/10">
                  <Sword size={16} className="text-[#ff0055]" />
                  <span>Auto-Zielen</span>
                </div>
              </div>
            </div>
            
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              transition={{ delay: 1 }}
              className="absolute bottom-10 text-xs tracking-widest uppercase flex items-center gap-2"
            >
              <Info size={12} /> Überleben ist Pflicht
            </motion.p>
          </motion.div>
        )}

        {gameState === 'LEVEL_UP' && (
          <motion.div 
            key="upgrade"
            variants={menuVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md z-50 px-4 py-8 overflow-y-auto"
          >
            <h2 className="text-2xl md:text-4xl font-black mb-6 md:mb-12 tracking-tight flex items-center gap-3 md:gap-4 shrink-0">
              <Zap className="text-[#00ff00] animate-pulse w-6 h-6 md:w-8 md:h-8" />
              UPGRADE WÄHLEN
            </h2>

            <div className="flex flex-col md:grid md:grid-cols-3 gap-4 md:gap-6 w-full max-w-5xl pb-8">
              {upgrades.map((u, i) => (
                <motion.button
                  key={u.id}
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  onClick={() => {
                    if (currentPlayerState) {
                      const newStats = u.onApply({ ...currentPlayerState });
                      setPlayerStats(newStats);
                    }
                    setGameState('PLAYING');
                  }}
                  className="flex flex-row md:flex-col items-center md:items-start p-4 md:p-6 bg-white/5 border border-white/10 rounded-xl md:rounded-2xl hover:bg-white/10 hover:border-[#00ccff]/50 transition-colors text-left group gap-4 md:gap-0"
                >
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-white/5 rounded-lg md:rounded-xl flex items-center justify-center md:mb-4 group-hover:scale-110 transition-transform shrink-0">
                    {u.id === 'firerate' && <Zap size={20} className="text-[#ff9900]" />}
                    {u.id === 'damage' && <Sword size={20} className="text-[#ff0055]" />}
                    {u.id === 'speed' && <Wind size={20} className="text-[#00ccff]" />}
                    {u.id === 'health' && <Heart size={20} className="text-[#00ff00]" />}
                    {u.id === 'projectiles' && <Shield size={20} className="text-[#00ccff]" />}
                    {u.id === 'lifesteal' && <Zap size={20} className="text-[#ff0055]" />}
                  </div>
                  <div>
                    <h3 className="text-lg md:text-xl font-bold md:mb-2 group-hover:text-[#00ccff] transition-colors">{u.name}</h3>
                    <p className="text-xs md:text-sm text-gray-400 leading-tight md:leading-relaxed">{u.description}</p>
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {gameState === 'GAME_OVER' && (
          <motion.div 
            key="gameover"
            variants={menuVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm z-50 px-6 py-10 text-center overflow-y-auto"
          >
            <h2 className="text-5xl md:text-8xl font-black mb-4 tracking-tighter text-[#ff0055] drop-shadow-[0_0_15px_rgba(255,0,85,0.5)]">
              GAME OVER
            </h2>
            <p className="text-2xl text-gray-400 mb-6">Punktestand: <span className="text-white font-mono">{score}</span></p>
            
            {!session && (
              <p className="mb-8 p-3 bg-[#ff9900]/10 border border-[#ff9900]/20 rounded-xl text-[#ff9900] text-sm font-bold flex items-center gap-2 max-w-xs mx-auto">
                <Info size={16} /> Melde dich an, um deinen Highscore zu speichern!
              </p>
            )}

            <div className="flex flex-col gap-3 w-full max-w-xs mx-auto">
              <button 
                onClick={startGame}
                className="px-10 py-5 bg-white text-black font-bold text-xl rounded-lg hover:scale-105 active:scale-95 transition-transform"
              >
                AGAIN
              </button>
              <button 
                onClick={() => setGameState('MENU')}
                className="px-10 py-3 bg-white/10 text-white font-bold text-lg rounded-lg hover:bg-white/20 transition-all"
              >
                HAUPTMENÜ
              </button>
            </div>
          </motion.div>
        )}

        {gameState === 'AUTH' && (
          <motion.div 
            key="auth"
            variants={menuVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md z-50 px-6"
          >
            <SupabaseAuth onAuthSuccess={() => setGameState('MENU')} />
            <button 
              onClick={() => setGameState('MENU')}
              className="mt-8 text-sm font-bold uppercase tracking-widest text-[#ff0055] hover:brightness-125 transition-all"
            >
              Abbrechen
            </button>
          </motion.div>
        )}

        {gameState === 'LEADERBOARD' && (
          <motion.div 
            key="leaderboard"
            variants={menuVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md z-50 px-4 md:px-6 py-10 overflow-y-auto"
          >
            <Leaderboard />
            <button 
              onClick={() => setGameState('MENU')}
              className="my-10 px-8 py-3 bg-white text-black font-black uppercase tracking-widest rounded-xl hover:scale-105 transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)]"
            >
              Schließen
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background Decor */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,#00ccff33,transparent_70%)]" />
      </div>
    </div>
  );
}
