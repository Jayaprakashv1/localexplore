/**
 * Offline write queue.
 *
 * When the device is offline, mutating operations (save, unsave, create trip,
 * delete trip, etc.) are persisted to AsyncStorage. When the app comes back
 * online the queue is drained sequentially so all mutations eventually land
 * on Supabase.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export type QueuedOpType =
  | 'savePlace'
  | 'unsavePlace'
  | 'addSearchHistory'
  | 'clearSearchHistory'
  | 'createTrip'
  | 'deleteTrip'
  | 'addTripItem'
  | 'removeTripItem'
  | 'updateTripVisibility'
  | 'requestToJoinTrip'
  | 'cancelJoinRequest'
  | 'approveJoinRequest'
  | 'rejectJoinRequest';

export interface QueuedOp {
  id: string;
  type: QueuedOpType;
  payload: Record<string, unknown>;
  queuedAt: number;
}

const QUEUE_KEY = 'le_offline_queue';

export async function enqueue(type: QueuedOpType, payload: Record<string, unknown>): Promise<void> {
  try {
    const queue = await readQueue();
    const id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    queue.push({ id, type, payload, queuedAt: Date.now() });
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // Fail silently — we'll retry later
  }
}

export async function readQueue(): Promise<QueuedOp[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as QueuedOp[];
  } catch {
    return [];
  }
}

export async function dequeue(id: string): Promise<void> {
  try {
    const queue = await readQueue();
    const filtered = queue.filter(op => op.id !== id);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(filtered));
  } catch {
    // Ignore
  }
}

export async function clearQueue(): Promise<void> {
  try {
    await AsyncStorage.removeItem(QUEUE_KEY);
  } catch {
    // Ignore
  }
}

export async function getQueueLength(): Promise<number> {
  const q = await readQueue();
  return q.length;
}
