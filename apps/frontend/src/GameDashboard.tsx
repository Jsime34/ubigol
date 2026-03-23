import { useState, useMemo } from 'react';
import { ChevronRight, ChevronLeft, Clock, MapPin, Users, MessageCircle } from 'lucide-react';
import type { Game } from './api';
import ReliabilityBadge from './ReliabilityBadge';

const SPORT_ICONS: Record<string, string> = {
  futbol: '⚽',
  basketball: '🏀',
  volleyball: '🏐',
  tennis: '🎾',
  other: '🏅',
};

const RADIUS_OPTIONS = [5, 10, 20, 50] as const;

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface GameDashboardProps {
  games: Game[];
  userLocation: [number, number];
  userSub: string | null;
  isAuthenticated: boolean;
  onJoinGame: (gameId: string) => void;
  onLeaveGame: (gameId: string) => void;
  onShowLogin: () => void;
  actionLoading: string | null;
  onOpenChat?: (game: Game) => void;
}

export default function GameDashboard({
  games,
  userLocation,
  userSub,
  isAuthenticated,
  onJoinGame,
  onLeaveGame,
  onShowLogin,
  actionLoading,
  onOpenChat,
}: GameDashboardProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [radiusKm, setRadiusKm] = useState(10);

  const locationReady = userLocation[0] !== 0 || userLocation[1] !== 0;

  const { currentGames, upcomingGames } = useMemo(() => {
    if (!locationReady) return { currentGames: [], upcomingGames: [] };

    const now = new Date();

    const visible = games.filter((g) => {
      if (g.status === 'open' || g.status === 'full') return true;
      if (
        (g.status === 'pending_approval' || g.status === 'rejected') &&
        userSub === g.creatorId
      )
        return true;
      return false;
    });

    const inRadius = visible.filter(
      (g) =>
        haversineKm(userLocation[0], userLocation[1], g.latitude, g.longitude) <= radiusKm,
    );

    const current: (Game & { distance: number })[] = [];
    const upcoming: (Game & { distance: number })[] = [];

    for (const game of inRadius) {
      const start = new Date(`${game.date}T${game.time}`);
      const end = new Date(`${game.date}T${game.endTime}`);
      const distance = haversineKm(userLocation[0], userLocation[1], game.latitude, game.longitude);

      if (now >= start && now <= end) {
        current.push({ ...game, distance });
      } else if (start > now) {
        upcoming.push({ ...game, distance });
      }
    }

    current.sort((a, b) => {
      const endA = new Date(`${a.date}T${a.endTime}`).getTime();
      const endB = new Date(`${b.date}T${b.endTime}`).getTime();
      return endA - endB;
    });

    upcoming.sort((a, b) => {
      const startA = new Date(`${a.date}T${a.time}`).getTime();
      const startB = new Date(`${b.date}T${b.time}`).getTime();
      return startA - startB;
    });

    return { currentGames: current, upcomingGames: upcoming };
  }, [games, userLocation, locationReady, radiusKm, userSub]);

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="absolute top-4 right-4 z-[500] bg-white/95 backdrop-blur shadow-lg border border-slate-200 rounded-lg p-2 hover:bg-slate-50 transition"
      >
        <ChevronLeft size={20} className="text-slate-600" />
      </button>
    );
  }

  return (
    <div className="absolute top-0 right-0 bottom-0 w-80 z-[500] flex flex-col bg-white/95 backdrop-blur border-l border-slate-200 shadow-lg">
      {/* Header */}
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-slate-800">Juegos Cerca</h2>
          <button
            onClick={() => setCollapsed(true)}
            className="p-1 hover:bg-slate-100 rounded transition"
          >
            <ChevronRight size={18} className="text-slate-500" />
          </button>
        </div>

        {/* Radius selector */}
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {RADIUS_OPTIONS.map((km) => (
            <button
              key={km}
              onClick={() => setRadiusKm(km)}
              className={`flex-1 text-xs font-semibold py-1.5 rounded-md transition ${
                radiusKm === km
                  ? 'bg-white text-green-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {km} km
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {!locationReady ? (
          <div className="p-6 text-center text-sm text-slate-400">
            <MapPin size={24} className="mx-auto mb-2 text-slate-300" />
            Obteniendo tu ubicacion...
          </div>
        ) : (
          <>
            {/* Current Games */}
            <div className="p-4 pb-2">
              <div className="flex items-center gap-2 mb-3">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
                </span>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                  Ahora
                </h3>
                <span className="text-xs text-slate-400">({currentGames.length})</span>
              </div>

              {currentGames.length === 0 ? (
                <p className="text-xs text-slate-400 pb-2">
                  No hay juegos en curso cerca de ti
                </p>
              ) : (
                <div className="space-y-2">
                  {currentGames.map((game) => (
                    <GameCard
                      key={game.id}
                      game={game}
                      distance={game.distance}
                      userSub={userSub}
                      isAuthenticated={isAuthenticated}
                      onJoin={onJoinGame}
                      onLeave={onLeaveGame}
                      onShowLogin={onShowLogin}
                      actionLoading={actionLoading}
                      onOpenChat={onOpenChat}
                      isCurrent
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="mx-4 border-t border-slate-100" />

            {/* Upcoming Games */}
            <div className="p-4 pt-3">
              <div className="flex items-center gap-2 mb-3">
                <Clock size={12} className="text-blue-500" />
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                  Proximos
                </h3>
                <span className="text-xs text-slate-400">({upcomingGames.length})</span>
              </div>

              {upcomingGames.length === 0 ? (
                <p className="text-xs text-slate-400">
                  No hay juegos programados cerca de ti
                </p>
              ) : (
                <div className="space-y-2">
                  {upcomingGames.map((game) => (
                    <GameCard
                      key={game.id}
                      game={game}
                      distance={game.distance}
                      userSub={userSub}
                      isAuthenticated={isAuthenticated}
                      onJoin={onJoinGame}
                      onLeave={onLeaveGame}
                      onShowLogin={onShowLogin}
                      actionLoading={actionLoading}
                      onOpenChat={onOpenChat}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function GameCard({
  game,
  distance,
  userSub,
  isAuthenticated,
  onJoin,
  onLeave,
  onShowLogin,
  actionLoading,
  onOpenChat,
  isCurrent,
}: {
  game: Game;
  distance: number;
  userSub: string | null;
  isAuthenticated: boolean;
  onJoin: (id: string) => void;
  onLeave: (id: string) => void;
  onShowLogin: () => void;
  actionLoading: string | null;
  onOpenChat?: (game: Game) => void;
  isCurrent?: boolean;
}) {
  const isCreator = userSub === game.creatorId;
  const isPlayer = game.players.includes(userSub || '');
  const isFull = game.players.length >= game.maxPlayers;
  const isPending = game.status === 'pending_approval';

  return (
    <div
      className={`rounded-lg border p-3 transition ${
        isCurrent
          ? 'border-green-200 bg-green-50/50'
          : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
      <div className="flex items-start justify-between mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-sm flex-shrink-0">{SPORT_ICONS[game.sport] || '🏅'}</span>
          <span className="text-sm font-semibold text-slate-800 truncate">{game.title}</span>
        </div>
        <span className="text-[10px] text-slate-400 flex-shrink-0 ml-2">
          {distance < 1 ? `${Math.round(distance * 1000)} mts` : `${distance.toFixed(1)} km`}
        </span>
      </div>

      {isPending && (
        <div className="text-[10px] font-semibold text-amber-600 mb-1">Pendiente de aprobacion</div>
      )}

      <div className="flex items-center gap-3 text-[11px] text-slate-500 mb-2">
        <span className="flex items-center gap-1">
          <Clock size={10} />
          {game.time} - {game.endTime || '?'}
        </span>
        <span className="flex items-center gap-1">
          <Users size={10} />
          {game.players.length}/{game.maxPlayers}
          {isFull && <span className="text-red-500 font-semibold">Lleno</span>}
        </span>
      </div>

      {game.complexName && (
        <p className="text-[10px] text-blue-600 font-medium mb-2 truncate">
          {game.complexName}
          {game.playfieldName ? ` — ${game.playfieldName}` : ''}
        </p>
      )}

      <div className="flex items-center gap-1.5 mb-2">
        <p className="text-[10px] text-slate-400">
          {game.date} — {game.creatorName}
        </p>
        <ReliabilityBadge playerSub={game.creatorId} compact />
      </div>

      {/* Action button */}
      {!isCreator && (
        <div>
          {!isAuthenticated ? (
            <button
              onClick={onShowLogin}
              className="w-full text-[11px] font-semibold py-1.5 rounded bg-orange-500 text-white hover:bg-orange-600 active:scale-95 transition"
            >
              Inicia sesion para unirte
            </button>
          ) : isPlayer ? (
            <button
              onClick={() => onLeave(game.id)}
              disabled={actionLoading === game.id}
              className="w-full text-[11px] font-semibold py-1.5 rounded bg-slate-200 text-slate-700 hover:bg-slate-300 transition disabled:opacity-50"
            >
              Salir
            </button>
          ) : (
            <button
              onClick={() => onJoin(game.id)}
              disabled={actionLoading === game.id || isFull}
              className="w-full text-[11px] font-semibold py-1.5 rounded bg-orange-500 text-white hover:bg-orange-600 active:scale-95 transition disabled:opacity-50 disabled:active:scale-100"
            >
              {isFull ? 'Lleno' : 'Unirme'}
            </button>
          )}
        </div>
      )}

      {/* Chat button */}
      {(isPlayer || isCreator) && onOpenChat && (
        <button
          onClick={() => onOpenChat(game)}
          className="w-full flex items-center justify-center gap-1.5 text-[11px] font-semibold py-1.5 rounded bg-green-50 text-green-700 hover:bg-green-100 active:scale-95 transition mt-1.5"
        >
          <MessageCircle size={12} />
          Chat
        </button>
      )}
    </div>
  );
}
