import { useCallback, useEffect, useState } from 'react';
import { MapPin, Plus, Search } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});
import { useAuth } from './AuthContext';
import Login from './Login';
import CreateGame from './CreateGame';
import AdminPlayfields from './AdminPlayfields';
import SubmitPlayfield from './SubmitPlayfield';
import PlayfieldSchedule from './PlayfieldSchedule';
import OwnerDashboard from './OwnerDashboard';
import NotificationBell from './NotificationBell';
import GameDashboard from './GameDashboard';
import UserMenu from './UserMenu';
import AttendanceModal from './AttendanceModal';
import ReliabilityBadge from './ReliabilityBadge';
import GameChat from './GameChat';
import ChatList from './ChatList';
import { connectSocket, disconnectSocket } from './socket';
import { getIdToken } from './auth';
import { fetchGames, fetchComplexes, fetchMe, fetchMyComplexes, fetchPendingAttendance, joinGame, leaveGame, cancelGame, currencyForCountry, type Game, type Complex, type Playfield } from './api';

const AMENITY_LABELS: Record<string, string> = {
  lights: 'Iluminación',
  parking: 'Estacionamiento',
  water: 'Agua',
  locker_rooms: 'Vestidores',
  bathrooms: 'Baños',
};

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

const blueIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
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
  const [showOwnerDashboard, setShowOwnerDashboard] = useState(false);
  const [showSubmitPlayfield, setShowSubmitPlayfield] = useState(false);
  const [scheduleTarget, setScheduleTarget] = useState<{ complex: Complex; playfield: Playfield } | null>(null);
  const [createGamePlayfield, setCreateGamePlayfield] = useState<{ id: string; name: string; sports: string[] } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [userName, setUserName] = useState('');
  const [games, setGames] = useState<Game[]>([]);
  const [complexes, setComplexes] = useState<Complex[]>([]);
  const [userLocation, setUserLocation] = useState<[number, number]>([0, 0]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [pendingAttendance, setPendingAttendance] = useState<Game[]>([]);
  const [attendanceGame, setAttendanceGame] = useState<Game | null>(null);
  const [showChatList, setShowChatList] = useState(false);
  const [chatTarget, setChatTarget] = useState<{ gameId: string; title: string; sport: string } | null>(null);

  const loadGames = useCallback(() => {
    fetchGames().then(setGames).catch(() => {});
  }, []);

  const loadComplexes = useCallback(() => {
    fetchComplexes().then(setComplexes).catch(() => {});
  }, []);

  useEffect(() => {
    loadGames();
    loadComplexes();
  }, [loadGames, loadComplexes]);

  // Get user's Cognito sub for checking join/leave/cancel
  const [userSub, setUserSub] = useState<string | null>(null);
  useEffect(() => {
    if (isAuthenticated) {
      import('./auth').then(({ getCurrentSession }) =>
        getCurrentSession().then((session) => {
          if (session) setUserSub(session.getIdToken().payload['sub'] as string);
        })
      );
      fetchMe().then((me) => { setIsAdmin(me.isAdmin); setUserName(me.name); }).catch(() => setIsAdmin(false));
      fetchMyComplexes().then((cxs) => setIsOwner(cxs.length > 0)).catch(() => setIsOwner(false));
      fetchPendingAttendance().then(setPendingAttendance).catch(() => {});
      getIdToken().then((token) => { if (token) connectSocket(token); });
    } else {
      setUserSub(null);
      setIsAdmin(false);
      setIsOwner(false);
      setPendingAttendance([]);
      disconnectSocket();
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

      <header className="h-16 bg-white border-b px-6 flex justify-between items-center z-[1000] relative shadow-sm">
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
              <NotificationBell />
              <UserMenu
                email={email || ''}
                userName={userName}
                userSub={userSub}
                isOwner={isOwner}
                isAdmin={isAdmin}
                onShowOwnerDashboard={() => setShowOwnerDashboard(true)}
                onShowAdmin={() => setShowAdmin(true)}
                onShowChats={() => setShowChatList(true)}
                onLogout={logout}
              />
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

          {games.filter((g) => {
            // Show open/full games to everyone
            if (g.status === 'open' || g.status === 'full') return true;
            // Show pending/rejected games only to their creator
            if ((g.status === 'pending_approval' || g.status === 'rejected') && userSub === g.creatorId) return true;
            return false;
          }).map((game) => {
            const isCreator = userSub === game.creatorId;
            const isPlayer = game.players.includes(userSub || '');
            const isFull = game.players.length >= game.maxPlayers;
            const isPending = game.status === 'pending_approval';
            const isRejected = game.status === 'rejected';

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
                    {isPending && (
                      <div className="bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-semibold rounded px-2 py-1 mb-1">
                        Pendiente de aprobación del dueño
                      </div>
                    )}
                    {isRejected && (
                      <div className="bg-red-50 border border-red-200 text-red-700 text-[10px] font-semibold rounded px-2 py-1 mb-1">
                        Rechazado por el dueño
                      </div>
                    )}
                    <p className="text-xs text-slate-500 mb-1">
                      {game.date} — {game.time} a {game.endTime || '?'}
                    </p>
                    {game.complexName && (
                      <p className="text-xs text-blue-600 font-semibold mb-1">
                        {game.complexName}{game.playfieldName ? ` — ${game.playfieldName}` : ''}
                        {game.playfieldId && (
                          <button
                            onClick={() => {
                              const cx = complexes.find((c) => c.id === game.complexId);
                              const pf = cx?.playfields?.find((p) => p.id === game.playfieldId);
                              if (cx && pf) setScheduleTarget({ complex: cx, playfield: pf });
                            }}
                            className="ml-1 text-blue-500 hover:underline"
                          >
                            (ver horario)
                          </button>
                        )}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-xs text-slate-500">
                        Organizador: {game.creatorName}
                      </p>
                      <ReliabilityBadge playerSub={game.creatorId} compact />
                    </div>
                    <p className="text-xs font-semibold mb-2">
                      {game.players.length}/{game.maxPlayers} jugadores
                      {isFull && <span className="text-red-500 ml-1">(Lleno)</span>}
                    </p>
                    {game.description && (
                      <p className="text-xs text-slate-600 mb-2">{game.description}</p>
                    )}

                    {isAuthenticated ? (
                      <div className="flex flex-col gap-1.5">
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
                              className="flex-1 bg-orange-500 text-white text-xs py-1.5 rounded font-semibold hover:bg-orange-600 active:scale-95 transition disabled:opacity-50 disabled:active:scale-100"
                            >
                              {isFull ? 'Lleno' : 'Unirme'}
                            </button>
                          )}
                        </div>
                        {isPlayer && game.status !== 'cancelled' && (
                          <button
                            onClick={() => setChatTarget({ gameId: game.id, title: game.title, sport: game.sport })}
                            className="w-full bg-green-50 text-green-700 text-xs py-1.5 rounded font-semibold hover:bg-green-100 transition border border-green-200"
                          >
                            Chat
                          </button>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowLogin(true)}
                        className="w-full bg-orange-500 text-white text-xs py-1.5 rounded font-semibold hover:bg-orange-600 active:scale-95 transition"
                      >
                        Inicia sesión para unirte
                      </button>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {complexes.map((cx) => (
            <Marker
              key={`cx-${cx.id}`}
              position={[cx.latitude, cx.longitude]}
              icon={blueIcon}
            >
              <Popup minWidth={240}>
                <div className="p-1">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-bold text-sm">{cx.name}</h3>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                      cx.type === 'private' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {cx.type === 'private' ? 'Privado' : 'Publico'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mb-1">{cx.address}</p>
                  {cx.amenities.length > 0 && (
                    <p className="text-xs text-slate-500 mb-1">{cx.amenities.map((a) => AMENITY_LABELS[a] || a).join(', ')}</p>
                  )}
                  {cx.description && (
                    <p className="text-xs text-slate-600 mb-2">{cx.description}</p>
                  )}
                  {cx.playfields && cx.playfields.length > 0 && (
                    <div className="border-t border-slate-100 pt-2 mt-1">
                      <p className="text-xs font-semibold text-slate-700 mb-1">Canchas ({cx.playfields.length})</p>
                      {cx.playfields.map((pf) => (
                        <div key={pf.id} className="flex items-center justify-between text-xs text-slate-600 py-1">
                          <span>{(pf.sports || []).map((s) => SPORT_ICONS[s] || '🏅').join('')} {pf.name}</span>
                          <div className="flex items-center gap-2">
                            {pf.pricePerHour && <span className="text-green-600 font-semibold">{currencyForCountry(cx.countryCode).symbol}{pf.pricePerHour}/hr</span>}
                            <button
                              onClick={() => setScheduleTarget({ complex: cx, playfield: pf })}
                              className="text-blue-600 font-semibold hover:underline"
                            >
                              Ver horario
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        <GameDashboard
          games={games}
          userLocation={userLocation}
          userSub={userSub}
          isAuthenticated={isAuthenticated}
          onJoinGame={handleJoin}
          onLeaveGame={handleLeave}
          onShowLogin={() => setShowLogin(true)}
          actionLoading={actionLoading}
          onOpenChat={(game) => setChatTarget({ gameId: game.id, title: game.title, sport: game.sport })}
        />

        {isAuthenticated && (
          <div className="absolute bottom-8 right-[340px] z-[1000] flex flex-col gap-3 items-end">
            <button
              onClick={() => setShowSubmitPlayfield(true)}
              className="bg-blue-600 text-white p-3 rounded-full shadow-2xl hover:bg-blue-700 hover:scale-110 transition-all active:scale-95 flex items-center gap-2 group"
            >
              <MapPin size={20} />
              <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 ease-in-out font-bold text-sm">
                REGISTRAR COMPLEJO
              </span>
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="bg-orange-500 text-white p-4 rounded-full shadow-2xl hover:bg-orange-600 hover:scale-110 transition-all active:scale-95 flex items-center gap-2 group"
            >
              <Plus size={24} />
              <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 ease-in-out font-bold">
                CREAR JUEGO
              </span>
            </button>
          </div>
        )}
      </main>

      {scheduleTarget && (
        <PlayfieldSchedule
          complex={scheduleTarget.complex}
          playfield={scheduleTarget.playfield}
          onClose={() => setScheduleTarget(null)}
          onCreateGame={(playfieldId) => {
            setCreateGamePlayfield({
              id: playfieldId,
              name: scheduleTarget.playfield.name,
              sports: scheduleTarget.playfield.sports,
            });
            setScheduleTarget(null);
            setShowCreate(true);
          }}
          onJoinGame={async (gameId) => {
            await handleJoin(gameId);
            setScheduleTarget({ ...scheduleTarget });
          }}
          userSub={userSub}
          isAuthenticated={isAuthenticated}
        />
      )}
      {showSubmitPlayfield && (
        <SubmitPlayfield
          onClose={() => setShowSubmitPlayfield(false)}
          defaultLat={userLocation[0]}
          defaultLng={userLocation[1]}
        />
      )}
      {showOwnerDashboard && <OwnerDashboard onClose={() => setShowOwnerDashboard(false)} />}
      {showAdmin && <AdminPlayfields onClose={() => setShowAdmin(false)} />}
      {showLogin && <Login onClose={() => setShowLogin(false)} />}

      {showCreate && (
        <CreateGame
          onClose={() => { setShowCreate(false); setCreateGamePlayfield(null); }}
          onCreated={loadGames}
          defaultLat={userLocation[0]}
          defaultLng={userLocation[1]}
          playfieldId={createGamePlayfield?.id}
          playfieldName={createGamePlayfield?.name}
          playfieldSports={createGamePlayfield?.sports}
        />
      )}

      {attendanceGame && userSub && (
        <AttendanceModal
          game={attendanceGame}
          userSub={userSub}
          onClose={() => setAttendanceGame(null)}
          onSubmitted={() => {
            setAttendanceGame(null);
            setPendingAttendance((prev) => prev.filter((g) => g.id !== attendanceGame.id));
          }}
        />
      )}

      {showChatList && (
        <ChatList
          onClose={() => setShowChatList(false)}
          onOpenChat={(gameId, title, sport) => {
            setShowChatList(false);
            setChatTarget({ gameId, title, sport });
          }}
        />
      )}

      {chatTarget && userSub && (
        <GameChat
          gameId={chatTarget.gameId}
          gameTitle={chatTarget.title}
          gameSport={chatTarget.sport}
          currentUserSub={userSub}
          onClose={() => setChatTarget(null)}
        />
      )}

      {pendingAttendance.length > 0 && !attendanceGame && (
        <div className="fixed bottom-6 left-6 z-[1500] bg-white rounded-xl shadow-xl border border-amber-200 p-4 max-w-sm animate-bounce-slow">
          <p className="text-sm font-bold text-slate-800 mb-1">Tienes juegos por calificar</p>
          <p className="text-xs text-slate-500 mb-3">
            Califica a tus companeros de {pendingAttendance.length} juego{pendingAttendance.length > 1 ? 's' : ''} terminado{pendingAttendance.length > 1 ? 's' : ''}
          </p>
          <button
            onClick={() => setAttendanceGame(pendingAttendance[0])}
            className="w-full bg-amber-500 text-white text-sm font-bold py-2 rounded-lg hover:bg-amber-600 transition"
          >
            Calificar ahora
          </button>
        </div>
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
