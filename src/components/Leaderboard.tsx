import React, { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Trophy, Medal, User, Zap, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

interface Score {
  username: string;
  score: number;
  created_at: string;
  user_id?: string;
  email?: string;
}

export const Leaderboard: React.FC<{ mode?: 'normal' | 'arrow_dash' }> = ({ mode = 'normal' }) => {
  const [scores, setScores] = useState<Score[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isSupabaseConfigured) {
      fetchScores(true);
      
      const interval = setInterval(() => {
        fetchScores(false);
      }, 5000);

      return () => clearInterval(interval);
    } else {
      setLoading(false);
    }
  }, [mode]);

  const fetchScores = async (showLoading: boolean) => {
    if (!isSupabaseConfigured) return;
    if (showLoading) setLoading(true);
    setErrorMsg('');
    try {
      const table = mode === 'arrow_dash' ? 'arrow_dash_scores' : 'high_scores';
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .order('score', { ascending: false });

      if (error) throw error;
      
      const uniqueScores: Score[] = [];
      const seenUsers = new Set();
      
      if (data) {
        for (const s of data) {
          // Wir nutzen die user_id zur Eindeutigkeit, falls vorhanden
          const identifier = s.user_id || s.username;
          if (!seenUsers.has(identifier)) {
            seenUsers.add(identifier);
            uniqueScores.push(s);
          }
          if (uniqueScores.length >= 10) break;
        }
      }
      
      setScores(uniqueScores);
    } catch (err: any) {
      console.error('Error fetching scores:', err);
      setErrorMsg(err.message || 'Ein Fehler ist aufgetreten');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const isDash = mode === 'arrow_dash';
  const themeColor = isDash ? '#ff0055' : '#00ccff';

  return (
    <div className="w-full max-w-2xl bg-black/40 backdrop-blur-md rounded-3xl border border-white/10 p-4 md:p-8 shadow-2xl overflow-hidden max-h-[75vh] flex flex-col">
      <div className="flex items-center justify-between mb-4 md:mb-6 shrink-0">
        <h3 className="text-xl md:text-3xl font-black tracking-tight flex items-center gap-3">
          <Trophy className={`text-[${themeColor}] w-6 h-6 md:w-8 md:h-8`} style={{ color: themeColor }} />
          BESTENLISTE {isDash ? '(ARROW DASH)' : ''}
        </h3>
      </div>

      {loading ? (
        <div className="flex justify-center py-6 md:py-12">
          <Loader2 className={`animate-spin w-8 h-8 md:w-10 md:h-10`} style={{ color: themeColor }} />
        </div>
      ) : errorMsg ? (
        <div className="py-6 text-center text-red-500 font-bold">
          Fehler: {errorMsg}
          <div className="text-xs text-gray-400 mt-2 font-normal whitespace-pre-wrap">
            Wenn die Tabelle 'arrow_dash_scores' fehlt, muss sie in Supabase erstellt werden.
          </div>
        </div>
      ) : (
        <div className="space-y-1.5 md:space-y-3 overflow-y-auto pr-2 custom-scrollbar flex-grow">
          {scores.length === 0 ? (
            <p className="text-center py-6 text-gray-500 font-medium">Noch keine Einträge...</p>
          ) : (
            scores.map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`flex items-center justify-between p-2.5 md:p-4 rounded-xl md:rounded-2xl bg-white/5 border ${
                  i === 0 ? 'border-[#ff9900]/50 bg-[#ff9900]/5' : 'border-white/5'
                }`}
              >
                <div className="flex items-center gap-3 md:gap-4 leading-tight">
                  <div className="w-6 h-6 md:w-8 md:h-8 flex items-center justify-center font-black text-xs md:text-sm italic shrink-0">
                    {i === 0 && <Medal size={20} className="text-[#ff9900]" />}
                    {i === 1 && <Medal size={20} className="text-gray-300" />}
                    {i === 2 && <Medal size={20} className="text-orange-600" />}
                    {i > 2 && <span className="text-gray-500">#{i + 1}</span>}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-white group-hover:text-white truncate text-sm md:text-base">{s.username}</span>
                    <span className="text-[9px] md:text-[10px] uppercase font-bold tracking-tighter text-gray-500">
                      {new Date(s.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Zap size={12} style={{ color: themeColor }} />
                  <span className="text-lg md:text-xl font-black font-mono" style={{ color: themeColor }}>{s.score}</span>
                </div>
              </motion.div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
