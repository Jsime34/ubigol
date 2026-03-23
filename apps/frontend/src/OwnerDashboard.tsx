import { useEffect, useState } from 'react';
import { X, Check, XCircle, Clock, ChevronDown, ChevronUp, Pencil, Trash2, Plus, Save } from 'lucide-react';
import {
  fetchMyComplexes, fetchPendingGames, approveGame, rejectGame,
  updateComplex, updatePlayfield, deletePlayfield, addPlayfield,
  currencyForCountry, type Complex, type Game, type Playfield,
} from './api';

const SPORTS = [
  { value: 'futbol', label: 'Futbol', emoji: '⚽' },
  { value: 'basketball', label: 'Basketball', emoji: '🏀' },
  { value: 'volleyball', label: 'Volleyball', emoji: '🏐' },
  { value: 'tennis', label: 'Tennis', emoji: '🎾' },
  { value: 'other', label: 'Otro', emoji: '🏅' },
];

const SPORT_ICONS: Record<string, string> = {
  futbol: '⚽',
  basketball: '🏀',
  volleyball: '🏐',
  tennis: '🎾',
  other: '🏅',
};

const AMENITIES = [
  { value: 'lights', label: 'Iluminacion' },
  { value: 'parking', label: 'Estacionamiento' },
  { value: 'water', label: 'Agua' },
  { value: 'locker_rooms', label: 'Vestidores' },
  { value: 'bathrooms', label: 'Banos' },
];

interface Props {
  onClose: () => void;
}

export default function OwnerDashboard({ onClose }: Props) {
  const [complexes, setComplexes] = useState<Complex[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingGames, setPendingGames] = useState<Record<string, Game[]>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Edit state
  const [editingComplex, setEditingComplex] = useState<string | null>(null);
  const [editCxForm, setEditCxForm] = useState<{ name: string; address: string; description: string; amenities: string[] }>({ name: '', address: '', description: '', amenities: [] });
  const [editingPlayfield, setEditingPlayfield] = useState<string | null>(null);
  const [editPfForm, setEditPfForm] = useState<{ name: string; sports: string[]; pricePerHour: string }>({ name: '', sports: [], pricePerHour: '' });
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [newPfForm, setNewPfForm] = useState<{ name: string; sports: string[]; pricePerHour: string }>({ name: '', sports: ['futbol'], pricePerHour: '' });
  const [saveLoading, setSaveLoading] = useState(false);

  const reload = () => {
    fetchMyComplexes()
      .then((cxs) => {
        setComplexes(cxs);
        const exp: Record<string, boolean> = {};
        for (const cx of cxs) {
          if (cx.playfields) {
            for (const pf of cx.playfields) {
              exp[pf.id] = true;
              loadPendingGames(pf.id);
            }
          }
        }
        setExpanded(exp);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { reload(); }, []);

  const loadPendingGames = async (playfieldId: string) => {
    try {
      const games = await fetchPendingGames(playfieldId);
      setPendingGames((prev) => ({ ...prev, [playfieldId]: games }));
    } catch {
      setPendingGames((prev) => ({ ...prev, [playfieldId]: [] }));
    }
  };

  const handleApprove = async (playfieldId: string, gameId: string) => {
    setActionLoading(gameId);
    try {
      await approveGame(playfieldId, gameId);
      loadPendingGames(playfieldId);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (playfieldId: string, gameId: string) => {
    if (!confirm('¿Seguro que quieres rechazar este juego?')) return;
    setActionLoading(gameId);
    try {
      await rejectGame(playfieldId, gameId);
      loadPendingGames(playfieldId);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const toggleExpand = (pfId: string) => {
    setExpanded((prev) => ({ ...prev, [pfId]: !prev[pfId] }));
  };

  // Complex edit
  const startEditComplex = (cx: Complex) => {
    setEditingComplex(cx.id);
    setEditCxForm({ name: cx.name, address: cx.address, description: cx.description || '', amenities: cx.amenities || [] });
  };

  const saveComplex = async (complexId: string) => {
    setSaveLoading(true);
    try {
      await updateComplex(complexId, editCxForm);
      setEditingComplex(null);
      reload();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaveLoading(false);
    }
  };

  // Playfield edit
  const startEditPlayfield = (pf: Playfield) => {
    setEditingPlayfield(pf.id);
    setEditPfForm({
      name: pf.name,
      sports: pf.sports || [],
      pricePerHour: pf.pricePerHour != null ? String(pf.pricePerHour) : '',
    });
  };

  const savePlayfield = async (complexId: string, pfId: string) => {
    if (!editPfForm.name || editPfForm.sports.length === 0) {
      alert('Nombre y al menos un deporte son requeridos');
      return;
    }
    setSaveLoading(true);
    try {
      await updatePlayfield(complexId, pfId, {
        name: editPfForm.name,
        sports: editPfForm.sports,
        pricePerHour: editPfForm.pricePerHour ? Number(editPfForm.pricePerHour) : null,
      });
      setEditingPlayfield(null);
      reload();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDeletePlayfield = async (complexId: string, pfId: string) => {
    if (!confirm('¿Seguro que quieres eliminar esta cancha? Los juegos vinculados no se eliminaran.')) return;
    setSaveLoading(true);
    try {
      await deletePlayfield(complexId, pfId);
      reload();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaveLoading(false);
    }
  };

  // Add playfield
  const startAddPlayfield = (complexId: string) => {
    setAddingTo(complexId);
    setNewPfForm({ name: '', sports: ['futbol'], pricePerHour: '' });
  };

  const saveNewPlayfield = async (complexId: string) => {
    if (!newPfForm.name || newPfForm.sports.length === 0) {
      alert('Nombre y al menos un deporte son requeridos');
      return;
    }
    setSaveLoading(true);
    try {
      await addPlayfield(complexId, {
        name: newPfForm.name,
        sports: newPfForm.sports,
        pricePerHour: newPfForm.pricePerHour ? Number(newPfForm.pricePerHour) : undefined,
      });
      setAddingTo(null);
      reload();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaveLoading(false);
    }
  };

  const toggleSport = (current: string[], sport: string): string[] => {
    const has = current.includes(sport);
    if (has && current.length === 1) return current;
    return has ? current.filter((s) => s !== sport) : [...current, sport];
  };

  const totalPending = Object.values(pendingGames).reduce((sum, games) => sum + games.length, 0);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[2000] animate-backdrop-in" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 relative max-h-[90vh] overflow-y-auto animate-modal-in">
        <button onClick={onClose} className="absolute top-4 right-4 p-1 hover:bg-slate-100 rounded-full transition">
          <X size={20} className="text-slate-400" />
        </button>

        <h2 className="text-xl font-black text-slate-800 mb-1">Mis Complejos</h2>
        <p className="text-sm text-slate-500 mb-4">
          {totalPending > 0
            ? `${totalPending} juego${totalPending > 1 ? 's' : ''} pendiente${totalPending > 1 ? 's' : ''} de aprobacion`
            : 'No hay juegos pendientes'}
        </p>

        {loading ? (
          <p className="text-sm text-slate-500 text-center py-8">Cargando...</p>
        ) : complexes.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-8">No tienes complejos registrados</p>
        ) : (
          <div className="space-y-4">
            {complexes.map((cx) => {
              const currency = currencyForCountry(cx.countryCode);
              const isEditingCx = editingComplex === cx.id;

              return (
                <div key={cx.id} className="border border-slate-200 rounded-lg overflow-hidden">
                  {/* Complex header */}
                  <div className="px-4 py-3 bg-slate-50">
                    {isEditingCx ? (
                      <div className="space-y-2">
                        <input
                          value={editCxForm.name}
                          onChange={(e) => setEditCxForm((f) => ({ ...f, name: e.target.value }))}
                          className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                          placeholder="Nombre"
                        />
                        <input
                          value={editCxForm.address}
                          onChange={(e) => setEditCxForm((f) => ({ ...f, address: e.target.value }))}
                          className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                          placeholder="Direccion"
                        />
                        <textarea
                          value={editCxForm.description}
                          onChange={(e) => setEditCxForm((f) => ({ ...f, description: e.target.value }))}
                          className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                          rows={2}
                          placeholder="Descripcion"
                        />
                        <div className="flex flex-wrap gap-1.5">
                          {AMENITIES.map((a) => (
                            <button
                              key={a.value}
                              type="button"
                              onClick={() => setEditCxForm((f) => ({
                                ...f,
                                amenities: f.amenities.includes(a.value)
                                  ? f.amenities.filter((v) => v !== a.value)
                                  : [...f.amenities, a.value],
                              }))}
                              className={`px-2 py-1 rounded-full border text-[10px] font-medium transition ${
                                editCxForm.amenities.includes(a.value)
                                  ? 'border-green-500 bg-green-50 text-green-700'
                                  : 'border-slate-200 text-slate-500'
                              }`}
                            >
                              {a.label}
                            </button>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => saveComplex(cx.id)}
                            disabled={saveLoading}
                            className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                          >
                            <Save size={12} /> Guardar
                          </button>
                          <button
                            onClick={() => setEditingComplex(null)}
                            className="px-3 py-1.5 bg-slate-200 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-300 transition"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between">
                          <h3 className="font-bold text-sm text-slate-800">{cx.name}</h3>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => startEditComplex(cx)}
                              className="p-1 hover:bg-slate-200 rounded transition"
                              title="Editar complejo"
                            >
                              <Pencil size={13} className="text-slate-400" />
                            </button>
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                              cx.type === 'private' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                            }`}>
                              {cx.type === 'private' ? 'Privado' : 'Publico'}
                            </span>
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                              cx.verificationStatus === 'approved' ? 'bg-green-100 text-green-700'
                              : cx.verificationStatus === 'pending' ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-red-100 text-red-700'
                            }`}>
                              {cx.verificationStatus === 'approved' ? 'Aprobado'
                              : cx.verificationStatus === 'pending' ? 'Pendiente'
                              : 'Rechazado'}
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{cx.address}</p>
                        {cx.description && <p className="text-xs text-slate-400 mt-0.5">{cx.description}</p>}
                      </>
                    )}
                  </div>

                  {/* Playfields */}
                  {cx.playfields && cx.playfields.length > 0 && (
                    <div className="divide-y divide-slate-100">
                      {cx.playfields.map((pf) => {
                        const games = pendingGames[pf.id] || [];
                        const isExpanded = expanded[pf.id];
                        const isEditingPf = editingPlayfield === pf.id;

                        return (
                          <div key={pf.id}>
                            {isEditingPf ? (
                              <div className="px-4 py-3 bg-blue-50/50 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-semibold text-slate-500">Editando cancha</span>
                                </div>
                                <input
                                  value={editPfForm.name}
                                  onChange={(e) => setEditPfForm((f) => ({ ...f, name: e.target.value }))}
                                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                                  placeholder="Nombre"
                                />
                                <div>
                                  <label className="text-xs text-slate-500">Deportes</label>
                                  <div className="flex flex-wrap gap-1.5 mt-1">
                                    {SPORTS.map((s) => (
                                      <button
                                        key={s.value}
                                        type="button"
                                        onClick={() => setEditPfForm((f) => ({ ...f, sports: toggleSport(f.sports, s.value) }))}
                                        className={`px-2 py-1 rounded-lg border text-[10px] font-medium transition flex items-center gap-1 ${
                                          editPfForm.sports.includes(s.value)
                                            ? 'border-green-500 bg-green-50 text-green-700'
                                            : 'border-slate-200 text-slate-500'
                                        }`}
                                      >
                                        {s.emoji} {s.label}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                {cx.type === 'private' && (
                                  <div>
                                    <label className="text-xs text-slate-500">Precio/hora ({currency.code})</label>
                                    <input
                                      type="number"
                                      value={editPfForm.pricePerHour}
                                      onChange={(e) => setEditPfForm((f) => ({ ...f, pricePerHour: e.target.value }))}
                                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 mt-1"
                                      placeholder={`${currency.symbol}0`}
                                      min={0}
                                    />
                                  </div>
                                )}
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => savePlayfield(cx.id, pf.id)}
                                    disabled={saveLoading}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                                  >
                                    <Save size={12} /> Guardar
                                  </button>
                                  <button
                                    onClick={() => setEditingPlayfield(null)}
                                    className="px-3 py-1.5 bg-slate-200 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-300 transition"
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition">
                                  <button
                                    onClick={() => toggleExpand(pf.id)}
                                    className="flex items-center gap-2 flex-1 text-left"
                                  >
                                    <span className="text-sm">{(pf.sports || []).map((s) => SPORT_ICONS[s] || '🏅').join('')}</span>
                                    <span className="text-sm font-medium text-slate-700">{pf.name}</span>
                                    {pf.pricePerHour != null && (
                                      <span className="text-[10px] text-green-600 font-semibold">{currency.symbol}{pf.pricePerHour}/hr</span>
                                    )}
                                    {games.length > 0 && (
                                      <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                        {games.length}
                                      </span>
                                    )}
                                  </button>
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => startEditPlayfield(pf)}
                                      className="p-1 hover:bg-slate-200 rounded transition"
                                      title="Editar cancha"
                                    >
                                      <Pencil size={12} className="text-slate-400" />
                                    </button>
                                    <button
                                      onClick={() => handleDeletePlayfield(cx.id, pf.id)}
                                      className="p-1 hover:bg-red-100 rounded transition"
                                      title="Eliminar cancha"
                                    >
                                      <Trash2 size={12} className="text-red-400" />
                                    </button>
                                    <button onClick={() => toggleExpand(pf.id)} className="p-1">
                                      {isExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                                    </button>
                                  </div>
                                </div>

                                {isExpanded && (
                                  <div className="px-4 pb-3">
                                    {games.length === 0 ? (
                                      <p className="text-xs text-slate-400 py-2">Sin solicitudes pendientes</p>
                                    ) : (
                                      <div className="space-y-2">
                                        {games.map((game) => (
                                          <div key={game.id} className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                                            <div className="flex items-start justify-between mb-1">
                                              <div>
                                                <h4 className="font-bold text-sm text-slate-800">{game.title}</h4>
                                                <p className="text-xs text-slate-500">
                                                  {game.date} — {game.time} a {game.endTime || '?'}
                                                </p>
                                              </div>
                                              <div className="flex items-center gap-1 text-amber-600">
                                                <Clock size={12} />
                                                <span className="text-[10px] font-semibold">Pendiente</span>
                                              </div>
                                            </div>
                                            <p className="text-xs text-slate-500 mb-1">
                                              Organizador: {game.creatorName}
                                            </p>
                                            <p className="text-xs text-slate-500 mb-2">
                                              {game.players.length}/{game.maxPlayers} jugadores
                                            </p>
                                            {game.description && (
                                              <p className="text-xs text-slate-600 mb-2">{game.description}</p>
                                            )}
                                            <div className="flex gap-2">
                                              <button
                                                onClick={() => handleApprove(pf.id, game.id)}
                                                disabled={actionLoading === game.id}
                                                className="flex-1 flex items-center justify-center gap-1 bg-green-600 text-white text-xs py-1.5 rounded font-semibold hover:bg-green-700 transition disabled:opacity-50"
                                              >
                                                <Check size={14} />
                                                Aprobar
                                              </button>
                                              <button
                                                onClick={() => handleReject(pf.id, game.id)}
                                                disabled={actionLoading === game.id}
                                                className="flex-1 flex items-center justify-center gap-1 bg-red-500 text-white text-xs py-1.5 rounded font-semibold hover:bg-red-600 transition disabled:opacity-50"
                                              >
                                                <XCircle size={14} />
                                                Rechazar
                                              </button>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Add playfield form */}
                  {addingTo === cx.id ? (
                    <div className="px-4 py-3 bg-green-50/50 border-t border-slate-200 space-y-2">
                      <span className="text-xs font-semibold text-green-700">Nueva cancha</span>
                      <input
                        value={newPfForm.name}
                        onChange={(e) => setNewPfForm((f) => ({ ...f, name: e.target.value }))}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                        placeholder="Nombre (ej: Cancha 3)"
                      />
                      <div>
                        <label className="text-xs text-slate-500">Deportes</label>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {SPORTS.map((s) => (
                            <button
                              key={s.value}
                              type="button"
                              onClick={() => setNewPfForm((f) => ({ ...f, sports: toggleSport(f.sports, s.value) }))}
                              className={`px-2 py-1 rounded-lg border text-[10px] font-medium transition flex items-center gap-1 ${
                                newPfForm.sports.includes(s.value)
                                  ? 'border-green-500 bg-green-50 text-green-700'
                                  : 'border-slate-200 text-slate-500'
                              }`}
                            >
                              {s.emoji} {s.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      {cx.type === 'private' && (
                        <input
                          type="number"
                          value={newPfForm.pricePerHour}
                          onChange={(e) => setNewPfForm((f) => ({ ...f, pricePerHour: e.target.value }))}
                          className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                          placeholder={`Precio/hora (${currency.symbol})`}
                          min={0}
                        />
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveNewPlayfield(cx.id)}
                          disabled={saveLoading}
                          className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                        >
                          <Save size={12} /> Agregar
                        </button>
                        <button
                          onClick={() => setAddingTo(null)}
                          className="px-3 py-1.5 bg-slate-200 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-300 transition"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => startAddPlayfield(cx.id)}
                      className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 text-green-600 hover:bg-green-50 transition border-t border-slate-200 text-xs font-semibold"
                    >
                      <Plus size={14} />
                      Agregar cancha
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
