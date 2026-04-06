import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Pressable,
  RefreshControl,
  Animated,
  Share,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { MapPin, Search, Utensils, Landmark, Activity, Bookmark, Trash, TrendingUp, Share2 } from 'lucide-react-native';
import { addSearchHistory, getSearchHistory, savePlace, isSavedBatch, clearSearchHistory, PlaceType } from '@/lib/database';
import { useFocusEffect } from '@react-navigation/native';
import Toast from '@/components/Toast';
import { PlaceCardSkeleton } from '@/components/LoadingSkeleton';
import WeatherWidget from '@/components/WeatherWidget';
import { useNetwork } from '@/contexts/NetworkContext';

type LocationData = {
  places: { name: string; description: string; rating?: number }[];
  restaurants: { name: string; cuisine: string; rating?: number }[];
  activities: { name: string; description: string }[];
  foods: { name: string; description: string }[];
};

// ── PlaceCard extracted as a stable module-level component ──────────────────
interface PlaceCardProps {
  title: string;
  description?: string;
  type: PlaceType;
  rating?: number;
  isSaved: boolean;
  location: string;
  onSave: (title: string, type: PlaceType, description?: string, rating?: number) => void;
}

const PlaceCard = React.memo(function PlaceCard({ title, description, type, rating, isSaved: isSavedProp, location, onSave }: PlaceCardProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.95, duration: 100, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
    onSave(title, type, description, rating);
  };

  const handleShare = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const ratingText = rating ? `\nRating: ⭐ ${rating}/5` : '';
      const descText = description ? `\n${description}` : '';
      await Share.share({
        message: `Check out ${title} in ${location}!${descText}${ratingText}\n\nDiscovered via Travel Discover app.`,
        title,
      });
    } catch {
      // User cancelled share – no action needed
    }
  };

  return (
    <Animated.View style={[cardStyles.card, { transform: [{ scale: scaleAnim }] }]}>
      <View style={cardStyles.cardHeader}>
        <View style={cardStyles.cardTitleContainer}>
          <Text style={cardStyles.cardTitle}>{title}</Text>
          {rating ? <Text style={cardStyles.rating}>⭐ {rating}/5</Text> : null}
        </View>
        <View style={cardStyles.cardActions}>
          <TouchableOpacity onPress={handleShare} style={cardStyles.actionButton}>
            <Share2 size={18} color="#6b7280" strokeWidth={2} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handlePress} style={cardStyles.actionButton}>
            <Bookmark
              size={20}
              color={isSavedProp ? '#2563eb' : '#d1d5db'}
              strokeWidth={2}
              fill={isSavedProp ? '#2563eb' : 'none'}
            />
          </TouchableOpacity>
        </View>
      </View>
      <Text style={cardStyles.cardDescription}>{description}</Text>
    </Animated.View>
  );
});

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  cardTitleContainer: {
    flex: 1,
    marginRight: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  rating: {
    fontSize: 13,
    color: '#f59e0b',
    fontWeight: '600',
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f9fafb',
  },
  cardDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
});

export default function DiscoverScreen() {
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<LocationData | null>(null);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [savedPlaces, setSavedPlaces] = useState<Set<string>>(new Set());
  const [showHistory, setShowHistory] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'info' as 'success' | 'error' | 'info' });
  const { isOnline } = useNetwork();

  useFocusEffect(
    useCallback(() => {
      loadSearchHistory();
    }, [])
  );

  const loadSearchHistory = async () => {
    try {
      const history = await getSearchHistory();
      setSearchHistory(history);
    } catch (err) {
      console.error('Failed to load search history:', err);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await loadSearchHistory();
    setRefreshing(false);
    setToast({ visible: true, message: 'Refreshed!', type: 'success' });
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ visible: true, message, type });
  };

  const handleSearch = async (locationOverride?: string) => {
    const trimmedLocation = (locationOverride ?? location).trim();

    if (!trimmedLocation) {
      setError('Please enter a location');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    if (trimmedLocation.length > 100) {
      setError('Location must be less than 100 characters');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    if (!isOnline) {
      setError('You\'re offline. Connect to the internet to discover new places.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      showToast('No internet connection', 'error');
      return;
    }

    setLoading(true);
    setError('');
    setShowHistory(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      if (!process.env.EXPO_PUBLIC_SUPABASE_URL || !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
        throw new Error('Missing Supabase configuration');
      }

      await addSearchHistory(trimmedLocation);

      const apiUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/discover-location`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ location: trimmedLocation }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch location data (${response.status})`);
      }

      const data = await response.json();

      if (!data || typeof data !== 'object') {
        throw new Error('Invalid response format from server');
      }

      setResults(data);
      loadSearchHistory();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast(`Found ${(data.places?.length || 0) + (data.restaurants?.length || 0)} results!`, 'success');

      // Batch check saved status — single DB call instead of N separate calls
      const allPlaceNames = [
        ...(data.places || []).map((p: { name: string }) => p.name),
        ...(data.restaurants || []).map((r: { name: string }) => r.name),
        ...(data.activities || []).map((a: { name: string }) => a.name),
        ...(data.foods || []).map((f: { name: string }) => f.name),
      ].filter(Boolean);
      const savedSet = await isSavedBatch(allPlaceNames, trimmedLocation);
      setSavedPlaces(savedSet);
    } catch (err) {
      let errorMsg = 'Something went wrong';
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          errorMsg = 'Request timed out. Please try again.';
        } else {
          errorMsg = err.message;
        }
      }
      setError(errorMsg);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showToast(errorMsg, 'error');
      setTimeout(() => setError(''), 5000);
    } finally {
      setLoading(false);
    }
  };

  const handleSavePlace = async (placeName: string, placeType: PlaceType, description?: string, rating?: number) => {
    if (!placeName?.trim() || !placeType?.trim()) {
      setError('Invalid place information');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setTimeout(() => setError(''), 3000);
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await savePlace(placeName, placeType, location, description, rating);
      setSavedPlaces(prev => new Set(prev).add(placeName));
      showToast('Place saved successfully!', 'success');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to save place';
      if (errorMsg === 'This place is already saved') {
        setSavedPlaces(prev => new Set(prev).add(placeName));
        showToast('Already saved', 'info');
      } else {
        setError(errorMsg);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        showToast(errorMsg, 'error');
        setTimeout(() => setError(''), 3000);
      }
    }
  };

  const handleQuickSearch = (loc: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLocation(loc);
    setShowHistory(false);
    handleSearch(loc);
  };

  const handleClearHistory = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await clearSearchHistory();
      setSearchHistory([]);
      setShowHistory(false);
      showToast('Search history cleared', 'success');
    } catch (err) {
      console.error('Failed to clear history:', err);
      showToast('Failed to clear history', 'error');
    }
  };

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
        keyboardShouldPersistTaps="handled"
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
            <MapPin size={32} color="#2563eb" strokeWidth={2} />
          </View>
          <Text style={styles.title}>Discover Places</Text>
          <Text style={styles.subtitle}>
            Find amazing destinations and experiences
          </Text>
        </View>

        <View style={styles.searchContainer}>
          <View style={styles.inputWrapper}>
            <Search
              size={20}
              color="#6b7280"
              strokeWidth={2}
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="Enter location or city name..."
              placeholderTextColor="#9ca3af"
              value={location}
              onChangeText={setLocation}
              onSubmitEditing={() => handleSearch()}
              onFocus={() => searchHistory.length > 0 && setShowHistory(true)}
              editable={!loading}
            />
          </View>

          <TouchableOpacity
            style={[styles.searchButton, loading && styles.buttonDisabled]}
            onPress={() => handleSearch()}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={styles.searchButtonText}>Search</Text>
            )}
          </TouchableOpacity>
        </View>

        {showHistory && searchHistory.length > 0 && (
          <View style={styles.historyContainer}>
            <View style={styles.historyHeader}>
              <Text style={styles.historyTitle}>Recent Searches</Text>
              <TouchableOpacity onPress={handleClearHistory}>
                <Trash size={16} color="#9ca3af" strokeWidth={2} />
              </TouchableOpacity>
            </View>
            {searchHistory.map((item, index) => (
              <Pressable
                key={index}
                style={styles.historyItem}
                onPress={() => handleQuickSearch(item)}
              >
                <Search size={16} color="#6b7280" strokeWidth={2} />
                <Text style={styles.historyText}>{item}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.resultsContainer}>
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Landmark size={24} color="#2563eb" strokeWidth={2} />
                <Text style={styles.sectionTitle}>Loading...</Text>
              </View>
              <PlaceCardSkeleton />
              <PlaceCardSkeleton />
              <PlaceCardSkeleton />
            </View>
          </View>
        ) : results ? (
          <View style={styles.resultsContainer}>
            <WeatherWidget location={location} />
            {results.places.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Landmark size={24} color="#2563eb" strokeWidth={2} />
                  <Text style={styles.sectionTitle}>Famous Places</Text>
                </View>
                {results.places.map((place, index) => (
                  <PlaceCard
                    key={`place-${index}`}
                    title={place.name}
                    description={place.description}
                    type="place"
                    rating={place.rating}
                    isSaved={savedPlaces.has(place.name)}
                    location={location}
                    onSave={handleSavePlace}
                  />
                ))}
              </View>
            )}

            {results.restaurants.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Utensils size={24} color="#2563eb" strokeWidth={2} />
                  <Text style={styles.sectionTitle}>Restaurants</Text>
                </View>
                {results.restaurants.map((restaurant, index) => (
                  <PlaceCard
                    key={`restaurant-${index}`}
                    title={restaurant.name}
                    description={restaurant.cuisine}
                    type="restaurant"
                    rating={restaurant.rating}
                    isSaved={savedPlaces.has(restaurant.name)}
                    location={location}
                    onSave={handleSavePlace}
                  />
                ))}
              </View>
            )}

            {results.activities.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Activity size={24} color="#2563eb" strokeWidth={2} />
                  <Text style={styles.sectionTitle}>Activities</Text>
                </View>
                {results.activities.map((activity, index) => (
                  <PlaceCard
                    key={`activity-${index}`}
                    title={activity.name}
                    description={activity.description}
                    type="activity"
                    isSaved={savedPlaces.has(activity.name)}
                    location={location}
                    onSave={handleSavePlace}
                  />
                ))}
              </View>
            )}

            {results.foods.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Utensils size={24} color="#2563eb" strokeWidth={2} />
                  <Text style={styles.sectionTitle}>Special Foods to Try</Text>
                </View>
                {results.foods.map((food, index) => (
                  <PlaceCard
                    key={`food-${index}`}
                    title={food.name}
                    description={food.description}
                    type="food"
                    isSaved={savedPlaces.has(food.name)}
                    location={location}
                    onSave={handleSavePlace}
                  />
                ))}
              </View>
            )}
          </View>
        ) : !loading && (
          <View style={styles.emptyState}>
            <MapPin size={64} color="#d1d5db" strokeWidth={1.5} />
            <Text style={styles.emptyTitle}>Start Exploring</Text>
            <Text style={styles.emptyText}>
              Enter a location to discover amazing places, restaurants, and
              activities
            </Text>
            
            <View style={styles.trendingSection}>
              <View style={styles.trendingSectionHeader}>
                <TrendingUp size={20} color="#2563eb" strokeWidth={2} />
                <Text style={styles.trendingTitle}>Popular Destinations</Text>
              </View>
              <View style={styles.trendingGrid}>
                {['Paris', 'Tokyo', 'New York', 'London', 'Dubai', 'Barcelona'].map((city) => (
                  <TouchableOpacity
                    key={city}
                    style={styles.trendingChip}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setLocation(city);
                      setShowHistory(false);
                      handleSearch(city);
                    }}
                  >
                    <MapPin size={16} color="#2563eb" strokeWidth={2} />
                    <Text style={styles.trendingChipText}>{city}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
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
  searchContainer: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    padding: 12,
    fontSize: 16,
    color: '#111827',
  },
  searchButton: {
    backgroundColor: '#2563eb',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  searchButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  historyContainer: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  historyTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9ca3af',
    textTransform: 'uppercase',
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  historyText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
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
  resultsContainer: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
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
  trendingSection: {
    marginTop: 32,
    width: '100%',
    paddingHorizontal: 16,
  },
  trendingSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    justifyContent: 'center',
  },
  trendingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  trendingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  trendingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  trendingChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563eb',
  },
});
