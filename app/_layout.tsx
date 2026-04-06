import { useEffect } from "react";
import { Stack, router, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFrameworkReady } from "@/hooks/useFrameworkReady";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { NetworkProvider, useNetwork } from "@/contexts/NetworkContext";
import { setNetworkStatus } from "@/lib/database";
import { ActivityIndicator, View, StyleSheet } from "react-native";

function RootLayoutNav() {
  const { user, loading } = useAuth();
  const { isOnline } = useNetwork();
  const segments = useSegments();

  // Keep database layer in sync with network status
  useEffect(() => {
    setNetworkStatus(isOnline);
  }, [isOnline]);

  useEffect(() => {
    if (loading) return;

    const inTabs = segments[0] === "(tabs)";

    if (!user && inTabs) {
      router.replace("/login");
    } else if (user && !inTabs) {
      router.replace("/(tabs)");
    }
  }, [user, loading, segments]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

export default function RootLayout() {
  useFrameworkReady();

  return (
    <AuthProvider>
      <NetworkProvider>
        <RootLayoutNav />
        <StatusBar style="auto" />
      </NetworkProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
});
