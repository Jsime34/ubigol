import { getIdToken } from './auth';

const API_BASE = '/api';

const COUNTRY_CURRENCY: Record<string, { symbol: string; code: string }> = {
  US: { symbol: '$', code: 'USD' },
  MX: { symbol: '$', code: 'MXN' },
  AR: { symbol: '$', code: 'ARS' },
  CO: { symbol: '$', code: 'COP' },
  CL: { symbol: '$', code: 'CLP' },
  UY: { symbol: '$', code: 'UYU' },
  PE: { symbol: 'S/', code: 'PEN' },
  BR: { symbol: 'R$', code: 'BRL' },
  EC: { symbol: '$', code: 'USD' },
  VE: { symbol: 'Bs', code: 'VES' },
  PY: { symbol: '₲', code: 'PYG' },
  BO: { symbol: 'Bs', code: 'BOB' },
  CR: { symbol: '₡', code: 'CRC' },
  PA: { symbol: '$', code: 'USD' },
  GT: { symbol: 'Q', code: 'GTQ' },
  HN: { symbol: 'L', code: 'HNL' },
  NI: { symbol: 'C$', code: 'NIO' },
  SV: { symbol: '$', code: 'USD' },
  DO: { symbol: 'RD$', code: 'DOP' },
  GB: { symbol: '£', code: 'GBP' },
  ES: { symbol: '€', code: 'EUR' },
  FR: { symbol: '€', code: 'EUR' },
  DE: { symbol: '€', code: 'EUR' },
  IT: { symbol: '€', code: 'EUR' },
  PT: { symbol: '€', code: 'EUR' },
  NL: { symbol: '€', code: 'EUR' },
  BE: { symbol: '€', code: 'EUR' },
  JP: { symbol: '¥', code: 'JPY' },
  CN: { symbol: '¥', code: 'CNY' },
  KR: { symbol: '₩', code: 'KRW' },
  IN: { symbol: '₹', code: 'INR' },
  AU: { symbol: 'A$', code: 'AUD' },
  CA: { symbol: 'C$', code: 'CAD' },
};

export function currencyForCountry(countryCode?: string): { symbol: string; code: string } {
  if (!countryCode) return { symbol: '$', code: 'USD' };
  return COUNTRY_CURRENCY[countryCode] || { symbol: '$', code: 'USD' };
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getIdToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

export interface Game {
  id: string;
  sport: string;
  title: string;
  latitude: number;
  longitude: number;
  date: string;
  time: string;
  endTime: string;
  maxPlayers: number;
  description: string;
  creatorId: string;
  creatorName: string;
  players: string[];
  playerNames?: Record<string, string>;
  status: string;
  createdAt: string;
  playfieldId?: string;
  playfieldName?: string;
  complexId?: string;
  complexName?: string;
}

export async function fetchGames(): Promise<Game[]> {
  const res = await fetch(`${API_BASE}/games`);
  return res.json();
}

export async function fetchGame(id: string): Promise<Game> {
  const res = await fetch(`${API_BASE}/games/${id}`);
  return res.json();
}

export async function createGame(data: {
  sport: string;
  title: string;
  latitude: number;
  longitude: number;
  date: string;
  time: string;
  endTime: string;
  maxPlayers: number;
  description: string;
  playfieldId?: string;
}): Promise<Game> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/games`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Error al crear juego');
  }
  return res.json();
}

export async function joinGame(id: string): Promise<void> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/games/${id}/join`, {
    method: 'POST',
    headers: { ...headers },
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Error al unirte');
  }
}

export async function leaveGame(id: string): Promise<void> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/games/${id}/leave`, {
    method: 'POST',
    headers: { ...headers },
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Error al salir');
  }
}

export async function kickPlayer(gameId: string, playerId: string): Promise<void> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/games/${gameId}/kick`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ playerId }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Error al expulsar jugador');
  }
}

export async function cancelGame(id: string): Promise<void> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/games/${id}`, {
    method: 'DELETE',
    headers: { ...headers },
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Error al cancelar');
  }
}

// ==================== COMPLEX & PLAYFIELD API ====================

export interface Playfield {
  id: string;
  complexId: string;
  name: string;
  sports: string[];
  pricePerHour: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface Owner {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone: string;
  role: string;
}

export interface Complex {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  type: 'public' | 'private';
  verificationStatus: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  amenities: string[];
  description: string;
  countryCode?: string;
  playfields?: Playfield[];
  owners?: Owner[];
  createdAt: string;
  updatedAt: string;
}

export async function fetchComplexes(): Promise<Complex[]> {
  const res = await fetch(`${API_BASE}/complexes`);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Error al obtener complejos');
  }
  return res.json();
}

export async function fetchComplex(id: string): Promise<Complex> {
  const res = await fetch(`${API_BASE}/complexes/${id}`);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Error al obtener complejo');
  }
  return res.json();
}

export async function fetchPlayfieldGames(playfieldId: string): Promise<Game[]> {
  const res = await fetch(`${API_BASE}/complexes/playfields/${playfieldId}/games`);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Error al obtener juegos');
  }
  return res.json();
}

export async function fetchMe(): Promise<{ email: string; name: string; isAdmin: boolean }> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/me`, { headers });
  return res.json();
}

export async function submitComplex(data: {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  type: 'public' | 'private';
  amenities: string[];
  description: string;
  ownerPhone: string;
  countryCode?: string;
  playfields: { name: string; sports: string[]; pricePerHour?: number }[];
}): Promise<Complex> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/complexes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Error al enviar complejo');
  }
  return res.json();
}

export async function fetchPendingComplexes(): Promise<Complex[]> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/admin/complexes`, { headers });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Error al obtener complejos pendientes');
  }
  return res.json();
}

export async function approveComplex(id: string): Promise<void> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/admin/complexes/${id}/approve`, {
    method: 'POST',
    headers: { ...headers },
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Error al aprobar complejo');
  }
}

export async function rejectComplex(id: string, reason: string): Promise<void> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/admin/complexes/${id}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Error al rechazar complejo');
  }
}

// ==================== OWNER API ====================

export async function fetchMyComplexes(): Promise<Complex[]> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/complexes/mine`, { headers });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Error al obtener mis complejos');
  }
  return res.json();
}

export async function fetchPendingGames(playfieldId: string): Promise<Game[]> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/complexes/playfields/${playfieldId}/pending-games`, { headers });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Error al obtener juegos pendientes');
  }
  return res.json();
}

export async function approveGame(playfieldId: string, gameId: string): Promise<void> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/complexes/playfields/${playfieldId}/games/${gameId}/approve`, {
    method: 'POST',
    headers: { ...headers },
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Error al aprobar juego');
  }
}

export async function rejectGame(playfieldId: string, gameId: string): Promise<void> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/complexes/playfields/${playfieldId}/games/${gameId}/reject`, {
    method: 'POST',
    headers: { ...headers },
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Error al rechazar juego');
  }
}

// ==================== COMPLEX/PLAYFIELD EDIT API ====================

export async function updateComplex(complexId: string, data: {
  name?: string;
  address?: string;
  description?: string;
  amenities?: string[];
}): Promise<Complex> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/complexes/${complexId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Error al actualizar complejo');
  }
  return res.json();
}

export async function updatePlayfield(complexId: string, playfieldId: string, data: {
  name?: string;
  sports?: string[];
  pricePerHour?: number | null;
}): Promise<Playfield> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/complexes/${complexId}/playfields/${playfieldId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Error al actualizar cancha');
  }
  return res.json();
}

export async function deletePlayfield(complexId: string, playfieldId: string): Promise<void> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/complexes/${complexId}/playfields/${playfieldId}`, {
    method: 'DELETE',
    headers: { ...headers },
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Error al eliminar cancha');
  }
}

export async function addPlayfield(complexId: string, data: {
  name: string;
  sports: string[];
  pricePerHour?: number;
}): Promise<Playfield> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/complexes/${complexId}/playfields`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Error al agregar cancha');
  }
  return res.json();
}

// ==================== NOTIFICATIONS API ====================

export interface Notification {
  userId: string;
  createdAt: string;
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  data?: Record<string, string>;
}

export async function fetchNotifications(): Promise<Notification[]> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/notifications`, { headers });
  if (!res.ok) return [];
  return res.json();
}

export async function markNotificationRead(id: string, createdAt: string): Promise<void> {
  const headers = await authHeaders();
  await fetch(`${API_BASE}/notifications/${id}/read`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ createdAt }),
  });
}

export async function markAllNotificationsRead(): Promise<void> {
  const headers = await authHeaders();
  await fetch(`${API_BASE}/notifications/read-all`, {
    method: 'POST',
    headers: { ...headers },
  });
}

// ==================== ATTENDANCE / RELIABILITY API ====================

export interface PlayerReliability {
  totalReviews: number;
  attendanceRate: number | null;
  avgRating: number | null;
}

export async function submitAttendance(
  gameId: string,
  ratings: { subjectId: string; attended: boolean; rating?: number }[]
): Promise<void> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/attendance/${gameId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ ratings }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Error al enviar calificaciones');
  }
}

export async function fetchPendingAttendance(): Promise<Game[]> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/attendance/pending`, { headers });
  if (!res.ok) return [];
  return res.json();
}

export async function fetchPlayerReliability(sub: string): Promise<PlayerReliability> {
  const res = await fetch(`${API_BASE}/attendance/players/${sub}/reliability`);
  return res.json();
}

// ── Chat ──

export interface ChatMessage {
  id: string;
  gameId: string;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: string;
}

export interface ChatGame {
  id: string;
  title: string;
  sport: string;
  date: string;
  time: string;
  endTime: string;
  playerCount: number;
  lastMessage?: { content: string; senderName: string; createdAt: string };
}

export async function fetchActiveChats(): Promise<ChatGame[]> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/chat/active`, { headers });
  if (!res.ok) return [];
  return res.json();
}

export async function fetchChatMessages(gameId: string, limit?: number, before?: string): Promise<ChatMessage[]> {
  const headers = await authHeaders();
  const params = new URLSearchParams();
  if (limit) params.set('limit', String(limit));
  if (before) params.set('before', before);
  const res = await fetch(`${API_BASE}/chat/${gameId}/messages?${params}`, { headers });
  if (!res.ok) return [];
  return res.json();
}
