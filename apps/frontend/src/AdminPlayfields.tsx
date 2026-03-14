import { useEffect, useState } from 'react';
import { X, Check, Ban } from 'lucide-react';
import { fetchPendingPlayfields, approvePlayfield, rejectPlayfield, type Playfield } from './api';

interface Props {
  onClose: () => void;
}

export default function AdminPlayfields({ onClose }: Props) {
  const [playfields, setPlayfields] = useState<Playfield[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    fetchPendingPlayfields()
      .then(setPlayfields)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    try {
      await approvePlayfield(id);
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string) => {
    setActionLoading(id);
    try {
      await rejectPlayfield(id, rejectReason);
      setRejectingId(null);
      setRejectReason('');
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[2000]" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 relative max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 p-1 hover:bg-slate-100 rounded-full transition">
          <X size={20} className="text-slate-400" />
        </button>

        <h2 className="text-xl font-black text-slate-800 mb-1">Canchas Pendientes</h2>
        <p className="text-sm text-slate-500 mb-5">Revisa y aprueba o rechaza las canchas enviadas</p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 mb-4">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-slate-500 text-center py-8">Cargando...</p>
        ) : playfields.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-8">No hay canchas pendientes de aprobacion</p>
        ) : (
          <div className="space-y-4">
            {playfields.map((pf) => (
              <div key={pf.id} className="border border-slate-200 rounded-xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-bold text-sm text-slate-800">{pf.name}</h3>
                    <p className="text-xs text-slate-500">{pf.address}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    pf.type === 'private' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {pf.type === 'private' ? 'Privada' : 'Publica'}
                  </span>
                </div>

                <div className="text-xs text-slate-600 space-y-1 mb-3">
                  <p><span className="font-medium">Enviada por:</span> {pf.ownerName} ({pf.ownerEmail})</p>
                  <p><span className="font-medium">Deportes:</span> {pf.sports.join(', ')}</p>
                  {pf.amenities.length > 0 && (
                    <p><span className="font-medium">Amenidades:</span> {pf.amenities.join(', ')}</p>
                  )}
                  {pf.description && (
                    <p><span className="font-medium">Descripcion:</span> {pf.description}</p>
                  )}
                  <p><span className="font-medium">Coordenadas:</span> {pf.latitude.toFixed(5)}, {pf.longitude.toFixed(5)}</p>
                </div>

                {rejectingId === pf.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent resize-none"
                      rows={2}
                      placeholder="Razon del rechazo (opcional)"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleReject(pf.id)}
                        disabled={actionLoading === pf.id}
                        className="flex-1 bg-red-500 text-white text-xs py-1.5 rounded-lg font-semibold hover:bg-red-600 transition disabled:opacity-50"
                      >
                        Confirmar Rechazo
                      </button>
                      <button
                        onClick={() => { setRejectingId(null); setRejectReason(''); }}
                        className="flex-1 bg-slate-200 text-slate-700 text-xs py-1.5 rounded-lg font-semibold hover:bg-slate-300 transition"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(pf.id)}
                      disabled={actionLoading === pf.id}
                      className="flex-1 bg-green-600 text-white text-xs py-1.5 rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-50 flex items-center justify-center gap-1"
                    >
                      <Check size={14} />
                      Aprobar
                    </button>
                    <button
                      onClick={() => setRejectingId(pf.id)}
                      disabled={actionLoading === pf.id}
                      className="flex-1 bg-red-500 text-white text-xs py-1.5 rounded-lg font-semibold hover:bg-red-600 transition disabled:opacity-50 flex items-center justify-center gap-1"
                    >
                      <Ban size={14} />
                      Rechazar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
