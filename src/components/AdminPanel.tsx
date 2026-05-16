import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { supabase } from '../lib/supabase';
import { Shield, Trash2, User, Mail, Clock, CheckCircle, AlertCircle, Loader2, X, ArrowLeft } from 'lucide-react';

export function AdminPanel({ 
  onClose,
  startLevel,
  onSetStartLevel,
  isAdmin
}: { 
  onClose: () => void;
  startLevel?: number;
  onSetStartLevel?: (v: number) => void;
  isAdmin?: boolean;
}) {
  const [requests, setRequests] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [view, setView] = useState<'requests' | 'users' | 'user_detail'>('requests');
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [editScores, setEditScores] = useState({ normal: 0, arrowDash: 0 });

  useEffect(() => {
    if (view === 'requests') {
      fetchRequests();
    } else if (view === 'users') {
      fetchUsers();
    }

    // Real-time subscription für neue Löschungsanfragen
    const channel = supabase
      .channel('deletion_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deletion_requests' }, () => {
        if (view === 'requests') fetchRequests();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [view]);

  const fetchRequests = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('deletion_requests')
      .select('*')
      .order('requested_at', { ascending: false });

    if (!error && data) {
      setRequests(data);
    }
    setLoading(false);
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Wir holen alle User aus beiden Score-Tabellen
      // Fallback falls die E-Mail Spalte noch nicht existiert
      let { data: normalScores, error: err1 } = await supabase.from('high_scores').select('user_id, username, score, email');
      if (err1) {
        let { data: ns2 } = await supabase.from('high_scores').select('user_id, username, score');
        normalScores = ns2;
      }
      
      let { data: dashScores, error: err2 } = await supabase.from('arrow_dash_scores').select('user_id, username, score, email');
      if (err2) {
        let { data: ds2 } = await supabase.from('arrow_dash_scores').select('user_id, username, score');
        dashScores = ds2;
      }
      
      const allEntries = [...(normalScores || []), ...(dashScores || [])];
      const userMap = new Map<string, any>();
      
      allEntries.forEach(entry => {
        if (!entry.user_id) return;
        
        const existing = userMap.get(entry.user_id);
        const isFromNormal = entry.score !== undefined && normalScores?.some(ns => ns.user_id === entry.user_id && ns.score === entry.score);
        
        if (!existing) {
          userMap.set(entry.user_id, {
            id: entry.user_id,
            username: entry.username || 'Unbekannt',
            email: entry.email || 'Nicht hinterlegt',
            bestScore: entry.score || 0,
            normalScore: isFromNormal ? entry.score : 0,
            dashScore: !isFromNormal ? entry.score : 0
          });
        } else {
          if (entry.email) existing.email = entry.email;
          if (isFromNormal) {
            existing.normalScore = Math.max(existing.normalScore || 0, entry.score);
          } else {
            existing.dashScore = Math.max(existing.dashScore || 0, entry.score);
          }
          existing.bestScore = Math.max(existing.normalScore, existing.dashScore);
        }
      });
      
      setUsers(Array.from(userMap.values()));
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteData = async (userId: string, requestId: string) => {
    setProcessingId(requestId);
    try {
      // 1. Alle Scores löschen
      await supabase.from('high_scores').delete().eq('user_id', userId);
      
      // 2. Die Löschungsanfrage als "erledigt" markieren oder löschen
      await supabase.from('deletion_requests').delete().eq('id', requestId);
      
      fetchRequests();
    } catch (err) {
      console.error('Fehler beim Löschen:', err);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full max-w-4xl bg-black/80 backdrop-blur-2xl border border-[#ff0055]/30 rounded-3xl p-6 md:p-10 shadow-[0_0_50px_rgba(255,0,85,0.2)] max-h-[90vh] overflow-hidden flex flex-col"
    >
      <div className="flex items-center justify-between mb-8 shrink-0">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-[#ff0055]/10 rounded-2xl border border-[#ff0055]/30">
            <Shield className="text-[#ff0055] w-8 h-8" />
          </div>
          <div>
            <h2 className="text-3xl font-black tracking-tight text-white uppercase">Admin Panel</h2>
            <p className="text-gray-500 text-sm font-bold uppercase tracking-widest">Löschungsanfragen & System</p>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="p-3 hover:bg-white/10 rounded-xl transition-all"
        >
          <X size={24} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-6 md:space-y-8">
        
        {isAdmin && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 md:p-6">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Shield size={20} className="text-[#00ccff]" />
              Dev Settings
            </h3>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <label className="text-gray-400 font-medium whitespace-nowrap">Start Level:</label>
              <input 
                type="number" 
                min="1" 
                max="100" 
                value={startLevel || 1} 
                onChange={(e) => onSetStartLevel && onSetStartLevel(parseInt(e.target.value) || 1)}
                className="bg-black/50 border border-white/10 rounded-lg px-4 py-2 w-full sm:w-24 text-white focus:outline-none focus:border-[#00ccff]"
              />
              <span className="text-sm text-gray-500">(Setze auf 9 für Boss auf Start)</span>
            </div>
          </div>
        )}

        <div>
          <div className="flex items-center gap-4 mb-6 border-b border-white/10 pb-4">
            <button 
              onClick={() => setView('requests')}
              className={`px-4 py-2 rounded-xl font-bold transition-all ${view === 'requests' ? 'bg-[#ff0055] text-white shadow-[0_0_15px_rgba(255,0,85,0.4)]' : 'bg-white/5 text-gray-400 hover:text-white'}`}
            >
              Anfragen
            </button>
            <button 
              onClick={() => setView('users')}
              className={`px-4 py-2 rounded-xl font-bold transition-all ${view === 'users' ? 'bg-[#00ccff] text-white shadow-[0_0_15px_rgba(0,204,255,0.4)]' : 'bg-white/5 text-gray-400 hover:text-white'}`}
            >
              Alle Accounts
            </button>
          </div>

          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            {view === 'requests' ? (
              <>
                <Trash2 size={20} className="text-[#ff0055]" />
                Löschungsanfragen
              </>
            ) : (
              <>
                <User size={20} className="text-[#00ccff]" />
                Alle Accounts (mit Scores)
              </>
            )}
          </h3>

          {loading ? (
            <div className="flex justify-center py-10 md:py-20">
              <Loader2 className="animate-spin text-[#ff0055] w-12 h-12" />
            </div>
          ) : view === 'requests' ? (
            requests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 md:py-20 text-center opacity-50">
                <CheckCircle size={48} className="text-green-500 mb-4" />
                <p className="text-xl font-bold">Alles erledigt!</p>
                <p className="text-gray-400">Momentan liegen keine Löschungsanfragen vor.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {requests.map((req) => (
                  <motion.div 
                    key={req.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 md:p-6 bg-white/5 border border-white/10 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <User size={18} className="text-[#00ccff]" />
                        <span className="font-bold text-lg">{req.username || 'Anonym'}</span>
                      </div>
                      <div className="flex items-center gap-3 text-gray-400">
                        <Mail size={16} />
                        <span className="text-sm break-all">{req.email}</span>
                      </div>
                      <div className="flex items-center gap-3 text-gray-500 text-xs">
                        <Clock size={14} />
                        <span>Anfrage vom {new Date(req.requested_at).toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                      <button 
                        onClick={() => handleDeleteData(req.user_id, req.id)}
                        disabled={processingId === req.id}
                        className="px-6 py-3 bg-red-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-red-600 transition-all active:scale-95 disabled:opacity-50"
                      >
                        {processingId === req.id ? <Loader2 className="animate-spin" size={20} /> : <Trash2 size={20} />}
                        SCORES LÖSCHEN
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )
          ) : view === 'user_detail' && selectedUser ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-6"
            >
                <div className="flex items-center gap-4 mb-6">
                  <button 
                    onClick={() => setView('users')}
                    className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-all"
                  >
                    <ArrowLeft size={20} />
                  </button>
                  <h4 className="text-2xl font-black">User Details</h4>
                </div>

                <div className="grid gap-6">
                  <div className="p-6 bg-white/5 border border-white/10 rounded-2xl space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="text-[10px] text-gray-500 uppercase font-bold">Username</div>
                        <div className="text-lg font-bold text-white">{selectedUser.username}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-gray-500 uppercase font-bold">E-Mail</div>
                        <div className="text-lg font-bold text-[#00ccff] break-all">{selectedUser.email}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-gray-500 uppercase font-bold">User ID</div>
                        <div className="text-xs font-mono text-gray-400 break-all">{selectedUser.id}</div>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 bg-white/5 border border-white/10 rounded-2xl space-y-6">
                    <h5 className="font-bold border-b border-white/10 pb-2">Scores bearbeiten</h5>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Normal Mode Score</label>
                        <input 
                          type="number"
                          value={editScores.normal}
                          onChange={(e) => setEditScores(prev => ({ ...prev, normal: parseInt(e.target.value) || 0 }))}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 font-mono text-xl focus:border-[#ff0055] outline-none transition-all"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Arrow Dash Score</label>
                        <input 
                          type="number"
                          value={editScores.arrowDash}
                          onChange={(e) => setEditScores(prev => ({ ...prev, arrowDash: parseInt(e.target.value) || 0 }))}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 font-mono text-xl focus:border-[#00ccff] outline-none transition-all"
                        />
                      </div>

                      <button 
                         onClick={async () => {
                           setLoading(true);
                           try {
                             // Update high_scores using upsert
                             await supabase
                               .from('high_scores')
                               .upsert({ 
                                 user_id: selectedUser.id, 
                                 score: editScores.normal,
                                 username: selectedUser.username,
                                 email: selectedUser.email !== 'Nicht hinterlegt' ? selectedUser.email : null
                               }, { onConflict: 'user_id' });
                             
                             // Update arrow_dash_scores using upsert
                             await supabase
                               .from('arrow_dash_scores')
                               .upsert({ 
                                 user_id: selectedUser.id, 
                                 score: editScores.arrowDash,
                                 username: selectedUser.username,
                                 email: selectedUser.email !== 'Nicht hinterlegt' ? selectedUser.email : null
                               }, { onConflict: 'user_id' });
                             
                             alert('Scores erfolgreich aktualisiert!');
                             await fetchUsers();
                             setView('users');
                           } catch (err) {
                             console.error('Update error:', err);
                             alert('Fehler beim Speichern.');
                           } finally {
                             setLoading(false);
                           }
                         }}
                         disabled={loading}
                         className="w-full py-4 bg-[#00ccff] text-black font-black text-lg rounded-xl hover:scale-[1.02] active:scale-95 transition-all shadow-[0_0_20px_rgba(0,204,255,0.3)] disabled:opacity-50"
                      >
                        {loading ? <Loader2 className="animate-spin mx-auto" /> : 'ÄNDERUNGEN SPEICHERN'}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
            <div className="grid gap-4">
              {users.length === 0 ? (
                <div className="text-center py-10 opacity-50 italic">Keine User gefunden.</div>
              ) : (
                users.map((u) => (
                  <motion.div 
                    key={u.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#00ccff]/10 rounded-full flex items-center justify-center border border-[#00ccff]/30 text-[#00ccff]">
                        <User size={20} />
                      </div>
                      <div>
                        <div className="font-bold">{u.username}</div>
                        <div className="text-[10px] text-gray-500 font-mono">{u.id}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-gray-500 uppercase font-black">Bester Score</div>
                      <div className="text-xl font-black text-[#00ccff] font-mono leading-none">{u.bestScore}</div>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedUser(u);
                          setEditScores({ 
                            normal: u.normalScore || 0, 
                            arrowDash: u.dashScore || 0 
                          });
                          setView('user_detail');
                        }}
                        className="mt-2 px-3 py-1 bg-white/10 hover:bg-white/20 text-[10px] font-bold rounded-lg transition-all"
                      >
                        DETAILS & EDIT
                      </button>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-white/10 shrink-0">
          <div className="flex flex-col sm:flex-row items-start gap-3 p-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl">
            <AlertCircle className="text-orange-500 shrink-0 mt-0.5" size={18} />
            <p className="text-xs text-orange-200 leading-relaxed font-medium">
              Hinweis: Das Löschen der Highscores erfolgt sofort. Die eigentliche Account-Löschung aus der Auth-Datenbank muss manuell in der Supabase-Konsole durchgeführt werden (oder via Edge Function), da der Client keinen Zugriff auf Auth-Deletion hat.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
