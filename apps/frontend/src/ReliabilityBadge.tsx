import { useEffect, useState } from 'react';
import { Star, ShieldCheck } from 'lucide-react';
import { fetchPlayerReliability, type PlayerReliability } from './api';

interface Props {
  playerSub: string;
  compact?: boolean;
}

export default function ReliabilityBadge({ playerSub, compact = false }: Props) {
  const [data, setData] = useState<PlayerReliability | null>(null);

  useEffect(() => {
    fetchPlayerReliability(playerSub).then(setData).catch(() => {});
  }, [playerSub]);

  if (!data || data.totalReviews === 0) return null;

  const attendColor =
    data.attendanceRate! >= 80 ? 'text-green-600' :
    data.attendanceRate! >= 50 ? 'text-amber-500' : 'text-red-500';

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px]" title={`Asistencia: ${data.attendanceRate}% | Rating: ${data.avgRating ?? '-'}/5 | ${data.totalReviews} reviews`}>
        <ShieldCheck size={12} className={attendColor} />
        <span className={`font-bold ${attendColor}`}>{data.attendanceRate}%</span>
        {data.avgRating != null && (
          <>
            <Star size={10} className="text-amber-400 fill-amber-400" />
            <span className="font-semibold text-slate-600">{data.avgRating}</span>
          </>
        )}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-2.5 py-1.5">
      <div className="flex items-center gap-1">
        <ShieldCheck size={14} className={attendColor} />
        <span className={`text-xs font-bold ${attendColor}`}>{data.attendanceRate}%</span>
        <span className="text-[10px] text-slate-400">asistencia</span>
      </div>
      {data.avgRating != null && (
        <div className="flex items-center gap-1">
          <Star size={12} className="text-amber-400 fill-amber-400" />
          <span className="text-xs font-bold text-slate-700">{data.avgRating}</span>
          <span className="text-[10px] text-slate-400">/5</span>
        </div>
      )}
      <span className="text-[10px] text-slate-400">({data.totalReviews})</span>
    </div>
  );
}
