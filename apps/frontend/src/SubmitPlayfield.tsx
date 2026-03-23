import { useState } from 'react';
import { X, MapPin, Plus, Trash2 } from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import { submitComplex } from './api';
import PhoneInput from './PhoneInput';

const SPORTS = [
  { value: 'futbol', label: 'Fútbol', emoji: '⚽' },
  { value: 'basketball', label: 'Basketball', emoji: '🏀' },
  { value: 'volleyball', label: 'Volleyball', emoji: '🏐' },
  { value: 'tennis', label: 'Tennis', emoji: '🎾' },
  { value: 'other', label: 'Otro', emoji: '🏅' },
];

const AMENITIES = [
  { value: 'lights', label: 'Iluminación' },
  { value: 'parking', label: 'Estacionamiento' },
  { value: 'water', label: 'Agua' },
  { value: 'locker_rooms', label: 'Vestidores' },
  { value: 'bathrooms', label: 'Baños' },
];

interface PlayfieldEntry {
  name: string;
  sports: string[];
  pricePerHour: string;
}

interface Props {
  onClose: () => void;
  defaultLat: number;
  defaultLng: number;
}

function LocationPicker({ position, onPick }: { position: [number, number]; onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return position[0] !== 0 ? <Marker position={position} /> : null;
}

export default function SubmitPlayfield({ onClose, defaultLat, defaultLng }: Props) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState(defaultLat);
  const [lng, setLng] = useState(defaultLng);
  const [type, setType] = useState<'public' | 'private'>('public');
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [ownerPhone, setOwnerPhone] = useState('');
  const [description, setDescription] = useState('');
  const [playfields, setPlayfields] = useState<PlayfieldEntry[]>([
    { name: '', sports: ['futbol'], pricePerHour: '' },
  ]);
  const [countryCode, setCountryCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const toggleAmenity = (value: string) => {
    setSelectedAmenities((prev) =>
      prev.includes(value) ? prev.filter((a) => a !== value) : [...prev, value]
    );
  };

  const updatePlayfield = (index: number, field: 'name' | 'pricePerHour', value: string) => {
    setPlayfields((prev) => prev.map((pf, i) => i === index ? { ...pf, [field]: value } : pf));
  };

  const togglePlayfieldSport = (index: number, sport: string) => {
    setPlayfields((prev) => prev.map((pf, i) => {
      if (i !== index) return pf;
      const has = pf.sports.includes(sport);
      if (has && pf.sports.length === 1) return pf; // must have at least one
      return { ...pf, sports: has ? pf.sports.filter((s) => s !== sport) : [...pf.sports, sport] };
    }));
  };

  const addPlayfield = () => {
    setPlayfields((prev) => [...prev, { name: '', sports: ['futbol'], pricePerHour: '' }]);
  };

  const removePlayfield = (index: number) => {
    if (playfields.length <= 1) return;
    setPlayfields((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lat === 0 && lng === 0) {
      setError('Selecciona la ubicacion del complejo en el mapa');
      return;
    }
    for (const pf of playfields) {
      if (!pf.name || pf.sports.length === 0) {
        setError('Cada cancha debe tener nombre y al menos un deporte');
        return;
      }
    }
    setError('');
    setLoading(true);
    try {
      await submitComplex({
        name,
        address,
        latitude: lat,
        longitude: lng,
        type,
        amenities: selectedAmenities,
        description,
        ownerPhone,
        countryCode: countryCode || undefined,
        playfields: playfields.map((pf) => ({
          name: pf.name,
          sports: pf.sports,
          pricePerHour: pf.pricePerHour ? Number(pf.pricePerHour) : undefined,
        })),
      });
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Error al enviar el complejo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[2000] animate-backdrop-in" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 relative max-h-[90vh] overflow-y-auto animate-modal-in">
        <button onClick={onClose} className="absolute top-4 right-4 p-1 hover:bg-slate-100 rounded-full transition">
          <X size={20} className="text-slate-400" />
        </button>

        {submitted ? (
          <div className="text-center py-8">
            <div className="bg-green-100 p-3 rounded-full inline-flex mb-4">
              <MapPin size={32} className="text-green-600" />
            </div>
            <h2 className="text-xl font-black text-slate-800 mb-2">Complejo Enviado</h2>
            <p className="text-sm text-slate-500 mb-6">
              Tu complejo fue enviado para verificación. Te notificaremos cuando sea aprobado.
            </p>
            <button
              onClick={onClose}
              className="bg-green-600 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-green-700 transition"
            >
              Cerrar
            </button>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-black text-slate-800 mb-1">Registrar Complejo</h2>
            <p className="text-sm text-slate-500 mb-5">Registra tu complejo deportivo y sus canchas</p>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 mb-4">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del complejo</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Ej: Complejo Deportivo El Campeón"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Direccion</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Ej: Av. Principal #123"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono de contacto</label>
                <PhoneInput
                  value={ownerPhone}
                  onChange={setOwnerPhone}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Ubicación (toca el mapa)</label>
                <div className="h-48 rounded-lg overflow-hidden border border-slate-300">
                  <MapContainer
                    center={[lat || 37.7749, lng || -122.4194]}
                    zoom={14}
                    style={{ width: '100%', height: '100%' }}
                    scrollWheelZoom={true}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <LocationPicker
                      position={[lat, lng]}
                      onPick={(newLat, newLng) => {
                        setLat(newLat);
                        setLng(newLng);
                        fetch(`https://nominatim.openstreetmap.org/reverse?lat=${newLat}&lon=${newLng}&format=json&zoom=3`)
                          .then((r) => r.json())
                          .then((data) => { if (data.address?.country_code) setCountryCode(data.address.country_code.toUpperCase()); })
                          .catch(() => {});
                      }}
                    />
                  </MapContainer>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Tipo</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setType('public')}
                    className={`py-2.5 rounded-lg border-2 text-sm font-semibold transition ${
                      type === 'public'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-slate-200 hover:border-slate-300 text-slate-600'
                    }`}
                  >
                    Público
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('private')}
                    className={`py-2.5 rounded-lg border-2 text-sm font-semibold transition ${
                      type === 'private'
                        ? 'border-amber-500 bg-amber-50 text-amber-700'
                        : 'border-slate-200 hover:border-slate-300 text-slate-600'
                    }`}
                  >
                    Privado
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Amenidades</label>
                <div className="flex flex-wrap gap-2">
                  {AMENITIES.map((a) => (
                    <button
                      key={a.value}
                      type="button"
                      onClick={() => toggleAmenity(a.value)}
                      className={`px-3 py-1.5 rounded-full border-2 text-xs font-medium transition ${
                        selectedAmenities.includes(a.value)
                          ? 'border-green-500 bg-green-50 text-green-700'
                          : 'border-slate-200 hover:border-slate-300 text-slate-600'
                      }`}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descripción (opcional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                  rows={2}
                  placeholder="Detalles adicionales sobre el complejo..."
                />
              </div>

              {/* Playfields section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-slate-700">Canchas</label>
                  <button
                    type="button"
                    onClick={addPlayfield}
                    className="text-green-600 hover:text-green-700 text-xs font-semibold flex items-center gap-1"
                  >
                    <Plus size={14} />
                    Agregar cancha
                  </button>
                </div>

                <div className="space-y-3">
                  {playfields.map((pf, index) => (
                    <div key={index} className="border border-slate-200 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-500">Cancha {index + 1}</span>
                        {playfields.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removePlayfield(index)}
                            className="text-red-400 hover:text-red-600 transition"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={pf.name}
                        onChange={(e) => updatePlayfield(index, 'name', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        placeholder="Nombre (ej: Cancha 1)"
                        required
                      />
                      <div className="space-y-2">
                        <label className="text-xs text-slate-500">Deportes</label>
                        <div className="flex flex-wrap gap-1.5">
                          {SPORTS.map((s) => (
                            <button
                              key={s.value}
                              type="button"
                              onClick={() => togglePlayfieldSport(index, s.value)}
                              className={`px-2.5 py-1.5 rounded-lg border-2 text-xs font-medium transition flex items-center gap-1 ${
                                pf.sports.includes(s.value)
                                  ? 'border-green-500 bg-green-50 text-green-700'
                                  : 'border-slate-200 hover:border-slate-300 text-slate-500'
                              }`}
                            >
                              <span>{s.emoji}</span> {s.label}
                            </button>
                          ))}
                        </div>
                        {type === 'private' && (
                          <input
                            type="number"
                            value={pf.pricePerHour}
                            onChange={(e) => updatePlayfield(index, 'pricePerHour', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            placeholder="Precio/hora"
                            min={0}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-green-600 text-white py-2.5 rounded-lg font-bold hover:bg-green-700 transition disabled:opacity-50"
              >
                {loading ? 'Enviando...' : 'Enviar para Verificacion'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
