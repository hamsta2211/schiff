import React, { useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { motion } from 'motion/react';
import { User, Lock, Mail, Loader2 } from 'lucide-react';

interface SupabaseAuthProps {
  onAuthSuccess: () => void;
}

export const SupabaseAuth: React.FC<SupabaseAuthProps> = ({ onAuthSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!isSupabaseConfigured) {
        throw new Error('Supabase ist noch nicht konfiguriert. Bitte füge URL und Key in den AI Studio Einstellungen hinzu.');
      }

      if (isSignUp) {
        // Prüfen, ob der Nutzername bereits vergeben ist
        const { data: existingUser, error: checkError } = await supabase
          .from('high_scores')
          .select('username')
          .eq('username', username)
          .limit(1);

        if (checkError) console.warn('Username check failed', checkError);
        
        if (existingUser && existingUser.length > 0) {
          throw new Error('Dieser Nutzername ist bereits vergeben. Bitte wähle einen anderen.');
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username: username || email.split('@')[0],
            },
          },
        });
        if (error) throw error;
        
        // If Supabase is configured to auto-confirm, data.session will be present
        if (data.session) {
          onAuthSuccess();
        } else {
          setError('Erfolg! Bitte schau in dein Postfach zur E-Mail-Bestätigung (falls aktiviert) und melde dich dann an.');
          setIsSignUp(false);
          setEmail('');
          setPassword('');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        onAuthSuccess();
      }
    } catch (err: any) {
      console.error('Auth Error:', err);
      let msg = err.message || 'Ein Fehler ist aufgetreten';
      if (msg.includes('Failed to fetch')) msg = 'Keine Verbindung zum Server (Netzwerkfehler)';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full max-w-md p-5 md:p-8 bg-white/5 border border-white/10 rounded-3xl backdrop-blur-xl shadow-2xl max-h-[95vh] overflow-y-auto custom-scrollbar"
    >
      <h2 className="text-xl md:text-3xl font-black mb-4 md:mb-8 text-center bg-clip-text text-transparent bg-gradient-to-r from-[#00ccff] to-[#ff0055]">
        {isSignUp ? 'ACCOUNT ERSTELLEN' : 'ANMELDEN'}
      </h2>

      <form onSubmit={handleAuth} className="space-y-3 md:space-y-6">
        {isSignUp && (
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1">Nutzername</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
              <input
                type="text"
                placeholder="SurvivorX"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 md:py-4 pl-11 pr-4 focus:border-[#00ccff] transition-colors outline-none text-white text-sm"
                required={isSignUp}
              />
            </div>
          </div>
        )}

        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1">Email</label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
            <input
              type="email"
              placeholder="player@shiff.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 md:py-4 pl-11 pr-4 focus:border-[#00ccff] transition-colors outline-none text-white text-sm"
              required
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1">Passwort</label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 md:py-4 pl-11 pr-4 focus:border-[#00ccff] transition-colors outline-none text-white text-sm"
              required
            />
          </div>
        </div>

        {error && (
          <p className="text-[#ff0055] text-[10px] md:text-xs font-semibold px-2 bg-red-500/10 py-2 rounded-lg border border-red-500/20">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 md:py-4 bg-[#00ccff] text-[#050a14] font-black text-sm md:text-lg rounded-xl flex items-center justify-center gap-2 hover:bg-[#00e1ff] transition-all disabled:opacity-50 active:scale-95 shadow-[0_0_20px_rgba(0,204,255,0.3)] mt-2"
        >
          {loading ? <Loader2 className="animate-spin w-5 h-5 md:w-6 md:h-6" /> : (isSignUp ? 'REGISTRIEREN' : 'ANMELDEN')}
        </button>
      </form>

      <button
        onClick={() => {
          setIsSignUp(!isSignUp);
          setError(null);
        }}
        className="w-full mt-4 md:mt-6 text-xs md:text-sm text-gray-400 hover:text-white transition-colors font-medium underline underline-offset-4"
      >
        {isSignUp ? 'Bereits einen Account? Hier anmelden' : 'Kein Account? Jetzt registrieren'}
      </button>
    </motion.div>
  );
};
