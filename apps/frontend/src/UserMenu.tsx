import { useEffect, useRef, useState } from 'react';
import { User, LogOut, Gamepad2, MessageCircle, Building2, Shield, ChevronRight, Star, ShieldCheck } from 'lucide-react';
import { fetchGames, fetchPlayerReliability, type Game, type PlayerReliability } from './api';

const SPORT_ICONS: Record<string, string> = {
  futbol: '⚽',
  basketball: '🏀',
  volleyball: '🏐',
  tennis: '🎾',
  other: '🏅',
};

interface Props {
  email: string;
  userName: string;
  userSub: string | null;
  isOwner: boolean;
  isAdmin: boolean;
  onShowOwnerDashboard: () => void;
  onShowAdmin: () => void;
  onShowChats: () => void;
  onLogout: () => void;
}

export default function UserMenu({
  email,
  userName,
  userSub,
  isOwner,
  isAdmin,
  onShowOwnerDashboard,
  onShowAdmin,
  onShowChats,
  onLogout,
}: Props) {
  const [open, setOpen] = useState(false);
  const [showMyGames, setShowMyGames] = useState(false);
  const [myGames, setMyGames] = useState<Game[]>([]);
  const [loadingGames, setLoadingGames] = useState(false);
  const [reliability, setReliability] = useState<PlayerReliability | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setShowMyGames(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (open && userSub) {
      fetchPlayerReliability(userSub).then(setReliability).catch(() => {});
    }
  }, [open, userSub]);

  const handleOpenMyGames = () => {
    setShowMyGames(true);
    setLoadingGames(true);
    fetchGames()
      .then((games) => {
        const mine = games.filter(
          (g) =>
            g.status !== 'cancelled' &&
            (g.creatorId === userSub || g.players.includes(userSub || ''))
        );
        const now = new Date();
        mine.sort((a, b) => {
          const startA = new Date(`${a.date}T${a.time}`).getTime();
          const startB = new Date(`${b.date}T${b.time}`).getTime();
          return startA - startB;
        });
        const upcoming = mine.filter((g) => new Date(`${g.date}T${g.endTime}`) >= now);
        setMyGames(upcoming);
      })
      .catch(() => setMyGames([]))
      .finally(() => setLoadingGames(false));
  };

  const initials = userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setOpen(!open); setShowMyGames(false); }}
        className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center border border-green-300 cursor-pointer hover:bg-green-200 transition"
        title={email}
      >
        {initials ? (
          <span className="text-xs font-bold text-green-700">{initials}</span>
        ) : (
          <User size={18} className="text-green-600" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 z-[2000] overflow-hidden">
          {/* Profile header */}
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center border border-green-300">
                {initials ? (
                  <span className="text-sm font-bold text-green-700">{initials}</span>
                ) : (
                  <User size={20} className="text-green-600" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-800 truncate">{userName}</p>
                <p className="text-xs text-slate-500 truncate">{email}</p>
              </div>
            </div>
            {reliability && reliability.totalReviews > 0 && (
              <div className="mt-2 flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <ShieldCheck size={13} className={
                    reliability.attendanceRate! >= 80 ? 'text-green-600' :
                    reliability.attendanceRate! >= 50 ? 'text-amber-500' : 'text-red-500'
                  } />
                  <span className={`text-xs font-bold ${
                    reliability.attendanceRate! >= 80 ? 'text-green-600' :
                    reliability.attendanceRate! >= 50 ? 'text-amber-500' : 'text-red-500'
                  }`}>{reliability.attendanceRate}%</span>
                </div>
                {reliability.avgRating != null && (
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star
                        key={i}
                        size={12}
                        className={i <= Math.round(reliability.avgRating!)
                          ? 'text-amber-400 fill-amber-400'
                          : 'text-slate-300'
                        }
                      />
                    ))}
                    <span className="text-[10px] text-slate-500 ml-0.5">({reliability.totalReviews})</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {showMyGames ? (
            <>
              <button
                onClick={() => setShowMyGames(false)}
                className="w-full px-4 py-2 text-xs text-slate-500 hover:bg-slate-50 transition text-left border-b border-slate-100"
              >
                ← Volver
              </button>
              <div className="max-h-64 overflow-y-auto">
                {loadingGames ? (
                  <p className="text-xs text-slate-400 text-center py-6">Cargando...</p>
                ) : myGames.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">No tienes juegos activos</p>
                ) : (
                  myGames.map((game) => {
                    const isCreator = game.creatorId === userSub;
                    return (
                      <div
                        key={game.id}
                        className="px-4 py-2.5 border-b border-slate-50 hover:bg-slate-50 transition"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{SPORT_ICONS[game.sport] || '🏅'}</span>
                          <span className="text-sm font-semibold text-slate-800 truncate">{game.title}</span>
                          {isCreator && (
                            <span className="text-[9px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">
                              Creador
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-[11px] text-slate-500">
                          <span>{game.date}</span>
                          <span>{game.time} - {game.endTime}</span>
                          <span>{game.players.length}/{game.maxPlayers}</span>
                        </div>
                        {game.complexName && (
                          <p className="text-[10px] text-blue-600 mt-0.5 truncate">{game.complexName}</p>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            <div className="py-1">
              {/* My Games */}
              <button
                onClick={handleOpenMyGames}
                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition"
              >
                <div className="flex items-center gap-3">
                  <Gamepad2 size={16} className="text-slate-500" />
                  <span className="text-sm text-slate-700">Mis Juegos</span>
                </div>
                <ChevronRight size={14} className="text-slate-400" />
              </button>

              {/* Chats */}
              <button
                onClick={() => { onShowChats(); setOpen(false); }}
                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition"
              >
                <div className="flex items-center gap-3">
                  <MessageCircle size={16} className="text-green-500" />
                  <span className="text-sm text-slate-700">Chats</span>
                </div>
                <ChevronRight size={14} className="text-slate-400" />
              </button>

              {/* Owner dashboard */}
              {isOwner && (
                <button
                  onClick={() => { onShowOwnerDashboard(); setOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition"
                >
                  <Building2 size={16} className="text-blue-500" />
                  <span className="text-sm text-slate-700">Mis Complejos</span>
                </button>
              )}

              {/* Admin panel */}
              {isAdmin && (
                <button
                  onClick={() => { onShowAdmin(); setOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition"
                >
                  <Shield size={16} className="text-amber-500" />
                  <span className="text-sm text-slate-700">Panel Admin</span>
                </button>
              )}

              <div className="border-t border-slate-100 mt-1" />

              {/* Logout */}
              <button
                onClick={() => { onLogout(); setOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-red-50 transition"
              >
                <LogOut size={16} className="text-red-500" />
                <span className="text-sm text-red-600 font-medium">Cerrar Sesion</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
