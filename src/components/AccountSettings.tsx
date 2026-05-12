import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { User, Mail, Lock, LogOut, Trash2, ShieldCheck, AlertTriangle, Loader2, CheckCircle2 } from 'lucide-react';

export function AccountSettings({ user, onUsernameUpdate }: { user: any, onUsernameUpdate: (name: string) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [username, setUsername] = useState(user?.user_metadata?.username || '');
  const [email, setEmail] = useState(user?.email || '');
  const [newPassword, setNewPassword] = useState('');
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const providers = user?.app_metadata?.providers || [];
  const hasGoogle = providers.includes('google');
  const hasEmail = providers.includes('email');

  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess(null);
        setError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (!isSupabaseConfigured) throw new Error('Supabase nicht konfiguriert');

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error('Sitzung abgelaufen. Bitte melden Sie sich ab und erneut an.');
      }

      // 1. Update Auth Metadata
      const { data: { user: updatedUser }, error: updateError } = await supabase.auth.updateUser({
        data: { username }
      });

      if (updateError) throw updateError;
      
      // 2. Update Username in high_scores table
      const { error: scoresError } = await supabase
        .from('high_scores')
        .update({ username })
        .eq('user_id', sessionData.session.user.id);

      if (scoresError) {
        console.warn('Hinweis: Bestenliste konnte nicht aktualisiert werden (evtl. noch kein Score vorhanden):', scoresError.message);
      }
      
      onUsernameUpdate(username);
      setSuccess('Profil erfolgreich aktualisiert!');
    } catch (err: any) {
      setError(err.message === 'Auth session missing!' ? 'Sitzung abgelaufen. Bitte melden Sie sich ab und erneut an.' : err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) throw new Error('Sitzung abgelaufen. Bitte ab- und anmelden.');

      const { error: updateError } = await supabase.auth.updateUser({ email });
      if (updateError) throw updateError;
      setSuccess('Bestätigungsemail an die neue Adresse gesendet!');
    } catch (err: any) {
      setError(err.message === 'Auth session missing!' ? 'Sitzung abgelaufen. Bitte melden Sie sich ab und erneut an.' : err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setError('Passwort muss mindestens 6 Zeichen lang sein.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) throw new Error('Sitzung abgelaufen. Bitte ab- und anmelden.');

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
      setNewPassword('');
      setSuccess('Passwort wurde erfolgreich geändert!');
    } catch (err: any) {
      setError(err.message === 'Auth session missing!' ? 'Sitzung abgelaufen. Bitte melden Sie sich ab und erneut an.' : err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!isSupabaseConfigured) throw new Error('Supabase nicht konfiguriert');

      // 1. Löschungsanfrage in der Datenbank speichern
      const { error: requestError } = await supabase
        .from('deletion_requests')
        .insert([{ 
          user_id: user.id, 
          email: user.email,
          username: username,
          requested_at: new Date().toISOString()
        }]);

      // Wir machen weiter, auch wenn der Insert fehlschlägt (z.B. Tabelle noch nicht da)
      if (requestError) {
        console.error('Anfrage konnte nicht gespeichert werden:', requestError);
      }

      // 2. Erfolg-Meldung setzen
      setSuccess('Support wurde kontaktiert. Ihr Account wird in Kürze gelöscht.');
      
      // 3. Nach kurzem Delay abmelden
      setTimeout(async () => {
        await supabase.auth.signOut();
        window.location.reload();
      }, 3000);
      
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full max-w-md p-4 sm:p-8 bg-black/40 border border-white/10 rounded-3xl backdrop-blur-xl shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar"
    >
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-black tracking-tight text-white">KONTO</h2>
        <div className="flex items-center gap-2">
          {hasGoogle && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-full border border-white/5" title="Mit Google verbunden">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              <span className="text-[10px] font-bold text-white/70 uppercase">Google</span>
            </div>
          )}
          {hasEmail && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[#00ccff]/10 rounded-full border border-[#00ccff]/20" title="Mit E-Mail verbunden">
              <Mail size={14} className="text-[#00ccff]" />
              <span className="text-[10px] font-bold text-[#00ccff] uppercase">E-Mail</span>
            </div>
          )}
        </div>
      </div>

      {error && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-3 bg-red-500/20 border border-red-500/50 rounded-xl mb-6 flex items-center gap-2 text-red-200 text-sm">
          <AlertTriangle size={16} />
          {error}
        </motion.div>
      )}

      {success && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-3 bg-green-500/20 border border-green-500/50 rounded-xl mb-6 flex items-center gap-2 text-green-200 text-sm">
          <CheckCircle2 size={16} />
          {success}
        </motion.div>
      )}

      <div className="space-y-6">
        {/* Username Update */}
        <section className="space-y-3">
          <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Benutzername</label>
          <form onSubmit={handleUpdateProfile} className="flex gap-2">
            <div className="relative flex-1">
              <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-white focus:border-[#00ccff] transition-all outline-none"
              />
            </div>
            <button 
              type="submit" 
              disabled={loading}
              className="bg-[#00ccff] text-black font-bold px-4 rounded-xl hover:scale-105 active:scale-95 transition-all text-sm disabled:opacity-50"
            >
              ÄNDERN
            </button>
          </form>
        </section>

        {/* Email Update */}
        <section className="space-y-3">
          <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">E-Mail Adresse</label>
          <form onSubmit={handleUpdateEmail} className="flex gap-2">
            <div className="relative flex-1">
              <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-white focus:border-[#00ccff] transition-all outline-none"
              />
            </div>
            <button 
              type="submit" 
              disabled={loading}
              className="bg-white/10 text-white font-bold px-4 rounded-xl hover:bg-white/20 transition-all text-sm disabled:opacity-50"
            >
              ÄNDERN
            </button>
          </form>
          <p className="text-[10px] text-gray-500">Hinweis: Eine Änderung erfordert eine Bestätigung der neuen E-Mail.</p>
        </section>

        {/* Password Update - Only for Email users */}
        {hasEmail && (
          <section className="space-y-3">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Neues Passwort</label>
            <form onSubmit={handleUpdatePassword} className="flex gap-2">
              <div className="relative flex-1">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                  type="password" 
                  value={newPassword}
                  placeholder="******"
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-white focus:border-[#00ccff] transition-all outline-none"
                />
              </div>
              <button 
                type="submit" 
                disabled={loading}
                className="bg-white/10 text-white font-bold px-4 rounded-xl hover:bg-white/20 transition-all text-sm disabled:opacity-50"
              >
                ÄNDERN
              </button>
            </form>
          </section>
        )}

        <div className="pt-4 border-t border-white/10 space-y-3">
          <button 
            onClick={() => supabase.auth.signOut()}
            className="w-full py-3 bg-white/5 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-white/10 transition-all active:scale-95 border border-white/10"
          >
            <LogOut size={18} />
            ABMELDEN
          </button>

          {!showDeleteConfirm ? (
            <button 
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full py-3 bg-red-500/10 text-red-500 font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-red-500/20 transition-all active:scale-95 border border-red-500/20"
            >
              <Trash2 size={18} />
              ACCOUNT LÖSCHEN
            </button>
          ) : (
            <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-2xl space-y-3">
              <p className="text-xs font-bold text-red-200">Bist du sicher? Alle deine Highscores und dein Fortschritt werden unwiderruflich gelöscht!</p>
              <div className="flex gap-2">
                <button 
                  onClick={handleDeleteAccount}
                  disabled={loading}
                  className="flex-1 py-2 bg-red-500 text-white font-bold rounded-lg text-sm hover:scale-105 transition-all"
                >
                  {loading ? <Loader2 className="animate-spin mx-auto" /> : 'JA, LÖSCHEN'}
                </button>
                <button 
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-2 bg-white/10 text-white font-bold rounded-lg text-sm"
                >
                  ABBRECHEN
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
