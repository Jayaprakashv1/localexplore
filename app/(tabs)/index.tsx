import React, { useState, useEffect } from 'react';
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
  FlatList,
} from 'react-native';
import { MapPin, Search, Utensils, Landmark, Activity, Bookmark, X, Trash } from 'lucide-react-native';
import { addSearchHistory, getSearchHistory, savePlace, isSaved, getSavedPlacesByLocation, clearSearchHistory } from '@/lib/database';

type LocationData = {
  places: Array<{ name: string; description: string; rating?: number }>;
  restaurants: Array<{ name: string; cuisine: string; rating?: number }>;
  activities: Array<{ name: string; description: string }>;
  foods: Array<{ name: string; description: string }>;
};

export default function DiscoverScreen() {
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<LocationData | null>(null);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [savedPlaces, setSavedPlaces] = useState<Set<string>>(new Set());
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    loadSearchHistory();
  }, []);

  const loadSearchHistory = async () => {
    try {
      const history = await getSearchHistory();
      setSearchHistory(history);
    } catch (err) {
      console.error('Failed to load search history:', err);
    }
  };

  const handleSearch = async () => {
    const trimmedLocation = location.trim();

    if (!trimmedLocation) {
      setError('Please enter a location');
      return;
    }

    if (trimmedLocation.length > 100) {
      setError('Location must be less than 100 characters');
      return;
    }

    setLoading(true);
    setError('');
    setShowHistory(false);

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

      const newSavedPlaces = new Set<string>();
      const places = [...(data.places || []), ...(data.restaurants || []), ...(data.activities || []), ...(data.foods || [])];
      for (const place of places) {
        if (place?.name && await isSaved(place.name, trimmedLocation)) {
          newSavedPlaces.add(place.name);
        }
      }
      setSavedPlaces(newSavedPlaces);
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
      setTimeout(() => setError(''), 5000);
    } finally {
      setLoading(false);
    }
  };

  const handleSavePlace = async (placeName: string, placeType: string, description?: string, rating?: number) => {
    if (!placeName?.trim() || !placeType?.trim()) {
      setError('Invalid place information');
      setTimeout(() => setError(''), 3000);
      return;
    }

    try {
      await savePlace(placeName, placeType as any, location, description, rating);
      setSavedPlaces(prev => new Set(prev).add(placeName));
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to save place';
      if (errorMsg === 'This place is already saved') {
        setSavedPlaces(prev => new Set(prev).add(placeName));
      } else {
        setError(errorMsg);
        setTimeout(() => setError(''), 3000);
      }
    }
  };

  const handleQuickSearch = (loc: string) => {
    setLocation(loc);
    setTimeout(() => {
      setLocation(loc);
      setShowHistory(false);
    }, 50);
  };

  const handleClearHistory = async () => {
    try {
      await clearSearchHistory();
      setSearchHistory([]);
      setShowHistory(false);
    } catch (err) {
      console.error('Failed to clear history:', err);
    }
  };

  const PlaceCard = ({ title, description, type, rating }: any) => {
    const isSavedPlace = savedPlaces.has(title);
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleContainer}>
            <Text style={styles.cardTitle}>{title}</Text>
            {rating && <Text style={styles.rating}>⭐ {rating}/5</Text>}
          </View>
          <TouchableOpacity
            onPress={() => handleSavePlace(title, type, description, rating)}
            style={styles.saveButton}
          >
            <Bookmark
              size={20}
              color={isSavedPlace ? '#2563eb' : '#d1d5db'}
              strokeWidth={2}
              fill={isSavedPlace ? '#2563eb' : 'none'}
            />
          </TouchableOpacity>
        </View>
        <Text style={styles.cardDescription}>{description}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} keyboardShouldPersistTaps="handled">
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
              onSubmitEditing={handleSearch}
              onFocus={() => searchHistory.length > 0 && setShowHistory(true)}
              editable={!loading}
            />
          </View>

          <TouchableOpacity
            style={[styles.searchButton, loading && styles.buttonDisabled]}
            onPress={handleSearch}
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

        {results ? (
          <View style={styles.resultsContainer}>
            {results.places.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Landmark size={24} color="#2563eb" strokeWidth={2} />
                  <Text style={styles.sectionTitle}>Famous Places</Text>
                </View>
                {results.places.map((place, index) => (
                  <PlaceCard
                    key={index}
                    title={place.name}
                    description={place.description}
                    type="place"
                    rating={place.rating}
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
                    key={index}
                    title={restaurant.name}
                    description={restaurant.cuisine}
                    type="restaurant"
                    rating={restaurant.rating}
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
                    key={index}
                    title={activity.name}
                    description={activity.description}
                    type="activity"
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
                    key={index}
                    title={food.name}
                    description={food.description}
                    type="food"
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
  card: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  cardTitleContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  rating: {
    fontSize: 14,
    color: '#f59e0b',
    fontWeight: '600',
  },
  saveButton: {
    padding: 8,
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
});
