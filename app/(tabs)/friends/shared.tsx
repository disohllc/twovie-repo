import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  Animated,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { SharedWatchlistItem, SharedSpace, WatchlistItem } from '@/types/database';
import { TMDB } from '@/services/tmdb';
import { ArrowLeft, Plus, Sparkles, ThumbsDown, Trash2 } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

export default function SharedWatchlist() {
  const { friendId } = useLocalSearchParams<{ friendId: string }>();
  const { profile } = useAuth();
  const router = useRouter();
  const [sharedSpace, setSharedSpace] = useState<SharedSpace | null>(null);
  const [sharedItems, setSharedItems] = useState<SharedWatchlistItem[]>([]);
  const [myWatchlist, setMyWatchlist] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRecommendation, setShowRecommendation] = useState(false);
  const [recommendation, setRecommendation] = useState<SharedWatchlistItem | null>(null);
  const [spinValue] = useState(new Animated.Value(0));

  useFocusEffect(
    useCallback(() => {
      if (profile && friendId) {
        loadSharedSpace();
      }
    }, [profile, friendId])
  );

  const loadSharedSpace = async () => {
    if (!profile || !friendId) return;

    setLoading(true);
    try {
      const userId1 = profile.id < friendId ? profile.id : friendId;
      const userId2 = profile.id < friendId ? friendId : profile.id;

      let { data: spaceData, error: spaceError } = await supabase
        .from('shared_spaces')
        .select('*')
        .eq('user1_id', userId1)
        .eq('user2_id', userId2)
        .maybeSingle();

      if (spaceError) throw spaceError;

      if (!spaceData) {
        const { data: newSpace, error: createError } = await supabase
          .from('shared_spaces')
          .insert({
            user1_id: userId1,
            user2_id: userId2,
          })
          .select()
          .single();

        if (createError) throw createError;
        spaceData = newSpace;
      }

      if (spaceData) {
        setSharedSpace(spaceData);

        const { data: itemsData, error: itemsError } = await supabase
          .from('shared_watchlist_items')
          .select('*')
          .eq('shared_space_id', spaceData.id)
          .order('created_at', { ascending: false });

        if (itemsError) throw itemsError;
        setSharedItems(itemsData || []);
      }

      const { data: watchlistData, error: watchlistError } = await supabase
        .from('watchlist_items')
        .select('*')
        .eq('user_id', profile.id)
        .order('ranking', { ascending: true });

      if (watchlistError) throw watchlistError;
      setMyWatchlist(watchlistData || []);
    } catch (error) {
      console.error('Error loading shared space:', error);
      Alert.alert('Error', 'Failed to load shared watchlist');
    } finally {
      setLoading(false);
    }
  };

  const handleAddToShared = async (item: WatchlistItem) => {
    if (!sharedSpace || !profile) return;

    try {
      const isUser1 = sharedSpace.user1_id === profile.id;

      const { error } = await supabase.from('shared_watchlist_items').insert({
        shared_space_id: sharedSpace.id,
        added_by_user_id: profile.id,
        tmdb_id: item.tmdb_id,
        media_type: item.media_type,
        title: item.title,
        poster_path: item.poster_path,
        overview: item.overview,
        release_date: item.release_date,
        [isUser1 ? 'user1_ranking' : 'user2_ranking']: item.ranking,
      });

      if (error) {
        if (error.code === '23505') {
          Alert.alert('Already Added', 'This item is already in the shared watchlist');
        } else {
          throw error;
        }
      } else {
        Alert.alert('Success', `${item.title} added to shared watchlist`);
        loadSharedSpace();
        setShowAddModal(false);
      }
    } catch (error) {
      console.error('Error adding to shared:', error);
      Alert.alert('Error', 'Failed to add to shared watchlist');
    }
  };

  const generateRecommendation = async () => {
    if (!sharedSpace || sharedItems.length === 0) {
      Alert.alert('Empty List', 'Add some items to your shared watchlist first!');
      return;
    }

    const { data: historyData } = await supabase
      .from('watch_history')
      .select('tmdb_id')
      .eq('shared_space_id', sharedSpace.id);

    const dismissedIds = new Set((historyData || []).map((h) => h.tmdb_id));

    const available = sharedItems.filter((item) => !dismissedIds.has(item.tmdb_id));

    if (available.length === 0) {
      Alert.alert('All Watched', 'You have already seen all items in your shared list!');
      return;
    }

    const scored = available.map((item) => {
      const user1Score = item.user1_ranking || 999;
      const user2Score = item.user2_ranking || 999;
      const combinedScore = (user1Score + user2Score) / 2;
      const agreement = Math.abs(user1Score - user2Score);
      const finalScore = combinedScore + agreement * 0.5;

      return { ...item, score: finalScore };
    });

    scored.sort((a, b) => a.score - b.score);
    const topFive = scored.slice(0, Math.min(5, scored.length));
    const selected = topFive[Math.floor(Math.random() * topFive.length)];

    Animated.timing(spinValue, {
      toValue: 1,
      duration: 2000,
      useNativeDriver: true,
    }).start(() => {
      setRecommendation(selected);
      setShowRecommendation(true);
      spinValue.setValue(0);
    });
  };

  const handleDismiss = async () => {
    if (!recommendation || !sharedSpace) return;

    try {
      await supabase.from('watch_history').insert({
        shared_space_id: sharedSpace.id,
        tmdb_id: recommendation.tmdb_id,
        media_type: recommendation.media_type,
        title: recommendation.title,
        dismissed: true,
      });

      setShowRecommendation(false);
      setRecommendation(null);
    } catch (error) {
      console.error('Error dismissing:', error);
    }
  };

  const handleDeleteSharedItem = async (item: SharedWatchlistItem) => {
    Alert.alert(
      'Remove Item',
      `Remove "${item.title}" from the shared watchlist?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('shared_watchlist_items')
                .delete()
                .eq('id', item.id);

              if (error) throw error;

              setSharedItems((prev) => prev.filter((i) => i.id !== item.id));
            } catch (error) {
              console.error('Error deleting item:', error);
              Alert.alert('Error', 'Failed to remove item');
            }
          },
        },
      ]
    );
  };

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '720deg'],
  });

  const renderSharedItem = ({ item }: { item: SharedWatchlistItem }) => (
    <View style={styles.itemContainer}>
      <Image
        source={{ uri: TMDB.getImageUrl(item.poster_path, 'w185') }}
        style={styles.poster}
        resizeMode="cover"
      />
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.type}>
          {item.media_type === 'movie' ? 'Movie' : 'TV Show'}
        </Text>
        <View style={styles.rankings}>
          <Text style={styles.ranking}>You: #{item.user1_ranking || '-'}</Text>
          <Text style={styles.ranking}>Friend: #{item.user2_ranking || '-'}</Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDeleteSharedItem(item)}
      >
        <Trash2 size={20} color="#e50914" />
      </TouchableOpacity>
    </View>
  );

  const renderWatchlistItem = ({ item }: { item: WatchlistItem }) => (
    <TouchableOpacity
      style={styles.addItemContainer}
      onPress={() => handleAddToShared(item)}
    >
      <Image
        source={{ uri: TMDB.getImageUrl(item.poster_path, 'w185') }}
        style={styles.smallPoster}
        resizeMode="cover"
      />
      <View style={styles.addItemInfo}>
        <Text style={styles.addItemTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.addItemType}>
          {item.media_type === 'movie' ? 'Movie' : 'TV Show'}
        </Text>
      </View>
      <Plus size={24} color="#e50914" />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#e50914" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Shared Watchlist</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowAddModal(true)}
        >
          <Plus size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {sharedItems.length > 0 && (
        <TouchableOpacity
          style={styles.recommendButton}
          onPress={generateRecommendation}
        >
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <Sparkles size={24} color="#fff" />
          </Animated.View>
          <Text style={styles.recommendButtonText}>What should we watch?</Text>
        </TouchableOpacity>
      )}

      {sharedItems.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No shared items yet</Text>
          <Text style={styles.emptySubtext}>
            Add items from your watchlist to get started
          </Text>
        </View>
      ) : (
        <FlatList
          data={sharedItems}
          renderItem={renderSharedItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
        />
      )}

      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add from My List</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <ArrowLeft size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {myWatchlist.length === 0 ? (
              <View style={styles.emptyModal}>
                <Text style={styles.emptyModalText}>Your watchlist is empty</Text>
              </View>
            ) : (
              <FlatList
                data={myWatchlist}
                renderItem={renderWatchlistItem}
                keyExtractor={(item) => item.id}
              />
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={showRecommendation}
        animationType="fade"
        transparent
        onRequestClose={() => setShowRecommendation(false)}
      >
        <View style={styles.recommendModal}>
          <View style={styles.recommendContent}>
            {recommendation && (
              <>
                <Text style={styles.recommendTitle}>We recommend</Text>
                <Image
                  source={{ uri: TMDB.getImageUrl(recommendation.poster_path, 'w500') }}
                  style={styles.recommendPoster}
                  resizeMode="cover"
                />
                <Text style={styles.recommendName}>{recommendation.title}</Text>
                <Text style={styles.recommendOverview} numberOfLines={4}>
                  {recommendation.overview}
                </Text>

                <View style={styles.recommendActions}>
                  <TouchableOpacity
                    style={styles.dismissButton}
                    onPress={handleDismiss}
                  >
                    <ThumbsDown size={20} color="#fff" />
                    <Text style={styles.dismissButtonText}>Not now</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.watchButton}
                    onPress={() => setShowRecommendation(false)}
                  >
                    <Text style={styles.watchButtonText}>Let's watch!</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    paddingTop: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  addButton: {
    backgroundColor: '#e50914',
    padding: 10,
    borderRadius: 8,
  },
  recommendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e50914',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  recommendButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  list: {
    padding: 16,
  },
  itemContainer: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  poster: {
    width: 80,
    height: 120,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: '#333',
  },
  info: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 6,
  },
  type: {
    fontSize: 13,
    color: '#999',
    marginBottom: 12,
  },
  rankings: {
    flexDirection: 'row',
    gap: 16,
  },
  ranking: {
    fontSize: 13,
    color: '#e50914',
    fontWeight: '600',
  },
  deleteButton: {
    padding: 8,
    alignSelf: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
  },
  modalContent: {
    flex: 1,
    backgroundColor: '#000',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    paddingTop: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  addItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
  },
  smallPoster: {
    width: 50,
    height: 75,
    borderRadius: 6,
    marginRight: 12,
    backgroundColor: '#333',
  },
  addItemInfo: {
    flex: 1,
  },
  addItemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  addItemType: {
    fontSize: 12,
    color: '#999',
  },
  emptyModal: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyModalText: {
    fontSize: 16,
    color: '#999',
  },
  recommendModal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  recommendContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: '100%',
  },
  recommendTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#e50914',
    marginBottom: 24,
  },
  recommendPoster: {
    width: 200,
    height: 300,
    borderRadius: 16,
    marginBottom: 20,
    backgroundColor: '#333',
  },
  recommendName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center',
  },
  recommendOverview: {
    fontSize: 14,
    color: '#ccc',
    lineHeight: 20,
    marginBottom: 32,
    textAlign: 'center',
  },
  recommendActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  dismissButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#333',
    flex: 1,
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  dismissButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  watchButton: {
    flex: 1,
    backgroundColor: '#e50914',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  watchButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
