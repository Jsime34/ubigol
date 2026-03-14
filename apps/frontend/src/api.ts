import { getIdToken } from './auth';

const API_BASE = '/api';

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
  maxPlayers: number;
  description: string;
  creatorId: string;
  creatorName: string;
  players: string[];
  status: string;
  createdAt: string;
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
  maxPlayers: number;
  description: string;
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

// ==================== PLAYFIELD API ====================

export interface Playfield {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  type: 'public' | 'private';
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  verificationStatus: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  sports: string[];
  amenities: string[];
  description: string;
  createdAt: string;
  updatedAt: string;
}

export async function fetchMe(): Promise<{ email: string; name: string; isAdmin: boolean }> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/me`, { headers });
  return res.json();
}

export async function fetchPendingPlayfields(): Promise<Playfield[]> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/admin/playfields`, { headers });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Error al obtener canchas pendientes');
  }
  return res.json();
}

export async function approvePlayfield(id: string): Promise<void> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/admin/playfields/${id}/approve`, {
    method: 'POST',
    headers: { ...headers },
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Error al aprobar cancha');
  }
}

export async function rejectPlayfield(id: string, reason: string): Promise<void> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/admin/playfields/${id}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Error al rechazar cancha');
  }
}
