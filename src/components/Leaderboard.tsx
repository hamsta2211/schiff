import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Trophy, Medal, User, Zap, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

interface Score {
  username: string;
  score: number;
  created_at: string;
}

export const Leaderboard: React.FC = () => {
  const [scores, setScores] = useState<Score[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchScores(true);
    
    const interval = setInterval(() => {
      fetchScores(false);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const fetchScores = async (showLoading: boolean) => {
    if (showLoading) setLoading(true);
    try {
      // Wir holen alle Scores und filtern sie in JS, um sicherzustellen, dass jeder User nur einmal erscheint
      // (Besser wäre ein SQL-View oder 'DISTINCT ON' in Supabase, aber so ist es am sichersten ohne Datenbank-Änderung)
      const { data, error } = await supabase
        .from('high_scores')
        .select('*')
        .order('score', { ascending: false });

      if (error) throw error;
      
      const uniqueScores: Score[] = [];
      const seenUsers = new Set();
      
      if (data) {
        for (const s of data) {
          if (!seenUsers.has(s.username)) {
            seenUsers.add(s.username);
            uniqueScores.push(s);
          }
          if (uniqueScores.length >= 10) break;
        }
      }
      
      setScores(uniqueScores);
    } catch (err) {
      console.error('Error fetching scores:', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl bg-black/40 backdrop-blur-md rounded-3xl border border-white/10 p-4 md:p-10 shadow-2xl overflow-hidden max-h-[80vh] flex flex-col">
      <div className="flex items-center justify-between mb-4 md:mb-8 shrink-0">
        <h3 className="text-xl md:text-3xl font-black tracking-tight flex items-center gap-3">
          <Trophy className="text-[#ff9900] w-6 h-6 md:w-8 md:h-8" />
          BESTENLISTE
        </h3>
      </div>

      {loading ? (
        <div className="flex justify-center py-10 md:py-20">
          <Loader2 className="animate-spin text-[#00ccff] w-8 h-8 md:w-10 md:h-10" />
        </div>
      ) : (
        <div className="space-y-2 md:space-y-3 overflow-y-auto pr-2 custom-scrollbar">
          {scores.length === 0 ? (
            <p className="text-center py-10 text-gray-500 font-medium">Noch keine Einträge...</p>
          ) : (
            scores.map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`flex items-center justify-between p-3 md:p-4 rounded-xl md:rounded-2xl bg-white/5 border ${
                  i === 0 ? 'border-[#ff9900]/50 bg-[#ff9900]/5' : 'border-white/5'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 flex items-center justify-center font-black text-sm italic">
                    {i === 0 && <Medal className="text-[#ff9900]" />}
                    {i === 1 && <Medal className="text-gray-300" />}
                    {i === 2 && <Medal className="text-orange-600" />}
                    {i > 2 && <span className="text-gray-500">#{i + 1}</span>}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold text-white group-hover:text-[#00ccff]">{s.username}</span>
                    <span className="text-[10px] uppercase font-bold tracking-tighter text-gray-500">
                      {new Date(s.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Zap size={14} className="text-[#00ccff]" />
                  <span className="text-xl font-black font-mono text-[#00ccff]">{s.score}</span>
                </div>
              </motion.div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
