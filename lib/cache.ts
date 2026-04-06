import AsyncStorage from '@react-native-async-storage/async-storage';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const PREFIX = 'le_cache_';

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() > entry.expiresAt) {
      await AsyncStorage.removeItem(PREFIX + key);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

export async function cacheSet<T>(key: string, data: T, ttlMs: number): Promise<void> {
  try {
    const entry: CacheEntry<T> = { data, expiresAt: Date.now() + ttlMs };
    await AsyncStorage.setItem(PREFIX + key, JSON.stringify(entry));
  } catch {
    // Storage full or unavailable — fail silently
  }
}

export async function cacheRemove(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(PREFIX + key);
  } catch {
    // Ignore
  }
}

export async function cacheRemoveByPrefix(prefix: string): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const toRemove = keys.filter(k => k.startsWith(PREFIX + prefix));
    for (const key of toRemove) {
      await AsyncStorage.removeItem(key);
    }
  } catch {
    // Ignore
  }
}

// TTL constants (milliseconds)
export const TTL = {
  SAVED_PLACES: 24 * 60 * 60 * 1000,   // 24 h
  TRIPS: 60 * 60 * 1000,               // 1 h
  TRIP_ITEMS: 60 * 60 * 1000,          // 1 h
  TRIP_MEMBERS: 30 * 60 * 1000,        // 30 min
  SEARCH_HISTORY: 7 * 24 * 60 * 60 * 1000, // 7 days
  PUBLIC_FEED: 30 * 60 * 1000,         // 30 min
  WEATHER: 60 * 60 * 1000,             // 1 h
  DISCOVER: 60 * 60 * 1000,            // 1 h
};
