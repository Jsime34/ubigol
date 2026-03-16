import { useEffect, useState } from 'react';
import { X, MapPin, ChevronLeft, Search } from 'lucide-react';
import { createGame, fetchComplexes, currencyForCountry, type Complex, type Playfield } from './api';

const SPORTS = [
  { value: 'futbol', label: 'Fútbol', emoji: '⚽' },
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

interface Props {
  onClose: () => void;
  onCreated: () => void;
  defaultLat: number;
  defaultLng: number;
  playfieldId?: string;
  playfieldName?: string;
  playfieldSports?: string[];
}

type Step = 'choose-location' | 'game-details';

interface SelectedPlayfield {
  id: string;
  name: string;
  sports: string[];
  complexName: string;
  complexType: 'public' | 'private';
}

export default function CreateGame({ onClose, onCreated, defaultLat, defaultLng, playfieldId, playfieldName, playfieldSports }: Props) {
  // If playfieldId is pre-set (coming from schedule), skip to game details
  const [step, setStep] = useState<Step>(playfieldId ? 'game-details' : 'choose-location');
  const [selected, setSelected] = useState<SelectedPlayfield | null>(
    playfieldId ? { id: playfieldId, name: playfieldName || '', sports: playfieldSports || [], complexName: '', complexType: 'public' } : null
  );

  // Location step state
  const [complexes, setComplexes] = useState<Complex[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingComplexes, setLoadingComplexes] = useState(true);

  // Game details state
  const [sport, setSport] = useState(playfieldSports?.[0] || 'futbol');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(10);
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (step === 'choose-location') {
      fetchComplexes()
        .then(setComplexes)
        .catch(() => {})
        .finally(() => setLoadingComplexes(false));
    }
  }, [step]);

  const handleSelectPlayfield = (cx: Complex, pf: Playfield) => {
    setSelected({
      id: pf.id,
      name: pf.name,
      sports: pf.sports,
      complexName: cx.name,
      complexType: cx.type,
    });
    setSport(pf.sports[0] || 'futbol');
    setStep('game-details');
  };

  const handleUseMyLocation = () => {
    setSelected(null);
    setStep('game-details');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await createGame({
        sport,
        title,
        latitude: defaultLat,
        longitude: defaultLng,
        date,
        time,
        endTime,
        maxPlayers,
        description,
        ...(selected ? { playfieldId: selected.id } : {}),
      });
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al crear el juego');
    } finally {
      setLoading(false);
    }
  };

  const filtered = searchQuery
    ? complexes.filter((cx) =>
        cx.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cx.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cx.playfields?.some((pf) => pf.name.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : complexes;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[2000]" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 relative max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 p-1 hover:bg-slate-100 rounded-full transition">
          <X size={20} className="text-slate-400" />
        </button>

        {step === 'choose-location' && (
          <>
            <h2 className="text-xl font-black text-slate-800 mb-1">Crear Juego</h2>
            <p className="text-sm text-slate-500 mb-4">Elige donde jugar</p>

            {/* Search */}
            <div className="relative mb-4">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Buscar complejo o cancha..."
              />
            </div>

            {/* Use my location option */}
            <button
              onClick={handleUseMyLocation}
              className="w-full flex items-center gap-3 p-3 border-2 border-dashed border-slate-300 rounded-lg hover:border-green-400 hover:bg-green-50 transition mb-4"
            >
              <div className="bg-slate-100 p-2 rounded-full">
                <MapPin size={18} className="text-slate-500" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-slate-700">Usar mi ubicación actual</p>
                <p className="text-xs text-slate-500">Juego sin cancha registrada</p>
              </div>
            </button>

            {/* Complexes list */}
            {loadingComplexes ? (
              <p className="text-sm text-slate-500 text-center py-6">Cargando complejos...</p>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-6">No se encontraron complejos</p>
            ) : (
              <div className="space-y-3">
                {filtered.map((cx) => (
                  <div key={cx.id} className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="px-3 py-2 bg-slate-50 flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-slate-800">{cx.name}</h4>
                        <p className="text-xs text-slate-500">{cx.address}</p>
                      </div>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                        cx.type === 'private' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {cx.type === 'private' ? 'Privado' : 'Público'}
                      </span>
                    </div>
                    {cx.playfields && cx.playfields.length > 0 && (
                      <div className="divide-y divide-slate-100">
                        {cx.playfields.map((pf) => (
                          <button
                            key={pf.id}
                            onClick={() => handleSelectPlayfield(cx, pf)}
                            className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-green-50 transition text-left"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm">{(pf.sports || []).map((s) => SPORT_ICONS[s] || '🏅').join('')}</span>
                              <span className="text-sm text-slate-700">{pf.name}</span>
                            </div>
                            {pf.pricePerHour && (
                              <span className="text-xs font-semibold text-green-600">{currencyForCountry(cx.countryCode).symbol}{pf.pricePerHour}/hr</span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {step === 'game-details' && (
          <>
            {/* Back button if not pre-set */}
            {!playfieldId && (
              <button
                onClick={() => { setStep('choose-location'); setSelected(null); setError(''); }}
                className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition mb-3"
              >
                <ChevronLeft size={16} />
                Cambiar ubicación
              </button>
            )}

            <h2 className="text-xl font-black text-slate-800 mb-1">Crear Juego</h2>
            <p className="text-sm text-slate-500 mb-1">
              {selected ? `En: ${selected.complexName ? `${selected.complexName} — ` : ''}${selected.name}` : 'En tu ubicación actual'}
            </p>

            {/* Private field notice */}
            {selected?.complexType === 'private' && (
              <div className="bg-amber-50 border border-amber-200 text-amber-700 text-xs rounded-lg p-3 mb-4">
                Esta cancha es privada. Tu juego necesitará aprobación del dueño antes de aparecer en el mapa.
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 mb-4">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Sport selector — scoped to playfield's sports if selected */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Deporte</label>
                <div className="grid grid-cols-5 gap-2">
                  {(selected ? SPORTS.filter((s) => selected.sports.includes(s.value)) : SPORTS).map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setSport(s.value)}
                      className={`flex flex-col items-center p-2 rounded-lg border-2 transition text-xs font-medium ${
                        sport === s.value
                          ? 'border-green-500 bg-green-50 text-green-700'
                          : 'border-slate-200 hover:border-slate-300 text-slate-600'
                      }`}
                    >
                      <span className="text-xl mb-1">{s.emoji}</span>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Título</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Ej: Partidito en el parque"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Fecha</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Hora inicio</label>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Hora fin</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    min={time || undefined}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Máximo de jugadores</label>
                <input
                  type="number"
                  value={maxPlayers}
                  onChange={(e) => setMaxPlayers(Number(e.target.value))}
                  min={2}
                  max={50}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descripción (opcional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                  rows={2}
                  placeholder="Detalles adicionales..."
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-green-600 text-white py-2.5 rounded-lg font-bold hover:bg-green-700 transition disabled:opacity-50"
              >
                {loading ? 'Creando...' : 'Crear Juego'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
