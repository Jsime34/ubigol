import { useEffect, useState } from 'react';
import { X, Calendar, Users } from 'lucide-react';
import { fetchPlayfieldGames, currencyForCountry, type Game, type Playfield, type Complex } from './api';

const SPORT_ICONS: Record<string, string> = {
  futbol: '⚽',
  basketball: '🏀',
  volleyball: '🏐',
  tennis: '🎾',
  other: '🏅',
};

interface Props {
  complex: Complex;
  playfield: Playfield;
  onClose: () => void;
  onCreateGame: (playfieldId: string) => void;
  onJoinGame: (gameId: string) => void;
  userSub: string | null;
  isAuthenticated: boolean;
}

export default function PlayfieldSchedule({ complex, playfield, onClose, onCreateGame, onJoinGame, userSub, isAuthenticated }: Props) {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPlayfieldGames(playfield.id)
      .then((g) => {
        const sorted = g.sort((a, b) => {
          const dateA = `${a.date} ${a.time}`;
          const dateB = `${b.date} ${b.time}`;
          return dateA.localeCompare(dateB);
        });
        setGames(sorted);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [playfield.id]);

  const upcoming = games.filter((g) => {
    const gameDate = new Date(`${g.date}T${g.time}`);
    return gameDate >= new Date() && g.status !== 'cancelled';
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[2000] animate-backdrop-in" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 relative max-h-[90vh] overflow-y-auto animate-modal-in">
        <button onClick={onClose} className="absolute top-4 right-4 p-1 hover:bg-slate-100 rounded-full transition">
          <X size={20} className="text-slate-400" />
        </button>

        <div className="mb-4">
          <p className="text-xs text-slate-500">{complex.name}</p>
          <h2 className="text-xl font-black text-slate-800">{(playfield.sports || []).map((s) => SPORT_ICONS[s] || '🏅').join('')} {playfield.name}</h2>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-slate-500">{(playfield.sports || []).join(', ')}</span>
            {playfield.pricePerHour && (
              <span className="text-xs font-semibold text-green-600">{currencyForCountry(complex.countryCode).symbol}{playfield.pricePerHour}/hr</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <Calendar size={16} className="text-slate-400" />
          <span className="text-sm font-semibold text-slate-700">Horario</span>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500 text-center py-8">Cargando...</p>
        ) : upcoming.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-slate-500 mb-4">No hay juegos programados en esta cancha</p>
          </div>
        ) : (
          <div className="space-y-3 mb-4">
            {upcoming.map((game) => {
              const isPlayer = userSub && game.players.includes(userSub);
              const isFull = game.players.length >= game.maxPlayers;

              return (
                <div key={game.id} className="border border-slate-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-bold text-sm text-slate-800">{game.title}</h4>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                      isFull ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {isFull ? 'Lleno' : 'Abierto'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mb-1">
                    {game.date} — {game.time} a {game.endTime || '?'}
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <Users size={12} />
                      <span>{game.players.length}/{game.maxPlayers} jugadores</span>
                    </div>
                    {isAuthenticated && !isPlayer && !isFull && (
                      <button
                        onClick={() => onJoinGame(game.id)}
                        className="bg-green-600 text-white text-xs px-3 py-1 rounded font-semibold hover:bg-green-700 transition"
                      >
                        Unirme
                      </button>
                    )}
                    {isPlayer && (
                      <span className="text-xs text-green-600 font-semibold">Ya inscrito</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {isAuthenticated && (
          <button
            onClick={() => onCreateGame(playfield.id)}
            className="w-full bg-green-600 text-white py-2.5 rounded-lg font-bold hover:bg-green-700 transition"
          >
            Crear juego en esta cancha
          </button>
        )}
      </div>
    </div>
  );
}
