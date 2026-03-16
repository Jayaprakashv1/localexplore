import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Share,
  Linking,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Bookmark, Trash2, Share2, Navigation } from 'lucide-react-native';
import { getSavedPlaces, unsavePlace, SavedPlace } from '@/lib/database';
import { useFocusEffect } from '@react-navigation/native';
import Toast from '@/components/Toast';
import { PlaceCardSkeleton } from '@/components/LoadingSkeleton';
import { Swipeable } from 'react-native-gesture-handler';

export default function SavedScreen() {
  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'info' as 'success' | 'error' | 'info' });
  const [filter, setFilter] = useState<string>('all');

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

  const onRefresh = async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await loadSavedPlaces();
    setRefreshing(false);
    showToast('Refreshed!', 'success');
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ visible: true, message, type });
  };

  const handleRemovePlace = async (placeId: string, placeName: string) => {
    if (!placeId?.trim()) {
      setError('Invalid place ID');
      setTimeout(() => setError(''), 3000);
      return;
    }

    Alert.alert(
      'Remove Place',
      `Are you sure you want to remove "${placeName}" from saved places?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              await unsavePlace(placeId);
              setPlaces(places.filter(p => p.id !== placeId));
              showToast('Place removed successfully', 'success');
              setError('');
            } catch (err) {
              const errorMsg = err instanceof Error ? err.message : 'Failed to remove place';
              setError(errorMsg);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              showToast(errorMsg, 'error');
              setTimeout(() => setError(''), 3000);
            }
          },
        },
      ]
    );
  };

  const handleSharePlace = async (place: SavedPlace) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const ratingText = place.rating ? `\nRating: ⭐ ${place.rating}/5` : '';
      const descText = place.description ? `\n${place.description}` : '';
      await Share.share({
        message: `Check out ${place.place_name} in ${place.location}!${descText}${ratingText}\n\nDiscovered via Travel Discover app.`,
        title: place.place_name,
      });
    } catch {
      // User cancelled share
    }
  };

  const handleGetDirections = (place: SavedPlace) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const query = encodeURIComponent(`${place.place_name}, ${place.location}`);
    const url = Platform.select({
      ios: `maps:0,0?q=${query}`,
      android: `geo:0,0?q=${query}`,
      default: `https://www.google.com/maps/search/?api=1&query=${query}`,
    }) as string;
    Linking.openURL(url).catch(() => {
      showToast('Could not open Maps', 'error');
    });
  };


  const renderRightActions = (placeId: string, placeName: string) => {
    return (
      <TouchableOpacity
        style={styles.swipeDeleteButton}
        onPress={() => handleRemovePlace(placeId, placeName)}
      >
        <Trash2 size={24} color="#ffffff" strokeWidth={2} />
        <Text style={styles.swipeDeleteText}>Delete</Text>
      </TouchableOpacity>
    );
  };

  const filteredPlaces = filter === 'all' 
    ? places 
    : places.filter(p => p.place_type === filter);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.iconHeader}>
            <Bookmark size={32} color="#2563eb" strokeWidth={2} />
          </View>
          <Text style={styles.title}>Saved Places</Text>
          <Text style={styles.subtitle}>Loading your favorites...</Text>
        </View>
        <View style={styles.placesContainer}>
          <PlaceCardSkeleton />
          <PlaceCardSkeleton />
          <PlaceCardSkeleton />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Toast
        message={toast.message}
        type={toast.type}
        visible={toast.visible}
        onHide={() => setToast({ ...toast, visible: false })}
      />
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#2563eb"
            colors={['#2563eb']}
          />
        }
      >
        <View style={styles.header}>
          <View style={styles.iconHeader}>
            <Bookmark size={32} color="#2563eb" strokeWidth={2} />
          </View>
          <Text style={styles.title}>Saved Places</Text>
          <Text style={styles.subtitle}>
            Your favorite destinations and spots ({filteredPlaces.length})
          </Text>
        </View>

        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {places.length > 0 && (
          <View style={styles.filterContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <TouchableOpacity
                style={[styles.filterChip, filter === 'all' && styles.filterChipActive]}
                onPress={() => {
                  setFilter('all');
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
                  All ({places.length})
                </Text>
              </TouchableOpacity>
              {['place', 'restaurant', 'activity', 'food'].map((type) => {
                const count = places.filter(p => p.place_type === type).length;
                if (count === 0) return null;
                return (
                  <TouchableOpacity
                    key={type}
                    style={[styles.filterChip, filter === type && styles.filterChipActive]}
                    onPress={() => {
                      setFilter(type);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                  >
                    <Text style={[styles.filterText, filter === type && styles.filterTextActive]}>
                      {type.charAt(0).toUpperCase() + type.slice(1)} ({count})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

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
            {filteredPlaces.map((place) => (
              <Swipeable
                key={place.id}
                renderRightActions={() => renderRightActions(place.id, place.place_name)}
                overshootRight={false}
                onSwipeableOpen={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
              >
                <View style={styles.card}>
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
                    <View style={styles.cardActionsRow}>
                      <TouchableOpacity
                        style={styles.cardActionButton}
                        onPress={() => handleGetDirections(place)}
                      >
                        <Navigation size={14} color="#2563eb" strokeWidth={2} />
                        <Text style={styles.cardActionText}>Directions</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.cardActionButton}
                        onPress={() => handleSharePlace(place)}
                      >
                        <Share2 size={14} color="#2563eb" strokeWidth={2} />
                        <Text style={styles.cardActionText}>Share</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleRemovePlace(place.id, place.place_name)}
                  >
                    <Trash2 size={20} color="#dc2626" strokeWidth={2} />
                  </TouchableOpacity>
                </View>
              </Swipeable>
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
  cardActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  cardActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  cardActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563eb',
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
  swipeDeleteButton: {
    backgroundColor: '#dc2626',
    justifyContent: 'center',
    alignItems: 'center',
    width: 100,
    borderRadius: 12,
    marginBottom: 12,
    marginLeft: 8,
  },
  swipeDeleteText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  filterContainer: {
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  filterTextActive: {
    color: '#ffffff',
  },
});
