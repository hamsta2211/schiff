import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { supabase } from '../lib/supabase';
import { Shield, Trash2, User, Mail, Clock, CheckCircle, AlertCircle, Loader2, X } from 'lucide-react';

export function AdminPanel({ onClose }: { onClose: () => void }) {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchRequests();

    // Real-time subscription für neue Löschungsanfragen
    const channel = supabase
      .channel('deletion_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deletion_requests' }, () => {
        fetchRequests();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-[#ff0055] w-12 h-12" />
          </div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center opacity-50">
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
                className="p-6 bg-white/5 border border-white/10 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-6"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <User size={18} className="text-[#00ccff]" />
                    <span className="font-bold text-lg">{req.username || 'Anonym'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-400">
                    <Mail size={16} />
                    <span className="text-sm">{req.email}</span>
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
        )}
      </div>

      <div className="mt-8 pt-6 border-t border-white/10 shrink-0">
        <div className="flex items-start gap-3 p-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl">
          <AlertCircle className="text-orange-500 shrink-0 mt-0.5" size={18} />
          <p className="text-xs text-orange-200 leading-relaxed font-medium">
            Hinweis: Das Löschen der Highscores erfolgt sofort. Die eigentliche Account-Löschung aus der Auth-Datenbank muss manuell in der Supabase-Konsole durchgeführt werden (oder via Edge Function), da der Client keinen Zugriff auf Auth-Deletion hat.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
