import { useEffect, useRef, useState } from 'react';
import { X, Send, Users, ShieldBan, ChevronLeft } from 'lucide-react';
import { getSocket } from './socket';
import { fetchGame, kickPlayer } from './api';
import type { ChatMessage, Game } from './api';
import ReliabilityBadge from './ReliabilityBadge';

const SPORT_ICONS: Record<string, string> = {
  futbol: '⚽', basketball: '🏀', volleyball: '🏐', tennis: '🎾', other: '🏅',
};

interface Props {
  gameId: string;
  gameTitle: string;
  gameSport: string;
  currentUserSub: string;
  onClose: () => void;
}

type View = 'chat' | 'players';

export default function GameChat({ gameId, gameTitle, gameSport, currentUserSub, onClose }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>('chat');
  const [game, setGame] = useState<Game | null>(null);
  const [kickingPlayer, setKickingPlayer] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isCreator = game?.creatorId === currentUserSub;

  useEffect(() => {
    fetchGame(gameId).then(setGame).catch(() => {});
  }, [gameId]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onHistory = ({ gameId: gId, messages: msgs }: { gameId: string; messages: ChatMessage[] }) => {
      if (gId === gameId) setMessages(msgs);
    };
    const onNewMessage = (msg: ChatMessage) => {
      if (msg.gameId === gameId) {
        setMessages((prev) => [...prev, msg]);
      }
    };
    const onError = ({ message }: { message: string }) => setError(message);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('chat-history', onHistory);
    socket.on('new-message', onNewMessage);
    socket.on('chat-error', onError);

    if (socket.connected) setConnected(true);
    socket.emit('join-chat', { gameId });

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('chat-history', onHistory);
      socket.off('new-message', onNewMessage);
      socket.off('chat-error', onError);
      socket.emit('leave-chat', { gameId });
    };
  }, [gameId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    const socket = getSocket();
    if (!socket) return;
    socket.emit('send-message', { gameId, content: text });
    setInput('');
    inputRef.current?.focus();
  };

  const handleKick = async (playerId: string) => {
    if (!confirm('¿Seguro que quieres expulsar a este jugador?')) return;
    setKickingPlayer(playerId);
    try {
      await kickPlayer(gameId, playerId);
      const updated = await fetchGame(gameId);
      setGame(updated);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setKickingPlayer(null);
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const playerNames = game?.playerNames || {};
  const players = game?.players || [];

  return (
    <div className="fixed inset-0 bg-black/50 z-[3000] flex items-center justify-center p-4 animate-backdrop-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col animate-modal-in" style={{ height: '70vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-green-50 rounded-t-2xl">
          <div className="flex items-center gap-2 min-w-0">
            {view === 'players' && (
              <button onClick={() => setView('chat')} className="p-0.5 hover:bg-green-100 rounded transition">
                <ChevronLeft size={18} className="text-slate-500" />
              </button>
            )}
            <span className="text-lg">{SPORT_ICONS[gameSport] || '🏅'}</span>
            <h2 className="text-sm font-bold text-slate-800 truncate">
              {view === 'players' ? 'Jugadores' : gameTitle}
            </h2>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setView(view === 'players' ? 'chat' : 'players')}
              className={`p-1.5 rounded-lg transition ${view === 'players' ? 'bg-green-200 text-green-800' : 'hover:bg-green-100 text-slate-500'}`}
              title="Jugadores"
            >
              <Users size={16} />
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-green-100 rounded-lg transition">
              <X size={18} className="text-slate-500" />
            </button>
          </div>
        </div>

        {/* Connection status */}
        {!connected && view === 'chat' && (
          <div className="px-4 py-1.5 bg-amber-50 text-amber-700 text-xs text-center">
            Conectando...
          </div>
        )}

        {error && (
          <div className="px-4 py-1.5 bg-red-50 text-red-700 text-xs text-center">
            {error}
          </div>
        )}

        {view === 'chat' ? (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {messages.length === 0 && (
                <p className="text-xs text-slate-400 text-center mt-8">No hay mensajes aún. ¡Sé el primero!</p>
              )}
              {messages.map((msg) => {
                const isOwn = msg.senderId === currentUserSub;
                return (
                  <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] rounded-xl px-3 py-2 ${isOwn ? 'bg-green-500 text-white' : 'bg-slate-100 text-slate-800'}`}>
                      {!isOwn && (
                        <p className="text-[10px] font-semibold text-green-700 mb-0.5">{msg.senderName}</p>
                      )}
                      <p className="text-sm break-words">{msg.content}</p>
                      <p className={`text-[9px] mt-0.5 text-right ${isOwn ? 'text-green-100' : 'text-slate-400'}`}>
                        {formatTime(msg.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-3 py-2 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Escribe un mensaje..."
                  className="flex-1 text-sm px-3 py-2 rounded-full border border-slate-200 focus:outline-none focus:border-green-400"
                  autoFocus
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="p-2 bg-green-500 text-white rounded-full hover:bg-green-600 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </>
        ) : (
          /* Players list */
          <div className="flex-1 overflow-y-auto">
            <div className="px-4 py-3">
              <p className="text-xs text-slate-400 mb-3">
                {players.length}/{game?.maxPlayers || '?'} jugadores
              </p>
              <div className="space-y-1">
                {players.map((sub) => {
                  const name = playerNames[sub] || 'Jugador';
                  const isSelf = sub === currentUserSub;
                  const isGameCreator = sub === game?.creatorId;

                  return (
                    <div
                      key={sub}
                      className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-slate-50 transition"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-sm font-bold text-green-700 flex-shrink-0">
                          {name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium text-slate-800 truncate">{name}</span>
                            {isGameCreator && (
                              <span className="text-[9px] font-bold bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full flex-shrink-0">
                                Organizador
                              </span>
                            )}
                            {isSelf && (
                              <span className="text-[9px] font-bold bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full flex-shrink-0">
                                Tú
                              </span>
                            )}
                          </div>
                          <ReliabilityBadge playerSub={sub} compact />
                        </div>
                      </div>
                      {isCreator && !isGameCreator && (
                        <button
                          onClick={() => handleKick(sub)}
                          disabled={kickingPlayer === sub}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
                          title="Expulsar jugador"
                        >
                          <ShieldBan size={16} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
