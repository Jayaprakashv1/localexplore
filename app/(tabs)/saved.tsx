import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Bookmark, Trash2 } from 'lucide-react-native';
import { getSavedPlaces, unsavePlace } from '@/lib/database';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';

export default function SavedScreen() {
  const [places, setPlaces] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useFocusEffect(
    useCallback(() => {
      loadSavedPlaces();
    }, [])
  );

  const loadSavedPlaces = async () => {
    setLoading(true);
    try {
      const savedPlaces = await getSavedPlaces();
      setPlaces(savedPlaces);
      setError('');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load saved places';
      setError(errorMsg);
      console.error('Error loading saved places:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (placeId: string) => {
    try {
      await unsavePlace(placeId);
      setPlaces(places.filter(p => p.id !== placeId));
      setError('');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to remove place';
      setError(errorMsg);
      setTimeout(() => setError(''), 3000);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <View style={styles.iconHeader}>
            <Bookmark size={32} color="#2563eb" strokeWidth={2} />
          </View>
          <Text style={styles.title}>Saved Places</Text>
          <Text style={styles.subtitle}>
            Your favorite destinations and spots ({places.length})
          </Text>
        </View>

        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {places.length === 0 ? (
          <View style={styles.emptyState}>
            <Bookmark size={64} color="#d1d5db" strokeWidth={1.5} />
            <Text style={styles.emptyTitle}>No Saved Places Yet</Text>
            <Text style={styles.emptyText}>
              Start exploring and save your favorite places to see them here
            </Text>
          </View>
        ) : (
          <View style={styles.placesContainer}>
            {places.map((place) => (
              <View key={place.id} style={styles.card}>
                <View style={styles.cardContent}>
                  <Text style={styles.location}>{place.location}</Text>
                  <Text style={styles.placeName}>{place.place_name}</Text>
                  <Text style={styles.placeType}>{place.place_type}</Text>
                  {place.description && (
                    <Text style={styles.description}>{place.description}</Text>
                  )}
                  {place.rating && (
                    <Text style={styles.rating}>⭐ {place.rating}/5</Text>
                  )}
                  <Text style={styles.dateAdded}>
                    Saved {new Date(place.created_at).toLocaleDateString()}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleRemove(place.id)}
                >
                  <Trash2 size={20} color="#dc2626" strokeWidth={2} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
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
  iconHeader: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  errorContainer: {
    margin: 16,
    backgroundColor: '#fef2f2',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
    textAlign: 'center',
  },
  placesContainer: {
    padding: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardContent: {
    flex: 1,
  },
  location: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563eb',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  placeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  placeType: {
    fontSize: 13,
    color: '#6b7280',
    textTransform: 'capitalize',
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
    lineHeight: 20,
  },
  rating: {
    fontSize: 13,
    color: '#f59e0b',
    fontWeight: '600',
    marginBottom: 4,
  },
  dateAdded: {
    fontSize: 12,
    color: '#9ca3af',
  },
  deleteButton: {
    padding: 8,
    marginLeft: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 48,
    marginTop: 48,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
