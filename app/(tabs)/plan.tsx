import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Switch,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Alert,
  Modal,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Map, Plus, Trash2, ChevronDown, ChevronUp, Calendar, MapPin, X, Users, Globe, Lock, Check, XCircle } from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  createTrip,
  getTrips,
  deleteTrip,
  getTripItems,
  addTripItem,
  removeTripItem,
  getSavedPlaces,
  getTripMembers,
  approveJoinRequest,
  rejectJoinRequest,
  updateTripVisibility,
  Trip,
  TripItem,
  TripMember,
  SavedPlace,
} from '@/lib/database';
import Toast from '@/components/Toast';
import { PlaceCardSkeleton } from '@/components/LoadingSkeleton';

const PLACE_TYPE_EMOJI: Record<string, string> = {
  place: '🏛️',
  restaurant: '🍽️',
  activity: '🎯',
  food: '🍜',
};

export default function PlanScreen() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedTripId, setExpandedTripId] = useState<string | null>(null);
  const [tripItems, setTripItems] = useState<Record<string, TripItem[]>>({});
  const [loadingItems, setLoadingItems] = useState<Record<string, boolean>>({});
  const [tripMembers, setTripMembers] = useState<Record<string, TripMember[]>>({});
  const [toast, setToast] = useState({ visible: false, message: '', type: 'info' as 'success' | 'error' | 'info' });

  // New trip modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDestination, setNewDestination] = useState('');
  const [newStartDate, setNewStartDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');
  const [newIsPublic, setNewIsPublic] = useState(false);
  const [creating, setCreating] = useState(false);

  // Add-places modal state
  const [addPlacesModal, setAddPlacesModal] = useState(false);
  const [activeTripId, setActiveTripId] = useState<string | null>(null);
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);

  const loadTrips = useCallback(async () => {
    setLoading(true);
    // Clear item/member caches so re-expanded trips always show fresh data
    setTripItems({});
    setTripMembers({});
    setLoadingItems({});
    setExpandedTripId(null);
    try {
      const data = await getTrips();
      setTrips(data);
    } catch {
      setToast({ visible: true, message: 'Failed to load trips', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadTrips();
    }, [loadTrips])
  );

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ visible: true, message, type });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await loadTrips();
    setRefreshing(false);
    showToast('Refreshed!', 'success');
  };

  const toggleExpand = async (tripId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (expandedTripId === tripId) {
      setExpandedTripId(null);
      return;
    }
    setExpandedTripId(tripId);
    if (!tripItems[tripId]) {
      // First expand — load items and members together
      setLoadingItems(prev => ({ ...prev, [tripId]: true }));
      try {
        const [items, members] = await Promise.all([
          getTripItems(tripId),
          getTripMembers(tripId),
        ]);
        setTripItems(prev => ({ ...prev, [tripId]: items }));
        setTripMembers(prev => ({ ...prev, [tripId]: members }));
      } catch {
        showToast('Failed to load trip details', 'error');
      } finally {
        setLoadingItems(prev => ({ ...prev, [tripId]: false }));
      }
    } else {
      // Re-expand — items are cached; refresh members to pick up new join requests
      reloadMembers(tripId);
    }
  };

  const reloadMembers = async (tripId: string) => {
    try {
      const members = await getTripMembers(tripId);
      setTripMembers(prev => ({ ...prev, [tripId]: members }));
    } catch {
      showToast('Failed to refresh members', 'error');
    }
  };

  const handleCreateTrip = async () => {
    if (!newTitle.trim() || !newDestination.trim()) {
      showToast('Trip title and destination are required', 'error');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    setCreating(true);
    try {
      const trip = await createTrip(
        newTitle.trim(),
        newDestination.trim(),
        newStartDate.trim() || undefined,
        newEndDate.trim() || undefined,
        newIsPublic
      );
      setTrips(prev => [trip, ...prev]);
      setModalVisible(false);
      setNewTitle('');
      setNewDestination('');
      setNewStartDate('');
      setNewEndDate('');
      setNewIsPublic(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast('Trip created!', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create trip';
      showToast(msg, 'error');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteTrip = (tripId: string, tripTitle: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Delete Trip',
      `Delete "${tripTitle}"? This will also remove all places in this trip.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTrip(tripId);
              setTrips(prev => prev.filter(t => t.id !== tripId));
              if (expandedTripId === tripId) setExpandedTripId(null);
              // Clean up cached data for the deleted trip
              setTripItems(prev => { const n = { ...prev }; delete n[tripId]; return n; });
              setTripMembers(prev => { const n = { ...prev }; delete n[tripId]; return n; });
              setLoadingItems(prev => { const n = { ...prev }; delete n[tripId]; return n; });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              showToast('Trip deleted', 'success');
            } catch {
              showToast('Failed to delete trip', 'error');
            }
          },
        },
      ]
    );
  };

  const handleRemoveItem = async (tripId: string, itemId: string, itemName: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Remove Place', `Remove "${itemName}" from this trip?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeTripItem(itemId);
            setTripItems(prev => ({
              ...prev,
              [tripId]: (prev[tripId] || []).filter(i => i.id !== itemId),
            }));
            showToast('Place removed', 'success');
          } catch {
            showToast('Failed to remove place', 'error');
          }
        },
      },
    ]);
  };

  const openAddPlaces = async (tripId: string) => {
    setActiveTripId(tripId);
    setAddPlacesModal(true);
    setLoadingSaved(true);
    try {
      const places = await getSavedPlaces();
      setSavedPlaces(places);
    } catch {
      showToast('Failed to load saved places', 'error');
    } finally {
      setLoadingSaved(false);
    }
  };

  const handleAddToTrip = async (place: SavedPlace) => {
    if (!activeTripId) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await addTripItem(
        activeTripId,
        place.place_name,
        place.place_type,
        place.location,
        place.description,
        place.rating
      );
      const items = await getTripItems(activeTripId);
      setTripItems(prev => ({ ...prev, [activeTripId]: items }));
      showToast(`${place.place_name} added to trip!`, 'success');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to add place';
      showToast(msg, 'info');
    }
  };

  const handleApproveRequest = async (tripId: string, memberId: string, email: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await approveJoinRequest(memberId);
      // Update local state only after successful API call
      setTripMembers(prev => ({
        ...prev,
        [tripId]: (prev[tripId] || []).map(m =>
          m.id === memberId ? { ...m, status: 'approved' as const } : m
        ),
      }));
      setTrips(prev =>
        prev.map(t => t.id === tripId ? { ...t, member_count: t.member_count + 1 } : t)
      );
      showToast(`${email} approved!`, 'success');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Re-fetch members to ensure server state matches local state
      reloadMembers(tripId);
    } catch {
      showToast('Failed to approve request', 'error');
    }
  };

  const handleRejectRequest = async (tripId: string, memberId: string, email: string) => {
    Alert.alert('Reject Request', `Reject join request from ${email}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: async () => {
          try {
            await rejectJoinRequest(memberId);
            setTripMembers(prev => ({
              ...prev,
              [tripId]: (prev[tripId] || []).map(m =>
                m.id === memberId ? { ...m, status: 'rejected' as const } : m
              ),
            }));
            showToast('Request rejected', 'info');
            // Re-fetch members to ensure server state matches local state
            reloadMembers(tripId);
          } catch {
            showToast('Failed to reject request', 'error');
          }
        },
      },
    ]);
  };

  const handleToggleVisibility = async (trip: Trip) => {
    const newVisibility = !trip.is_public;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await updateTripVisibility(trip.id, newVisibility);
      setTrips(prev =>
        prev.map(t => t.id === trip.id ? { ...t, is_public: newVisibility } : t)
      );
      showToast(newVisibility ? 'Trip is now public' : 'Trip is now private', 'success');
    } catch {
      showToast('Failed to update visibility', 'error');
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null;
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <SafeAreaView style={styles.container}>
      <Toast
        message={toast.message}
        type={toast.type}
        visible={toast.visible}
        onHide={() => setToast(prev => ({ ...prev, visible: false }))}
      />

      {/* Create Trip Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Trip</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={24} color="#6b7280" strokeWidth={2} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Trip Title *</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Summer in Tokyo"
              placeholderTextColor="#9ca3af"
              value={newTitle}
              onChangeText={setNewTitle}
              maxLength={100}
            />

            <Text style={styles.inputLabel}>Destination *</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Tokyo, Japan"
              placeholderTextColor="#9ca3af"
              value={newDestination}
              onChangeText={setNewDestination}
              maxLength={100}
            />

            <Text style={styles.inputLabel}>Start Date (optional)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#9ca3af"
              value={newStartDate}
              onChangeText={setNewStartDate}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
            />

            <Text style={styles.inputLabel}>End Date (optional)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#9ca3af"
              value={newEndDate}
              onChangeText={setNewEndDate}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
            />

            <View style={styles.visibilityRow}>
              <View style={styles.visibilityLeft}>
                {newIsPublic ? (
                  <Globe size={18} color="#2563eb" strokeWidth={2} />
                ) : (
                  <Lock size={18} color="#6b7280" strokeWidth={2} />
                )}
                <View>
                  <Text style={styles.visibilityLabel}>
                    {newIsPublic ? 'Public Trip' : 'Private Trip'}
                  </Text>
                  <Text style={styles.visibilityHint}>
                    {newIsPublic
                      ? 'Others can discover and request to join'
                      : 'Only visible to you'}
                  </Text>
                </View>
              </View>
              <Switch
                value={newIsPublic}
                onValueChange={setNewIsPublic}
                trackColor={{ false: '#e5e7eb', true: '#bfdbfe' }}
                thumbColor={newIsPublic ? '#2563eb' : '#9ca3af'}
              />
            </View>

            <TouchableOpacity
              style={[styles.createButton, creating && styles.buttonDisabled]}
              onPress={handleCreateTrip}
              disabled={creating}
            >
              {creating ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.createButtonText}>Create Trip</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add Places Modal */}
      <Modal visible={addPlacesModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.addPlacesModal]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add from Saved Places</Text>
              <TouchableOpacity onPress={() => setAddPlacesModal(false)}>
                <X size={24} color="#6b7280" strokeWidth={2} />
              </TouchableOpacity>
            </View>
            {loadingSaved ? (
              <View style={styles.loadingCenter}>
                <ActivityIndicator color="#2563eb" />
              </View>
            ) : savedPlaces.length === 0 ? (
              <View style={styles.loadingCenter}>
                <Text style={styles.emptyText}>
                  No saved places yet. Discover and save places first!
                </Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {savedPlaces.map(place => (
                  <TouchableOpacity
                    key={place.id}
                    style={styles.savedPlaceRow}
                    onPress={() => handleAddToTrip(place)}
                  >
                    <Text style={styles.savedPlaceEmoji}>
                      {PLACE_TYPE_EMOJI[place.place_type] || '📍'}
                    </Text>
                    <View style={styles.savedPlaceInfo}>
                      <Text style={styles.savedPlaceName}>{place.place_name}</Text>
                      <Text style={styles.savedPlaceLocation}>{place.location}</Text>
                    </View>
                    <Plus size={18} color="#2563eb" strokeWidth={2} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

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
            <Map size={32} color="#2563eb" strokeWidth={2} />
          </View>
          <Text style={styles.title}>Trip Planner</Text>
          <Text style={styles.subtitle}>Organize your travel itineraries</Text>
        </View>

        <View style={styles.addTripRow}>
          <TouchableOpacity
            style={styles.addTripButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setModalVisible(true);
            }}
          >
            <Plus size={20} color="#ffffff" strokeWidth={2} />
            <Text style={styles.addTripButtonText}>New Trip</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.body}>
            <PlaceCardSkeleton />
            <PlaceCardSkeleton />
          </View>
        ) : trips.length === 0 ? (
          <View style={styles.emptyState}>
            <Map size={64} color="#d1d5db" strokeWidth={1.5} />
            <Text style={styles.emptyTitle}>No Trips Yet</Text>
            <Text style={styles.emptyText}>
              Create your first trip to start planning your next adventure!
            </Text>
          </View>
        ) : (
          <View style={styles.body}>
            {trips.map(trip => {
              const expanded = expandedTripId === trip.id;
              const items = tripItems[trip.id] || [];
              const isLoadingItems = loadingItems[trip.id];
              const members = tripMembers[trip.id] || [];
              const pendingRequests = members.filter(m => m.status === 'pending');
              const approvedMembers = members.filter(m => m.status === 'approved');

              return (
                <View key={trip.id} style={styles.tripCard}>
                  {/* Trip header */}
                  <Pressable style={styles.tripHeader} onPress={() => toggleExpand(trip.id)}>
                    <View style={styles.tripHeaderLeft}>
                      <View style={styles.tripTitleRow}>
                        <Text style={styles.tripTitle}>{trip.title}</Text>
                        <View style={[styles.visibilityBadge, trip.is_public ? styles.publicBadge : styles.privateBadge]}>
                          {trip.is_public ? (
                            <Globe size={10} color="#1d4ed8" strokeWidth={2} />
                          ) : (
                            <Lock size={10} color="#6b7280" strokeWidth={2} />
                          )}
                          <Text style={[styles.visibilityBadgeText, trip.is_public ? styles.publicBadgeText : styles.privateBadgeText]}>
                            {trip.is_public ? 'Public' : 'Private'}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.tripMeta}>
                        <MapPin size={14} color="#6b7280" strokeWidth={2} />
                        <Text style={styles.tripDestination}>{trip.destination}</Text>
                      </View>
                      {(trip.start_date || trip.end_date) && (
                        <View style={styles.tripMeta}>
                          <Calendar size={14} color="#6b7280" strokeWidth={2} />
                          <Text style={styles.tripDates}>
                            {formatDate(trip.start_date) ?? '?'}
                            {trip.end_date ? ` → ${formatDate(trip.end_date)}` : ''}
                          </Text>
                        </View>
                      )}
                      {trip.is_public && (
                        <View style={styles.tripMeta}>
                          <Users size={13} color="#6b7280" strokeWidth={2} />
                          <Text style={styles.tripDestination}>
                            {trip.member_count} member{trip.member_count !== 1 ? 's' : ''}
                            {pendingRequests.length > 0 && expanded
                              ? ` · ${pendingRequests.length} pending`
                              : ''}
                          </Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.tripHeaderRight}>
                      <TouchableOpacity
                        onPress={() => handleDeleteTrip(trip.id, trip.title)}
                        style={styles.deleteIcon}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Trash2 size={18} color="#dc2626" strokeWidth={2} />
                      </TouchableOpacity>
                      {expanded ? (
                        <ChevronUp size={20} color="#6b7280" strokeWidth={2} />
                      ) : (
                        <ChevronDown size={20} color="#6b7280" strokeWidth={2} />
                      )}
                    </View>
                  </Pressable>

                  {/* Trip body (expanded) */}
                  {expanded && (
                    <View style={styles.tripBody}>
                      {/* Visibility toggle */}
                      <View style={styles.visibilityToggleRow}>
                        <View style={styles.visibilityLeft}>
                          {trip.is_public ? (
                            <Globe size={15} color="#2563eb" strokeWidth={2} />
                          ) : (
                            <Lock size={15} color="#6b7280" strokeWidth={2} />
                          )}
                          <Text style={styles.visibilityToggleLabel}>
                            {trip.is_public ? 'Public — visible in Feed' : 'Private — only you'}
                          </Text>
                        </View>
                        <Switch
                          value={trip.is_public}
                          onValueChange={() => handleToggleVisibility(trip)}
                          trackColor={{ false: '#e5e7eb', true: '#bfdbfe' }}
                          thumbColor={trip.is_public ? '#2563eb' : '#9ca3af'}
                        />
                      </View>

                      {/* Trip items */}
                      {isLoadingItems ? (
                        <ActivityIndicator color="#2563eb" style={{ marginVertical: 12 }} />
                      ) : items.length === 0 ? (
                        <Text style={styles.noItemsText}>
                          No places added yet. Tap below to add places!
                        </Text>
                      ) : (
                        items.map((item, idx) => (
                          <View key={item.id} style={styles.tripItem}>
                            <View style={styles.tripItemIndex}>
                              <Text style={styles.tripItemIndexText}>{idx + 1}</Text>
                            </View>
                            <View style={styles.tripItemBody}>
                              <Text style={styles.tripItemEmoji}>
                                {PLACE_TYPE_EMOJI[item.place_type] || '📍'}
                                {'  '}
                                <Text style={styles.tripItemName}>{item.place_name}</Text>
                              </Text>
                              {item.description ? (
                                <Text style={styles.tripItemDesc} numberOfLines={2}>
                                  {item.description}
                                </Text>
                              ) : null}
                              {item.rating ? (
                                <Text style={styles.tripItemRating}>⭐ {item.rating}/5</Text>
                              ) : null}
                            </View>
                            <TouchableOpacity
                              onPress={() => handleRemoveItem(trip.id, item.id, item.place_name)}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <X size={16} color="#9ca3af" strokeWidth={2} />
                            </TouchableOpacity>
                          </View>
                        ))
                      )}
                      <TouchableOpacity
                        style={styles.addPlacesButton}
                        onPress={() => openAddPlaces(trip.id)}
                      >
                        <Plus size={16} color="#2563eb" strokeWidth={2} />
                        <Text style={styles.addPlacesButtonText}>Add from Saved Places</Text>
                      </TouchableOpacity>

                      {/* Members section (only for public trips) */}
                      {trip.is_public && !isLoadingItems && (
                        <View style={styles.membersSection}>
                          <View style={styles.membersSectionTitleRow}>
                            <Users size={14} color="#374151" strokeWidth={2} />
                            <Text style={styles.membersSectionTitle}>Members</Text>
                          </View>

                          {/* Pending requests */}
                          {pendingRequests.length > 0 && (
                            <View>
                              <Text style={styles.membersSubTitle}>Pending Requests</Text>
                              {pendingRequests.map(member => (
                                <View key={member.id} style={styles.memberRow}>
                                  <Text style={styles.memberEmail} numberOfLines={1}>
                                    {member.email}
                                  </Text>
                                  <View style={styles.memberActions}>
                                    <TouchableOpacity
                                      style={styles.approveBtn}
                                      onPress={() => handleApproveRequest(trip.id, member.id, member.email)}
                                    >
                                      <Check size={14} color="#16a34a" strokeWidth={2.5} />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                      style={styles.rejectBtn}
                                      onPress={() => handleRejectRequest(trip.id, member.id, member.email)}
                                    >
                                      <XCircle size={14} color="#dc2626" strokeWidth={2} />
                                    </TouchableOpacity>
                                  </View>
                                </View>
                              ))}
                            </View>
                          )}

                          {/* Approved members */}
                          {approvedMembers.length > 0 ? (
                            <View>
                              <Text style={styles.membersSubTitle}>Approved Members</Text>
                              {approvedMembers.map(member => (
                                <View key={member.id} style={styles.memberRow}>
                                  <Users size={13} color="#2563eb" strokeWidth={2} />
                                  <Text style={styles.memberEmail} numberOfLines={1}>
                                    {member.email}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          ) : pendingRequests.length === 0 ? (
                            <Text style={styles.noMembersText}>
                              No members yet. Share your trip in the Feed!
                            </Text>
                          ) : null}
                        </View>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
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
  addTripRow: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  addTripButton: {
    backgroundColor: '#2563eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    gap: 8,
  },
  addTripButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  body: {
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
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
  tripCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 12,
    overflow: 'hidden',
  },
  tripHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  tripHeaderLeft: {
    flex: 1,
    gap: 4,
  },
  tripHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tripTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  tripMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tripDestination: {
    fontSize: 14,
    color: '#6b7280',
  },
  tripDates: {
    fontSize: 13,
    color: '#6b7280',
  },
  deleteIcon: {
    padding: 4,
  },
  tripBody: {
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    padding: 12,
    gap: 8,
  },
  noItemsText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    paddingVertical: 8,
  },
  tripItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 10,
    gap: 10,
  },
  tripItemIndex: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  tripItemIndexText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563eb',
  },
  tripItemBody: {
    flex: 1,
    gap: 2,
  },
  tripItemEmoji: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  tripItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  tripItemDesc: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
  },
  tripItemRating: {
    fontSize: 12,
    color: '#f59e0b',
    fontWeight: '600',
  },
  addPlacesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dbeafe',
    borderStyle: 'dashed',
    gap: 6,
    marginTop: 4,
  },
  addPlacesButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563eb',
  },
  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
    gap: 4,
  },
  addPlacesModal: {
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginTop: 8,
    marginBottom: 4,
  },
  modalInput: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: '#111827',
    marginBottom: 4,
  },
  createButton: {
    backgroundColor: '#2563eb',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  createButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  loadingCenter: {
    padding: 32,
    alignItems: 'center',
  },
  savedPlaceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    gap: 12,
  },
  savedPlaceEmoji: {
    fontSize: 22,
  },
  savedPlaceInfo: {
    flex: 1,
  },
  savedPlaceName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  savedPlaceLocation: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  // Trip title row with visibility badge
  tripTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  visibilityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    gap: 3,
  },
  publicBadge: {
    backgroundColor: '#dbeafe',
  },
  privateBadge: {
    backgroundColor: '#f3f4f6',
  },
  visibilityBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  publicBadgeText: {
    color: '#1d4ed8',
  },
  privateBadgeText: {
    color: '#6b7280',
  },
  // Visibility toggle inside expanded body
  visibilityToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 4,
  },
  visibilityToggleLabel: {
    fontSize: 13,
    color: '#374151',
    marginLeft: 6,
  },
  // Visibility row in create modal
  visibilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginTop: 12,
  },
  visibilityLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  visibilityLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  visibilityHint: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 1,
  },
  // Members section
  membersSection: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 12,
    gap: 6,
  },
  membersSectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  membersSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
  },
  membersSubTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4,
    marginBottom: 4,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    marginBottom: 4,
    gap: 8,
  },
  memberEmail: {
    flex: 1,
    fontSize: 13,
    color: '#374151',
  },
  memberActions: {
    flexDirection: 'row',
    gap: 8,
  },
  approveBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noMembersText: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
    paddingVertical: 8,
  },
});
