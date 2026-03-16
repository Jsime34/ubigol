import { useState } from 'react';
import { Star, Check, X, UserCheck, UserX } from 'lucide-react';
import { submitAttendance, type Game } from './api';

const SPORT_ICONS: Record<string, string> = {
  futbol: '\u26BD',
  basketball: '\uD83C\uDFC0',
  volleyball: '\uD83C\uDFD0',
  tennis: '\uD83C\uDFBE',
  other: '\uD83C\uDFC5',
};

interface Props {
  game: Game;
  userSub: string;
  onClose: () => void;
  onSubmitted: () => void;
}

interface PlayerRating {
  subjectId: string;
  name: string;
  attended: boolean;
  rating: number;
}

export default function AttendanceModal({ game, userSub, onClose, onSubmitted }: Props) {
  const otherPlayers = game.players.filter((p) => p !== userSub);
  const [ratings, setRatings] = useState<PlayerRating[]>(
    otherPlayers.map((sub) => ({
      subjectId: sub,
      name: game.playerNames?.[sub] || sub.slice(0, 8),
      attended: true,
      rating: 3,
    }))
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const updateRating = (idx: number, field: Partial<PlayerRating>) => {
    setRatings((prev) => prev.map((r, i) => (i === idx ? { ...r, ...field } : r)));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      await submitAttendance(
        game.id,
        ratings.map((r) => ({
          subjectId: r.subjectId,
          attended: r.attended,
          rating: r.attended ? r.rating : undefined,
        }))
      );
      onSubmitted();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                {SPORT_ICONS[game.sport] || '\uD83C\uDFC5'} Calificar jugadores
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {game.title} &middot; {game.date}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-slate-100 rounded-lg transition"
            >
              <X size={18} className="text-slate-400" />
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Marca si cada jugador asistio y califica su desempeno (1-5 estrellas)
          </p>
        </div>

        {/* Player list */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
          {ratings.map((r, idx) => (
            <div
              key={r.subjectId}
              className={`rounded-xl border p-3 transition ${
                r.attended ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-800">{r.name}</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => updateRating(idx, { attended: true })}
                    className={`p-1.5 rounded-lg transition ${
                      r.attended
                        ? 'bg-green-100 text-green-600'
                        : 'hover:bg-slate-100 text-slate-400'
                    }`}
                    title="Asistio"
                  >
                    <UserCheck size={16} />
                  </button>
                  <button
                    onClick={() => updateRating(idx, { attended: false })}
                    className={`p-1.5 rounded-lg transition ${
                      !r.attended
                        ? 'bg-red-100 text-red-600'
                        : 'hover:bg-slate-100 text-slate-400'
                    }`}
                    title="No asistio"
                  >
                    <UserX size={16} />
                  </button>
                </div>
              </div>

              {r.attended && (
                <div className="flex items-center gap-1 mt-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => updateRating(idx, { rating: star })}
                      className="transition hover:scale-110"
                    >
                      <Star
                        size={20}
                        className={
                          star <= r.rating
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-slate-300'
                        }
                      />
                    </button>
                  ))}
                  <span className="text-xs text-slate-500 ml-2">
                    {r.rating === 1 && 'Malo'}
                    {r.rating === 2 && 'Regular'}
                    {r.rating === 3 && 'Bueno'}
                    {r.rating === 4 && 'Muy bueno'}
                    {r.rating === 5 && 'Excelente'}
                  </span>
                </div>
              )}

              {!r.attended && (
                <p className="text-xs text-red-500 mt-1">No se presento al juego</p>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-100">
          {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
            >
              Despues
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 py-2.5 rounded-xl bg-green-600 text-white text-sm font-bold hover:bg-green-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Check size={16} />
              {submitting ? 'Enviando...' : 'Enviar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
