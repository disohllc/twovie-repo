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
  Platform,
  Modal,
  Linking,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { WatchlistItem } from '@/types/database';
import { TMDB } from '@/services/tmdb';
import { Trash2, GripVertical, ChevronUp, ChevronDown, X } from 'lucide-react-native';
import Toast from '@/components/Toast';

export default function Watchlist() {
  const { profile } = useAuth();
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<WatchlistItem | null>(null);
  const [upgrading, setUpgrading] = useState(false);
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: 'success' | 'error' }>({
    visible: false,
    message: '',
    type: 'success',
  });

  useFocusEffect(
    useCallback(() => {
      if (profile) {
        loadWatchlist();
      }
    }, [profile])
  );

  const loadWatchlist = async () => {
    if (!profile) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('watchlist_items')
        .select('*')
        .eq('user_id', profile.id)
        .order('ranking', { ascending: true });

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error('Error loading watchlist:', error);
      Alert.alert('Error', 'Failed to load watchlist');
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async () => {
    setUpgrading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/create-checkout`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            priceId: 'price_1QsVTTGg3sECJJ8MBMeB2z0B',
            successUrl: Platform.OS === 'web' ? `${window.location.origin}/watchlist?success=true` : undefined,
            cancelUrl: Platform.OS === 'web' ? `${window.location.origin}/watchlist?canceled=true` : undefined,
          }),
        }
      );

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      if (data.url) {
        if (Platform.OS === 'web') {
          window.location.href = data.url;
        } else {
          await Linking.openURL(data.url);
        }
      }
    } catch (error) {
      console.error('Error creating checkout:', error);
      if (Platform.OS === 'web') {
        setToast({ visible: true, message: 'Failed to start checkout', type: 'error' });
      } else {
        Alert.alert('Error', 'Failed to start checkout');
      }
    } finally {
      setUpgrading(false);
    }
  };

  const handleDelete = async (item: WatchlistItem) => {
    if (Platform.OS === 'web') {
      setDeleteConfirm(item);
    } else {
      Alert.alert(
        'Remove Item',
        `Remove "${item.title}" from your watchlist?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => confirmDelete(item),
          },
        ]
      );
    }
  };

  const confirmDelete = async (item: WatchlistItem) => {
    try {
      const { error } = await supabase
        .from('watchlist_items')
        .delete()
        .eq('id', item.id);

      if (error) throw error;

      setItems((prev) => prev.filter((i) => i.id !== item.id));
      setDeleteConfirm(null);

      if (Platform.OS === 'web') {
        setToast({ visible: true, message: `${item.title} removed from watchlist`, type: 'success' });
      }
    } catch (error) {
      console.error('Error deleting item:', error);
      setDeleteConfirm(null);

      if (Platform.OS === 'web') {
        setToast({ visible: true, message: 'Failed to remove item', type: 'error' });
      } else {
        Alert.alert('Error', 'Failed to remove item');
      }
    }
  };

  const moveItem = async (fromIndex: number, direction: 'up' | 'down') => {
    if (direction === 'up' && fromIndex === 0) return;
    if (direction === 'down' && fromIndex === items.length - 1) return;

    const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;

    const newItems = [...items];
    const [movedItem] = newItems.splice(fromIndex, 1);
    newItems.splice(toIndex, 0, movedItem);

    const updatedItems = newItems.map((item, index) => ({
      ...item,
      ranking: index + 1,
    }));

    setItems(updatedItems);

    try {
      const updates = updatedItems.map((item) =>
        supabase
          .from('watchlist_items')
          .update({ ranking: item.ranking })
          .eq('id', item.id)
      );

      await Promise.all(updates);
    } catch (error) {
      console.error('Error updating rankings:', error);
      loadWatchlist();
    }
  };

  const renderItem = ({ item, index }: { item: WatchlistItem; index: number }) => (
    <View style={styles.itemContainer}>
      <View style={styles.reorderButtons}>
        <TouchableOpacity
          style={[styles.reorderButton, index === 0 && styles.reorderButtonDisabled]}
          onPress={() => moveItem(index, 'up')}
          disabled={index === 0}
        >
          <ChevronUp size={20} color={index === 0 ? '#333' : '#666'} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.reorderButton, index === items.length - 1 && styles.reorderButtonDisabled]}
          onPress={() => moveItem(index, 'down')}
          disabled={index === items.length - 1}
        >
          <ChevronDown size={20} color={index === items.length - 1 ? '#333' : '#666'} />
        </TouchableOpacity>
      </View>

      <Text style={styles.ranking}>{index + 1}</Text>

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
      </View>

      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDelete(item)}
      >
        <Trash2 size={20} color="#e50914" />
      </TouchableOpacity>
    </View>
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
        <Text style={styles.headerTitle}>My Watchlist</Text>
        <Text style={styles.headerSubtitle}>
          {items.length} {items.length === 1 ? 'item' : 'items'}
          {!profile?.is_premium && ` / 5 (Free)`}
        </Text>
      </View>

      {items.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Your watchlist is empty</Text>
          <Text style={styles.emptySubtext}>
            Add movies and TV shows from the Home tab
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
        />
      )}

      {!profile?.is_premium && items.length >= 5 && (
        <View style={styles.premiumBanner}>
          <Text style={styles.premiumText}>
            Upgrade to Premium for unlimited items
          </Text>
          <TouchableOpacity
            style={[styles.premiumButton, upgrading && styles.premiumButtonDisabled]}
            onPress={handleUpgrade}
            disabled={upgrading}
          >
            {upgrading ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Text style={styles.premiumButtonText}>Upgrade - $1.99</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      <Modal
        visible={deleteConfirm !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteConfirm(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModal}>
            <Text style={styles.confirmTitle}>Remove Item</Text>
            <Text style={styles.confirmMessage}>
              Remove "{deleteConfirm?.title}" from your watchlist?
            </Text>
            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setDeleteConfirm(null)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => deleteConfirm && confirmDelete(deleteConfirm)}
              >
                <Text style={styles.removeButtonText}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast({ ...toast, visible: false })}
      />
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
    padding: 24,
    paddingTop: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#999',
  },
  list: {
    padding: 16,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  reorderButtons: {
    flexDirection: 'column',
    marginRight: 4,
  },
  reorderButton: {
    padding: 2,
  },
  reorderButtonDisabled: {
    opacity: 0.3,
  },
  ranking: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#e50914',
    width: 32,
    textAlign: 'center',
  },
  poster: {
    width: 60,
    height: 90,
    borderRadius: 6,
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
    marginBottom: 4,
  },
  type: {
    fontSize: 13,
    color: '#999',
  },
  deleteButton: {
    padding: 8,
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
  premiumBanner: {
    backgroundColor: '#1a1a1a',
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
    padding: 16,
    alignItems: 'center',
  },
  premiumText: {
    fontSize: 14,
    color: '#fff',
    marginBottom: 12,
  },
  premiumButton: {
    backgroundColor: '#e50914',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  premiumButtonDisabled: {
    backgroundColor: '#999',
    opacity: 0.7,
  },
  premiumButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  confirmModal: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  confirmMessage: {
    fontSize: 15,
    color: '#ccc',
    marginBottom: 24,
    lineHeight: 22,
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#333',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  removeButton: {
    flex: 1,
    backgroundColor: '#e50914',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  removeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
