import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { readQueue, dequeue, QueuedOp } from '@/lib/offlineQueue';

interface NetworkContextType {
  isOnline: boolean;
  wasPreviouslyOffline: boolean;
}

const NetworkContext = createContext<NetworkContextType>({
  isOnline: true,
  wasPreviouslyOffline: false,
});

export function useNetwork() {
  return useContext(NetworkContext);
}

// ---------------------------------------------------------------------------
// Offline Banner
// ---------------------------------------------------------------------------
function OfflineBanner({ visible }: { visible: boolean }) {
  const translateY = useRef(new Animated.Value(-60)).current;

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: visible ? 0 : -60,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [visible, translateY]);

  return (
    <Animated.View
      style={[styles.banner, { transform: [{ translateY }], pointerEvents: 'none' }]}
    >
      <Text style={styles.bannerText}>⚡ You're offline — showing cached data</Text>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Sync queue when coming back online
// ---------------------------------------------------------------------------
async function drainOfflineQueue(
  executors: Record<string, (payload: Record<string, unknown>) => Promise<void>>
) {
  const queue = await readQueue();
  for (const op of queue) {
    const fn = executors[op.type];
    if (!fn) {
      await dequeue(op.id);
      continue;
    }
    try {
      await fn(op.payload);
      await dequeue(op.id);
    } catch {
      // Keep in queue to retry on next connectivity event
    }
  }
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
export function NetworkProvider({
  children,
  queueExecutors = {},
}: {
  children: React.ReactNode;
  queueExecutors?: Record<string, (payload: Record<string, unknown>) => Promise<void>>;
}) {
  const [isOnline, setIsOnline] = useState(true);
  const [wasPreviouslyOffline, setWasPreviouslyOffline] = useState(false);
  const previousOnline = useRef(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const online = !!(state.isConnected && state.isInternetReachable !== false);
      setIsOnline(online);

      if (!previousOnline.current && online) {
        // Just came back online
        setWasPreviouslyOffline(true);
        // Drain any queued writes
        if (Object.keys(queueExecutors).length > 0) {
          drainOfflineQueue(queueExecutors).catch(console.error);
        }
        const timer = setTimeout(() => setWasPreviouslyOffline(false), 3000);
        return () => clearTimeout(timer);
      }

      previousOnline.current = online;
    });

    return () => unsubscribe();
  }, [queueExecutors]);

  return (
    <NetworkContext.Provider value={{ isOnline, wasPreviouslyOffline }}>
      <OfflineBanner visible={!isOnline} />
      {children}
    </NetworkContext.Provider>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#374151',
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    zIndex: 9999,
    elevation: 10,
  },
  bannerText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
});
