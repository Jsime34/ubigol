import { useEffect, useState } from 'react';
import { X, MessageCircle } from 'lucide-react';
import { fetchActiveChats, type ChatGame } from './api';

const SPORT_ICONS: Record<string, string> = {
  futbol: '⚽', basketball: '🏀', volleyball: '🏐', tennis: '🎾', other: '🏅',
};

interface Props {
  onClose: () => void;
  onOpenChat: (gameId: string, gameTitle: string, gameSport: string) => void;
}

export default function ChatList({ onClose, onOpenChat }: Props) {
  const [chats, setChats] = useState<ChatGame[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActiveChats()
      .then(setChats)
      .catch(() => setChats([]))
      .finally(() => setLoading(false));
  }, []);

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'ahora';
    if (mins < 60) return `hace ${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `hace ${hrs}h`;
    const days = Math.floor(hrs / 24);
    return `hace ${days}d`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[3000] flex items-center justify-center p-4 animate-backdrop-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[70vh] flex flex-col overflow-hidden animate-modal-in">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-green-50 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <MessageCircle size={18} className="text-green-600" />
            <h2 className="text-sm font-bold text-slate-800">Chats</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-green-100 rounded-lg transition">
            <X size={18} className="text-slate-500" />
          </button>
        </div>

        {/* Chat list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="text-xs text-slate-400 text-center py-8">Cargando...</p>
          ) : chats.length === 0 ? (
            <div className="text-center py-8 px-4">
              <MessageCircle size={32} className="text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No tienes chats activos</p>
              <p className="text-xs text-slate-300 mt-1">Únete a un juego para chatear con otros jugadores</p>
            </div>
          ) : (
            chats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => onOpenChat(chat.id, chat.title, chat.sport)}
                className="w-full px-4 py-3 flex items-start gap-3 hover:bg-slate-50 transition border-b border-slate-50 text-left"
              >
                <div className="text-xl mt-0.5">{SPORT_ICONS[chat.sport] || '🏅'}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-800 truncate">{chat.title}</p>
                    {chat.lastMessage && (
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {timeAgo(chat.lastMessage.createdAt)}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {chat.date} · {chat.time} - {chat.endTime} · {chat.playerCount} jugadores
                  </p>
                  {chat.lastMessage && (
                    <p className="text-xs text-slate-400 mt-1 truncate">
                      <span className="font-medium text-slate-500">{chat.lastMessage.senderName}:</span>{' '}
                      {chat.lastMessage.content}
                    </p>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
