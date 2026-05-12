import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { NeonCanvas } from './components/NeonCanvas';
import { Joystick } from './components/Joystick';
import { SupabaseAuth } from './components/SupabaseAuth';
import { AccountSettings } from './components/AccountSettings';
import { AdminPanel } from './components/AdminPanel';
import { Leaderboard } from './components/Leaderboard';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { GameState, Player, Upgrade, Vector } from './types';
import { getRandomUpgrades } from './upgrades';
import confetti from 'canvas-confetti';
import { Shield, Zap, Sword, Heart, Wind, Gamepad2, Info, Maximize2, Minimize2, Trophy, User, LogOut, Pause, Play, Home } from 'lucide-react';

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
  const [personalHighScore, setPersonalHighScore] = useState<number>(0);
  const [lastScore, setLastScore] = useState(0); 
  const [gameStats, setGameStats] = useState({ health: 100, maxHealth: 100, level: 1, xp: 0, xpNext: 100 });
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [pendingRequests, setPendingRequests] = useState(0);
  
  const [currentPlayerState, setCurrentPlayerState] = useState<Player | null>(null);

  const [startLevel, setStartLevel] = useState(1);

  const isAdmin = session?.user?.email === 'david.helmel@outlook.com';

  const containerRef = useRef<HTMLDivElement>(null);

  const fetchPersonalHighScore = async (uid: string) => {
    if (!isSupabaseConfigured) return;
    try {
      const { data, error } = await supabase
        .from('high_scores')
        .select('score')
        .eq('user_id', uid)
        .order('score', { ascending: false })
        .limit(1);
      
      if (error) throw error;
      if (data && data.length > 0) {
        setPersonalHighScore(data[0].score);
      }
    } catch (err) {
      console.error('Failed to fetch personal high score:', err);
    }
  };

  useEffect(() => {
    setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
    
    if (isSupabaseConfigured) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session);
        if (session?.user) {
          setUsername(session.user.user_metadata.username || session.user.email?.split('@')[0] || 'Player');
          fetchPersonalHighScore(session.user.id);
        }
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session);
        if (session?.user) {
          setUsername(session.user.user_metadata.username || session.user.email?.split('@')[0] || 'Player');
          fetchPersonalHighScore(session.user.id);
        } else {
          setPersonalHighScore(0);
          setUsername('');
        }
      });

      // Polling für Admin-Anfragen
      let interval: any;
      if (session?.user?.email === 'david.helmel@outlook.com') {
        const fetchPendingCount = async () => {
          const { count } = await supabase
            .from('deletion_requests')
            .select('*', { count: 'exact', head: true });
          setPendingRequests(count || 0);
        };
        fetchPendingCount();
        interval = setInterval(fetchPendingCount, 30000); // Alle 30 Sekunden prüfen
      }

      const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
          setGameState(prev => {
            if (prev === 'PLAYING') return 'PAUSED';
            if (prev === 'PAUSED') return 'PLAYING';
            return prev;
          });
        }
      };

      document.addEventListener('fullscreenchange', handleFullscreenChange);
      window.addEventListener('keydown', handleKeyDown);

      return () => {
        subscription.unsubscribe();
        if (interval) clearInterval(interval);
        document.removeEventListener('fullscreenchange', handleFullscreenChange);
        window.removeEventListener('keydown', handleKeyDown);
      };
    } else {
      const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
          setGameState(prev => {
            if (prev === 'PLAYING') return 'PAUSED';
            if (prev === 'PAUSED') return 'PLAYING';
            return prev;
          });
        }
      };

      document.addEventListener('fullscreenchange', handleFullscreenChange);
      window.addEventListener('keydown', handleKeyDown);

      return () => {
        document.removeEventListener('fullscreenchange', handleFullscreenChange);
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (gameState !== 'PLAYING' && gameState !== 'BOSS_FIGHT') return;
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
    setLastScore(0);
    setGameStats({ 
        health: 100 + (startLevel - 1) * 20, 
        maxHealth: 100 + (startLevel - 1) * 20, 
        level: startLevel, 
        xp: 0, 
        xpNext: 100 * startLevel 
    });
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

  const saveScoreToSupabase = async (finalScore: number) => {
    if (isSupabaseConfigured) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        try {
          await supabase.from('high_scores').insert({
            user_id: session.user.id,
            username: session.user.user_metadata.username || session.user.email?.split('@')[0],
            score: finalScore,
          });
          if (finalScore > personalHighScore) {
            setPersonalHighScore(finalScore);
          }
        } catch (err) {
          console.error('Failed to save score:', err);
        }
      }
    }
  };

  const handleGameOver = useCallback(async (finalScore: number) => {
    setGameState('GAME_OVER');
    setScore(finalScore);
    setLastScore(finalScore);
    await saveScoreToSupabase(finalScore);
  }, [personalHighScore]);

  const handleQuitAndSave = async (currentScore: number) => {
    await saveScoreToSupabase(currentScore);
    setGameState('MENU');
    setScore(0);
  };


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
        onScoreUpdate={setScore}
        onStatsUpdate={setGameStats}
        onDamage={triggerShake}
        onBossStart={() => {
          setGameState('BOSS_INTRO');
          setTimeout(() => setGameState('BOSS_FIGHT'), 3000);
        }}
        onBossEnd={() => {
          setGameState('PLAYING');
          confetti({
            particleCount: 150,
            spread: 90,
            origin: { y: 0.5 },
            colors: ['#ff00ff', '#00ccff', '#ffffff']
          });
        }}
        playerStats={playerStats}
        joystickDir={joystickDir}
        startLevel={startLevel}
      />

      {/* Boss Overlays */}
      <AnimatePresence>
        {gameState === 'BOSS_INTRO' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.5 }}
            className="absolute inset-0 z-[70] flex flex-col items-center justify-center pointer-events-none"
          >
            <motion.div
              animate={{ 
                textShadow: ['0 0 10px #ff00ff', '0 0 40px #ff00ff', '0 0 10px #ff00ff'],
              }}
              transition={{ repeat: Infinity, duration: 1 }}
              className="text-6xl md:text-9xl font-black italic tracking-tighter text-[#ff00ff] uppercase"
            >
              Boss Incoming
            </motion.div>
            <div className="h-1 w-64 bg-white/20 mt-4 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: '100%' }}
                transition={{ duration: 3 }}
                className="h-full bg-[#ff00ff]"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Joystick for Mobile */}
      {(gameState === 'PLAYING' || gameState === 'BOSS_FIGHT') && joystickPos && (
        <Joystick 
          position={joystickPos} 
          onMove={setJoystickDir} 
          onEnd={handleTouchEnd}
        />
      )}

      {/* Global Controls & HUD */}
      <div className="absolute top-4 left-4 right-4 md:top-6 md:left-6 md:right-6 z-[60] flex items-start justify-between pointer-events-none">
        {(gameState === 'PLAYING' || gameState === 'BOSS_INTRO' || gameState === 'BOSS_FIGHT') && (
          <div className="flex flex-col gap-2 w-full max-w-[160px] sm:max-w-[200px] md:max-w-xs pointer-events-auto">
            {/* Health Bar */}
            <div className="relative h-4 md:h-6 bg-black/40 border border-white/10 rounded-full overflow-hidden backdrop-blur-sm">
              <motion.div 
                initial={false}
                animate={{ width: `${(gameStats.health / gameStats.maxHealth) * 100}%` }}
                className={`h-full ${gameStats.health < gameStats.maxHealth * 0.3 ? 'bg-[#ff0055]' : 'bg-[#00ff55]'} shadow-[0_0_10px_rgba(0,255,85,0.5)]`}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[10px] font-black italic text-white drop-shadow-md">
                  {Math.ceil(gameStats.health)} / {gameStats.maxHealth}
                </span>
              </div>
            </div>

            {/* XP and Level */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-1.5 md:h-2 bg-black/40 border border-white/5 rounded-full overflow-hidden">
                <motion.div 
                  initial={false}
                  animate={{ width: `${(gameStats.xp / gameStats.xpNext) * 100}%` }}
                  className="h-full bg-[#00ccff] shadow-[0_0_5px_rgba(0,204,255,0.5)]"
                />
              </div>
              <div className="bg-[#00ccff] text-[#050a14] px-2 py-0.5 rounded font-black text-xs italic shrink-0">
                LVL {gameStats.level}
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 pointer-events-auto ml-auto">
          {(gameState === 'PLAYING' || gameState === 'BOSS_FIGHT') && (
            <>
              <div className="px-4 py-2 bg-black/60 border border-white/10 rounded-xl backdrop-blur-md flex flex-col items-end">
                <span className="text-[8px] font-bold uppercase tracking-widest text-[#00ccff]">Score</span>
                <span className="text-xl font-black font-mono leading-none">{score}</span>
              </div>
              <button
                onClick={() => setGameState('PAUSED')}
                className="w-12 h-12 flex items-center justify-center bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all active:scale-95 group backdrop-blur-md"
                title="Pause"
              >
                <Pause size={24} className="text-white group-hover:text-[#00ccff] transition-colors" />
              </button>
            </>
          )}
          {(gameState === 'MENU' || gameState === 'AUTH' || gameState === 'LEADERBOARD') && session && (
            <div className="hidden sm:flex items-center gap-3 px-4 py-2 bg-white/5 border border-white/10 rounded-xl backdrop-blur-md">
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
            className="w-12 h-12 flex items-center justify-center bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all active:scale-95 group backdrop-blur-md"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? (
              <Minimize2 size={24} className="text-white group-hover:text-[#00ccff] transition-colors" />
            ) : (
              <Maximize2 size={24} className="text-white group-hover:text-[#00ccff] transition-colors" />
            )}
          </button>

          {isAdmin && (
            <button
              onClick={() => setShowAdminPanel(true)}
              className="relative w-12 h-12 flex items-center justify-center bg-[#ff0055]/10 hover:bg-[#ff0055]/20 border border-[#ff0055]/30 rounded-xl transition-all active:scale-95 group backdrop-blur-md"
              title="Admin Panel"
            >
              <Shield size={24} className="text-[#ff0055]" />
              {pendingRequests > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#ff0055] text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-bounce border-2 border-black">
                  {pendingRequests}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Admin Panel Overlay */}
      <AnimatePresence>
        {showAdminPanel && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-10 pointer-events-none">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setShowAdminPanel(false)}
              className="absolute inset-0 bg-black/60 pointer-events-auto"
            />
            <div className="relative z-10 w-full max-w-4xl pointer-events-auto">
              <AdminPanel onClose={() => setShowAdminPanel(false)} startLevel={startLevel} onSetStartLevel={setStartLevel} isAdmin={isAdmin} />
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Overlay UI */}
      <AnimatePresence>
        {gameState === 'PAUSED' && (
          <motion.div 
            key="paused"
            variants={menuVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-md z-50 px-6 py-10 text-center"
          >
            <h2 className="text-5xl md:text-8xl font-black mb-8 tracking-tighter text-[#00ccff] drop-shadow-[0_0_15px_rgba(0,204,255,0.5)]">
              PAUSE
            </h2>
            
            <div className="flex flex-col sm:flex-row gap-4 w-full max-w-xs sm:max-w-md mx-auto">
              <button 
                onClick={() => setGameState('PLAYING')}
                className="flex-1 group relative px-10 py-5 bg-[#00ccff] text-[#050a14] font-bold text-2xl rounded-xl overflow-hidden transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(0,204,255,0.4)] flex items-center justify-center gap-3"
              >
                <Play size={24} fill="currentColor" />
                WEITER
              </button>
              
              <button 
                onClick={() => handleQuitAndSave(score)}
                className="flex-1 px-10 py-4 bg-white/10 text-white font-bold text-lg rounded-xl hover:bg-white/20 transition-all flex items-center justify-center gap-3 border border-white/10"
              >
                <Home size={20} />
                BEENDEN
              </button>
            </div>
            
            <div className="mt-8 p-4 bg-white/5 border border-white/10 rounded-xl min-w-[200px]">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Aktueller Score</p>
              <p className="text-3xl font-black text-white font-mono">{score}</p>
            </div>
          </motion.div>
        )}
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
              className="mb-8 md:mb-12 shrink-0 px-4"
            >
              <h1 className="text-7xl sm:text-8xl md:text-9xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-[#00ccff] to-[#ff0055] drop-shadow-[0_0_15px_rgba(0,204,255,0.3)]">
                SHIFF
              </h1>
            </motion.div>

            <div className="flex flex-col gap-4 w-full max-w-sm">
              {session && (
                <div className="mb-2 p-4 bg-white/5 border border-[#00ccff]/20 rounded-xl">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Dein Bestwert</p>
                  <p className="text-3xl font-black text-[#00ccff] font-mono">{personalHighScore}</p>
                </div>
              )}
              
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
            <h2 className="text-xl sm:text-2xl md:text-4xl font-black mb-4 md:mb-12 tracking-tight flex items-center gap-2 md:gap-4 shrink-0">
              <Zap className="text-[#00ff00] animate-pulse w-5 h-5 md:w-8 md:h-8" />
              UPGRADE WÄHLEN
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-6 w-full max-w-5xl pb-8">
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
                  <div className="w-8 h-8 md:w-12 md:h-12 bg-white/5 rounded-lg md:rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                    {u.id === 'firerate' && <Zap size={20} className="text-[#ff9900]" />}
                    {u.id === 'damage' && <Sword size={20} className="text-[#ff0055]" />}
                    {u.id === 'speed' && <Wind size={20} className="text-[#00ccff]" />}
                    {u.id === 'health' && <Heart size={20} className="text-[#00ff00]" />}
                    {u.id === 'projectiles' && <Shield size={20} className="text-[#00ccff]" />}
                    {u.id === 'lifesteal' && <Zap size={20} className="text-[#ff0055]" />}
                  </div>
                  <div>
                    <h3 className="text-base md:text-xl font-bold md:mb-2 group-hover:text-[#00ccff] transition-colors">{u.name}</h3>
                    <p className="text-[10px] md:text-sm text-gray-400 leading-tight md:leading-relaxed">{u.description}</p>
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
            <h2 className="text-5xl sm:text-7xl md:text-8xl font-black mb-4 tracking-tighter text-[#ff0055] drop-shadow-[0_0_15px_rgba(255,0,85,0.5)]">
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
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md z-50 px-6 py-10 overflow-y-auto"
          >
            {session ? (
              <AccountSettings 
                user={session.user} 
                onUsernameUpdate={(name) => setUsername(name || 'Anonym')} 
              />
            ) : (
              <SupabaseAuth onAuthSuccess={() => setGameState('MENU')} />
            )}
            <button 
              onClick={() => setGameState('MENU')}
              className="mt-8 text-sm font-bold uppercase tracking-widest text-[#ff0055] hover:brightness-125 transition-all mb-8"
            >
              Schließen
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
