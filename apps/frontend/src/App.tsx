import { useCallback, useEffect, useState } from 'react';
import { LogOut, Plus, Search, Shield, User } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useAuth } from './AuthContext';
import Login from './Login';
import CreateGame from './CreateGame';
import AdminPlayfields from './AdminPlayfields';
import { fetchGames, fetchMe, joinGame, leaveGame, cancelGame, type Game } from './api';

const SPORT_ICONS: Record<string, string> = {
  futbol: '⚽',
  basketball: '🏀',
  volleyball: '🏐',
  tennis: '🎾',
  other: '🏅',
};

const greenIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function App() {
  const { isAuthenticated, email, logout } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [games, setGames] = useState<Game[]>([]);
  const [userLocation, setUserLocation] = useState<[number, number]>([0, 0]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadGames = useCallback(() => {
    fetchGames().then(setGames).catch(() => {});
  }, []);

  useEffect(() => {
    loadGames();
  }, [loadGames]);

  // Get user's Cognito sub for checking join/leave/cancel
  const [userSub, setUserSub] = useState<string | null>(null);
  useEffect(() => {
    if (isAuthenticated) {
      import('./auth').then(({ getCurrentSession }) =>
        getCurrentSession().then((session) => {
          if (session) setUserSub(session.getIdToken().payload['sub'] as string);
        })
      );
      fetchMe().then((me) => setIsAdmin(me.isAdmin)).catch(() => setIsAdmin(false));
    } else {
      setUserSub(null);
      setIsAdmin(false);
    }
  }, [isAuthenticated]);

  const handleJoin = async (gameId: string) => {
    if (!isAuthenticated) { setShowLogin(true); return; }
    setActionLoading(gameId);
    try {
      await joinGame(gameId);
      loadGames();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleLeave = async (gameId: string) => {
    setActionLoading(gameId);
    try {
      await leaveGame(gameId);
      loadGames();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (gameId: string) => {
    if (!confirm('¿Seguro que quieres cancelar este juego?')) return;
    setActionLoading(gameId);
    try {
      await cancelGame(gameId);
      loadGames();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">

      <header className="h-16 bg-white border-b px-6 flex justify-between items-center z-20 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="bg-green-600 p-1.5 rounded-lg text-white">
            <SoccerBall size={24} />
          </div>
          <span className="text-2xl font-black tracking-tighter text-slate-800">
            UBI<span className="text-green-600">GOL</span>
          </span>
        </div>

        <div className="flex items-center gap-4">
          <button className="p-2 hover:bg-slate-100 rounded-full transition">
            <Search size={20} className="text-slate-600" />
          </button>
          {isAuthenticated ? (
            <div className="flex items-center gap-2">
              {isAdmin && (
                <button onClick={() => setShowAdmin(true)} className="p-2 hover:bg-amber-50 rounded-full transition" title="Panel de administracion">
                  <Shield size={18} className="text-amber-600" />
                </button>
              )}
              <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center border border-green-300 cursor-pointer" title={email || ''}>
                <User size={18} className="text-green-600" />
              </div>
              <button onClick={logout} className="p-2 hover:bg-red-50 rounded-full transition" title="Cerrar sesión">
                <LogOut size={18} className="text-slate-500 hover:text-red-500" />
              </button>
            </div>
          ) : (
            <button onClick={() => setShowLogin(true)} className="bg-green-600 text-white px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-green-700 transition">
              Iniciar Sesión
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 relative">
        <MapContainer
          center={[37.7749, -122.4194]}
          zoom={12}
          style={{ width: '100%', height: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <LocateUser onLocated={setUserLocation} />

          {games.map((game) => {
            const isCreator = userSub === game.creatorId;
            const isPlayer = game.players.includes(userSub || '');
            const isFull = game.players.length >= game.maxPlayers;

            return (
              <Marker
                key={game.id}
                position={[game.latitude, game.longitude]}
                icon={greenIcon}
              >
                <Popup minWidth={220}>
                  <div className="p-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{SPORT_ICONS[game.sport] || '🏅'}</span>
                      <h3 className="font-bold text-sm">{game.title}</h3>
                    </div>
                    <p className="text-xs text-slate-500 mb-1">
                      {game.date} a las {game.time}
                    </p>
                    <p className="text-xs text-slate-500 mb-1">
                      Organizador: {game.creatorName}
                    </p>
                    <p className="text-xs font-semibold mb-2">
                      {game.players.length}/{game.maxPlayers} jugadores
                      {isFull && <span className="text-red-500 ml-1">(Lleno)</span>}
                    </p>
                    {game.description && (
                      <p className="text-xs text-slate-600 mb-2">{game.description}</p>
                    )}

                    {isAuthenticated ? (
                      <div className="flex gap-2">
                        {isCreator ? (
                          <button
                            onClick={() => handleCancel(game.id)}
                            disabled={actionLoading === game.id}
                            className="flex-1 bg-red-500 text-white text-xs py-1.5 rounded font-semibold hover:bg-red-600 transition disabled:opacity-50"
                          >
                            Cancelar Juego
                          </button>
                        ) : isPlayer ? (
                          <button
                            onClick={() => handleLeave(game.id)}
                            disabled={actionLoading === game.id}
                            className="flex-1 bg-slate-200 text-slate-700 text-xs py-1.5 rounded font-semibold hover:bg-slate-300 transition disabled:opacity-50"
                          >
                            Salir
                          </button>
                        ) : (
                          <button
                            onClick={() => handleJoin(game.id)}
                            disabled={actionLoading === game.id || isFull}
                            className="flex-1 bg-green-600 text-white text-xs py-1.5 rounded font-semibold hover:bg-green-700 transition disabled:opacity-50"
                          >
                            {isFull ? 'Lleno' : 'Unirme'}
                          </button>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowLogin(true)}
                        className="w-full bg-green-600 text-white text-xs py-1.5 rounded font-semibold hover:bg-green-700 transition"
                      >
                        Inicia sesión para unirte
                      </button>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>

        {isAuthenticated && (
          <button
            onClick={() => setShowCreate(true)}
            className="absolute bottom-8 right-8 bg-green-600 text-white p-4 rounded-full shadow-2xl hover:bg-green-700 hover:scale-110 transition-all active:scale-95 z-[1000] flex items-center gap-2 group"
          >
            <Plus size={24} />
            <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 ease-in-out font-bold">
              CREAR JUEGO
            </span>
          </button>
        )}
      </main>

      {showAdmin && <AdminPlayfields onClose={() => setShowAdmin(false)} />}
      {showLogin && <Login onClose={() => setShowLogin(false)} />}

      {showCreate && (
        <CreateGame
          onClose={() => setShowCreate(false)}
          onCreated={loadGames}
          defaultLat={userLocation[0]}
          defaultLng={userLocation[1]}
        />
      )}
    </div>
  );
}

function LocateUser({ onLocated }: { onLocated: (pos: [number, number]) => void }) {
  const map = useMap();
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        map.flyTo(coords, 14, { duration: 1.5 });
        onLocated(coords);
      },
      () => {}
    );
  }, [map, onLocated]);
  return null;
}

function SoccerBall({ size }: { size: number }) {
  return <span style={{ fontSize: size }}>⚽</span>;
}

export default App;
