import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, Check, CheckCheck, Clock, XCircle, UserPlus, UserMinus, Ban, Users, Building2, CircleAlert } from 'lucide-react';
import { fetchNotifications, markNotificationRead, markAllNotificationsRead, type Notification } from './api';

const TYPE_CONFIG: Record<string, { icon: typeof Bell; color: string }> = {
  game_request: { icon: Clock, color: 'text-amber-500' },
  game_approved: { icon: Check, color: 'text-green-500' },
  game_rejected: { icon: XCircle, color: 'text-red-500' },
  player_joined: { icon: UserPlus, color: 'text-green-500' },
  player_left: { icon: UserMinus, color: 'text-orange-500' },
  game_cancelled: { icon: Ban, color: 'text-red-500' },
  game_full: { icon: Users, color: 'text-green-600' },
  game_almost_full: { icon: CircleAlert, color: 'text-amber-500' },
  spot_opened: { icon: UserMinus, color: 'text-blue-500' },
  complex_approved: { icon: Building2, color: 'text-green-500' },
  complex_rejected: { icon: Building2, color: 'text-red-500' },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `hace ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `hace ${days}d`;
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    fetchNotifications().then(setNotifications).catch(() => {});
  }, []);

  // Load on mount and poll every 30s
  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkRead = async (notif: Notification) => {
    if (notif.read) return;
    await markNotificationRead(notif.id, notif.createdAt);
    setNotifications((prev) =>
      prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
    );
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setOpen(!open); if (!open) load(); }}
        className="p-2 hover:bg-slate-100 rounded-full transition relative"
        title="Notificaciones"
      >
        <Bell size={18} className="text-slate-600" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 z-[2000] overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-800">Notificaciones</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-semibold transition"
              >
                <CheckCheck size={14} />
                Marcar todas
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">No hay nuevas notificaciones por ahora</p>
            ) : (
              notifications.map((notif) => {
                const config = TYPE_CONFIG[notif.type] || { icon: Bell, color: 'text-slate-500' };
                const Icon = config.icon;

                return (
                  <button
                    key={notif.id}
                    onClick={() => handleMarkRead(notif)}
                    className={`w-full text-left px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition flex gap-3 ${
                      !notif.read ? 'bg-blue-50/50' : ''
                    }`}
                  >
                    <div className={`mt-0.5 ${config.color}`}>
                      <Icon size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-xs font-semibold truncate ${!notif.read ? 'text-slate-800' : 'text-slate-600'}`}>
                          {notif.title}
                        </p>
                        {!notif.read && (
                          <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{notif.message}</p>
                      <p className="text-[10px] text-slate-400 mt-1">{timeAgo(notif.createdAt)}</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
