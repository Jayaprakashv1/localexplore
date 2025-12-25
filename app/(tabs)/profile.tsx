import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { User, LogOut, Mail, Calendar } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      {
        text: 'Cancel',
        onPress: () => {},
        style: 'cancel',
      },
      {
        text: 'Sign Out',
        onPress: async () => {
          setLoading(true);
          try {
            await signOut();
            router.replace('/login');
          } catch (error) {
            setLoading(false);
            Alert.alert('Error', 'Failed to sign out');
          }
        },
        style: 'destructive',
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <User size={48} color="#2563eb" strokeWidth={2} />
          </View>
          <Text style={styles.title}>Profile</Text>
          {user?.email && (
            <View style={styles.emailContainer}>
              <Mail size={16} color="#6b7280" strokeWidth={2} />
              <Text style={styles.email}>{user.email}</Text>
            </View>
          )}
        </View>

        <View style={styles.content}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account Information</Text>
            <View style={styles.card}>
              <View style={styles.infoRow}>
                <View style={styles.infoLabelContainer}>
                  <Mail size={16} color="#6b7280" strokeWidth={2} />
                  <Text style={styles.infoLabel}>Email Address</Text>
                </View>
                <Text style={styles.infoValue}>{user?.email || 'N/A'}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.infoRow}>
                <View style={styles.infoLabelContainer}>
                  <Calendar size={16} color="#6b7280" strokeWidth={2} />
                  <Text style={styles.infoLabel}>Member Since</Text>
                </View>
                <Text style={styles.infoValue}>
                  {user?.created_at
                    ? new Date(user.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })
                    : 'N/A'}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Settings</Text>
            <TouchableOpacity
              style={[styles.logoutButton, loading && styles.buttonDisabled]}
              onPress={handleLogout}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <>
                  <LogOut size={20} color="#ffffff" strokeWidth={2} />
                  <Text style={styles.logoutText}>Sign Out</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.appInfo}>
            <Text style={styles.appName}>Travel Discover</Text>
            <Text style={styles.appVersion}>Version 1.0.0</Text>
            <Text style={styles.appTagline}>
              Explore the world with confidence
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  avatarContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 3,
    borderColor: '#2563eb',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  emailContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  email: {
    fontSize: 14,
    color: '#6b7280',
  },
  content: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  infoRow: {
    paddingVertical: 12,
  },
  infoLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  infoLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  logoutButton: {
    backgroundColor: '#dc2626',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  logoutText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  appInfo: {
    alignItems: 'center',
    marginTop: 32,
    paddingBottom: 24,
  },
  appName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  appVersion: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 8,
  },
  appTagline: {
    fontSize: 12,
    color: '#9ca3af',
  },
});
