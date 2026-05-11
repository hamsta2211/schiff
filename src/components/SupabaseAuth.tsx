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

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!isSupabaseConfigured) {
        throw new Error('Supabase ist noch nicht konfiguriert.');
      }
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          skipBrowserRedirect: true
        }
      });
      
      if (error) throw error;
      
      if (data?.url) {
        // Wir öffnen Google Login in einem neuen Fenster, um Iframe-Probleme zu vermeiden
        window.open(data.url, '_blank');
        setError('Google Login wurde in einem neuen Tab geöffnet. Sobald du dich angemeldet hast, kannst du hier weitermachen.');
      }
    } catch (err: any) {
      setError(err.message);
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

      <div className="mb-6">
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full py-3 bg-white text-black font-bold rounded-xl flex items-center justify-center gap-3 hover:bg-gray-100 transition-all active:scale-95 border border-white mb-6"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Mit Google anmelden
        </button>

        <div className="relative flex items-center justify-center">
          <div className="flex-grow border-t border-white/10"></div>
          <span className="flex-shrink mx-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Oder mit E-Mail</span>
          <div className="flex-grow border-t border-white/10"></div>
        </div>
      </div>

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
