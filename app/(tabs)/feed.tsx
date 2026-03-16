import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  Rss,
  MapPin,
  Calendar,
  Users,
  Globe,
  ChevronDown,
  ChevronUp,
  Clock,
  Check,
  X,
} from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  getPublicTrips,
  getTripItems,
  getTripMembers,
  requestToJoinTrip,
  cancelJoinRequest,
  PublicTrip,
  TripItem,
  TripMember,
} from '@/lib/database';
import Toast from '@/components/Toast';
import { PlaceCardSkeleton } from '@/components/LoadingSkeleton';

const PLACE_TYPE_EMOJI: Record<string, string> = {
  place: '🏛️',
  restaurant: '🍽️',
  activity: '🎯',
  food: '🍜',
};

export default function FeedScreen() {
  const [trips, setTrips] = useState<PublicTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedTripId, setExpandedTripId] = useState<string | null>(null);
  const [tripItems, setTripItems] = useState<Record<string, TripItem[]>>({});
  const [tripMembers, setTripMembers] = useState<Record<string, TripMember[]>>({});
  const [loadingDetails, setLoadingDetails] = useState<Record<string, boolean>>({});
  const [joiningTripId, setJoiningTripId] = useState<string | null>(null);
  const [toast, setToast] = useState({
    visible: false,
    message: '',
    type: 'info' as 'success' | 'error' | 'info',
  });

  const loadFeed = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getPublicTrips();
      setTrips(data);
    } catch {
      setToast({ visible: true, message: 'Failed to load feed', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadFeed();
    }, [loadFeed])
  );

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ visible: true, message, type });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await loadFeed();
    setRefreshing(false);
  };

  const toggleExpand = async (trip: PublicTrip) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const tripId = trip.id;

    if (expandedTripId === tripId) {
      setExpandedTripId(null);
      return;
    }

    setExpandedTripId(tripId);

    // Only load details if user is an approved member
    if (trip.my_status === 'approved') {
      if (!tripItems[tripId]) {
        // First expand — load items and members together
        setLoadingDetails(prev => ({ ...prev, [tripId]: true }));
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
          setLoadingDetails(prev => ({ ...prev, [tripId]: false }));
        }
      } else {
        // Re-expand — items are cached; refresh members to pick up latest approvals
        try {
          const members = await getTripMembers(tripId);
          setTripMembers(prev => ({ ...prev, [tripId]: members }));
        } catch {
          // Non-critical — silently ignore members refresh failure
        }
      }
    }
  };

  const handleRequestToJoin = async (tripId: string) => {
    setJoiningTripId(tripId);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await requestToJoinTrip(tripId);
      setTrips(prev =>
        prev.map(t => t.id === tripId ? { ...t, my_status: 'pending' } : t)
      );
      showToast('Request sent! Waiting for approval.', 'success');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send request';
      showToast(msg, 'error');
    } finally {
      setJoiningTripId(null);
    }
  };

  const handleCancelRequest = async (tripId: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await cancelJoinRequest(tripId);
      setTrips(prev =>
        prev.map(t => t.id === tripId ? { ...t, my_status: null } : t)
      );
      showToast('Request cancelled', 'info');
    } catch {
      showToast('Failed to cancel request', 'error');
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null;
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const renderStatusButton = (trip: PublicTrip) => {
    const isJoining = joiningTripId === trip.id;

    if (trip.my_status === 'approved') {
      return (
        <View style={[styles.statusBadge, styles.approvedBadge]}>
          <Check size={12} color="#16a34a" strokeWidth={2.5} />
          <Text style={[styles.statusBadgeText, styles.approvedText]}>Joined</Text>
        </View>
      );
    }

    if (trip.my_status === 'pending') {
      return (
        <View style={styles.pendingRow}>
          <View style={[styles.statusBadge, styles.pendingBadge]}>
            <Clock size={12} color="#d97706" strokeWidth={2} />
            <Text style={[styles.statusBadgeText, styles.pendingText]}>Pending</Text>
          </View>
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => handleCancelRequest(trip.id)}
          >
            <X size={12} color="#6b7280" strokeWidth={2} />
          </TouchableOpacity>
        </View>
      );
    }

    if (trip.my_status === 'rejected') {
      return (
        <View style={[styles.statusBadge, styles.rejectedBadge]}>
          <X size={12} color="#dc2626" strokeWidth={2} />
          <Text style={[styles.statusBadgeText, styles.rejectedText]}>Not approved</Text>
        </View>
      );
    }

    return (
      <TouchableOpacity
        style={[styles.joinBtn, isJoining && styles.joinBtnDisabled]}
        onPress={() => handleRequestToJoin(trip.id)}
        disabled={isJoining}
      >
        {isJoining ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <Text style={styles.joinBtnText}>Request to Join</Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Toast
        message={toast.message}
        type={toast.type}
        visible={toast.visible}
        onHide={() => setToast(prev => ({ ...prev, visible: false }))}
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
            <Rss size={32} color="#2563eb" strokeWidth={2} />
          </View>
          <Text style={styles.title}>Feed</Text>
          <Text style={styles.subtitle}>Discover public trips and join the adventure</Text>
        </View>

        {loading ? (
          <View style={styles.body}>
            <PlaceCardSkeleton />
            <PlaceCardSkeleton />
            <PlaceCardSkeleton />
          </View>
        ) : trips.length === 0 ? (
          <View style={styles.emptyState}>
            <Globe size={64} color="#d1d5db" strokeWidth={1.5} />
            <Text style={styles.emptyTitle}>No Public Trips Yet</Text>
            <Text style={styles.emptyText}>
              When other travelers share their trips publicly, they&apos;ll appear here.
            </Text>
          </View>
        ) : (
          <View style={styles.body}>
            {trips.map(trip => {
              const expanded = expandedTripId === trip.id;
              const items = tripItems[trip.id] || [];
              const members = tripMembers[trip.id] || [];
              const isLoadingDetails = loadingDetails[trip.id];
              const isApproved = trip.my_status === 'approved';

              return (
                <View key={trip.id} style={styles.tripCard}>
                  {/* Card header */}
                  <View style={styles.tripHeader}>
                    <View style={styles.tripHeaderLeft}>
                      <Text style={styles.tripTitle}>{trip.title}</Text>
                      <View style={styles.tripMeta}>
                        <MapPin size={13} color="#6b7280" strokeWidth={2} />
                        <Text style={styles.tripDestination}>{trip.destination}</Text>
                      </View>
                      {(trip.start_date || trip.end_date) && (
                        <View style={styles.tripMeta}>
                          <Calendar size={13} color="#6b7280" strokeWidth={2} />
                          <Text style={styles.tripDates}>
                            {formatDate(trip.start_date) ?? '?'}
                            {trip.end_date ? ` → ${formatDate(trip.end_date)}` : ''}
                          </Text>
                        </View>
                      )}
                      <View style={styles.tripMeta}>
                        <Users size={13} color="#6b7280" strokeWidth={2} />
                        <Text style={styles.tripDestination}>
                          {trip.member_count} member{trip.member_count !== 1 ? 's' : ''}
                        </Text>
                      </View>
                    </View>

                    {/* Expand toggle for approved members */}
                    {isApproved && (
                      <TouchableOpacity
                        onPress={() => toggleExpand(trip)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        {expanded ? (
                          <ChevronUp size={20} color="#6b7280" strokeWidth={2} />
                        ) : (
                          <ChevronDown size={20} color="#6b7280" strokeWidth={2} />
                        )}
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Action row */}
                  <View style={styles.actionRow}>
                    {renderStatusButton(trip)}
                  </View>

                  {/* Trip details (for approved members) */}
                  {isApproved && expanded && (
                    <View style={styles.detailsSection}>
                      {isLoadingDetails ? (
                        <ActivityIndicator color="#2563eb" style={{ marginVertical: 16 }} />
                      ) : (
                        <>
                          {/* Itinerary */}
                          <Text style={styles.detailsTitle}>Itinerary</Text>
                          {items.length === 0 ? (
                            <Text style={styles.noItemsText}>No places added to this trip yet.</Text>
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
                              </View>
                            ))
                          )}

                          {/* Members */}
                          {members.length > 0 && (
                            <>
                              <Text style={[styles.detailsTitle, { marginTop: 12 }]}>Members</Text>
                              {members
                                .filter(m => m.status === 'approved')
                                .map(member => (
                                  <View key={member.id} style={styles.memberRow}>
                                    <Users size={13} color="#2563eb" strokeWidth={2} />
                                    <Text style={styles.memberEmail} numberOfLines={1}>
                                      {member.email}
                                    </Text>
                                  </View>
                                ))}
                            </>
                          )}
                        </>
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
    alignItems: 'flex-start',
    padding: 16,
    paddingBottom: 8,
  },
  tripHeaderLeft: {
    flex: 1,
    gap: 4,
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
  actionRow: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    paddingTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  joinBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 140,
  },
  joinBtnDisabled: {
    opacity: 0.6,
  },
  joinBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 5,
  },
  statusBadgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  approvedBadge: {
    backgroundColor: '#dcfce7',
  },
  approvedText: {
    color: '#16a34a',
  },
  pendingBadge: {
    backgroundColor: '#fef3c7',
  },
  pendingText: {
    color: '#d97706',
  },
  rejectedBadge: {
    backgroundColor: '#fee2e2',
  },
  rejectedText: {
    color: '#dc2626',
  },
  cancelBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsSection: {
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    padding: 14,
    gap: 8,
  },
  detailsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  noItemsText: {
    fontSize: 13,
    color: '#9ca3af',
    paddingVertical: 4,
  },
  tripItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 10,
    gap: 10,
    marginBottom: 4,
  },
  tripItemIndex: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  tripItemIndexText: {
    fontSize: 11,
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
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
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
});
