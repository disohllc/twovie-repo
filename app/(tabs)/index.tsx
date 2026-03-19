import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  ActivityIndicator,
  ImageBackground,
  TouchableOpacity,
  Modal,
  Alert,
  Image,
  TextInput,
  Keyboard,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useAuth } from '@/contexts/AuthContext';
import { TMDB } from '@/services/tmdb';
import { TMDBContent } from '@/types/database';
import { ContentCard } from '@/components/ContentCard';
import { Plus, X, Bell, Search, Info, Play } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import NotificationsModal from '@/components/NotificationsModal';
import Toast from '@/components/Toast';
import { useFocusEffect } from '@react-navigation/native';

export default function Home() {
  const { profile } = useAuth();
  const [trending, setTrending] = useState<TMDBContent[]>([]);
  const [popularMovies, setPopularMovies] = useState<TMDBContent[]>([]);
  const [popularTV, setPopularTV] = useState<TMDBContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedContent, setSelectedContent] = useState<TMDBContent | null>(null);
  const [addingToWatchlist, setAddingToWatchlist] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TMDBContent[]>([]);
  const [searchActive, setSearchActive] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchInputRef = useRef<TextInput>(null);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [showTrailer, setShowTrailer] = useState(false);
  const [loadingTrailer, setLoadingTrailer] = useState(false);
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: 'success' | 'error' }>({
    visible: false,
    message: '',
    type: 'success',
  });

  useEffect(() => {
    loadContent();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadUnreadCount();
    }, [profile])
  );

  const loadUnreadCount = async () => {
    if (!profile) return;
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', profile.id)
        .eq('read', false);

      if (!error && data) {
        setUnreadCount(data.length);
      }
    } catch (error) {
      console.error('Error loading unread count:', error);
    }
  };

  const loadContent = async () => {
    setLoading(true);
    const [trendingData, moviesData, tvData] = await Promise.all([
      TMDB.getTrending('week'),
      TMDB.getPopularMovies(1),
      TMDB.getPopularTVShows(1),
    ]);
    setTrending(trendingData.slice(0, 10));
    setPopularMovies(moviesData);
    setPopularTV(tvData);
    setLoading(false);
  };

  const handleAddToWatchlist = async (content?: TMDBContent) => {
    const itemToAdd = content || selectedContent;
    if (!itemToAdd || !profile) return;

    if (!itemToAdd.id) {
      console.error('Item missing ID:', itemToAdd);
      Alert.alert('Error', 'Invalid content: missing ID');
      return;
    }

    setAddingToWatchlist(true);

    try {
      const { data: existingItems, error: countError } = await supabase
        .from('watchlist_items')
        .select('id', { count: 'exact' })
        .eq('user_id', profile.id);

      if (countError) throw countError;

      const itemCount = existingItems?.length || 0;

      if (!profile.is_premium && itemCount >= 5) {
        Alert.alert(
          'Upgrade to Premium',
          'Free users can only add up to 5 items. Upgrade to Premium for unlimited items!',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Upgrade', onPress: () => {} },
          ]
        );
        setAddingToWatchlist(false);
        return;
      }

      const title = itemToAdd.title || itemToAdd.name || 'Unknown';
      const releaseDate = itemToAdd.release_date || itemToAdd.first_air_date || null;

      const { error } = await supabase.from('watchlist_items').insert({
        user_id: profile.id,
        tmdb_id: itemToAdd.id,
        media_type: itemToAdd.media_type,
        title,
        poster_path: itemToAdd.poster_path,
        overview: itemToAdd.overview,
        release_date: releaseDate,
        ranking: itemCount + 1,
      });

      if (error) {
        if (error.code === '23505') {
          if (Platform.OS === 'web') {
            setToast({ visible: true, message: 'This item is already in your watchlist', type: 'error' });
          } else {
            Alert.alert('Already Added', 'This item is already in your watchlist');
          }
        } else {
          throw error;
        }
      } else {
        if (Platform.OS === 'web') {
          setToast({ visible: true, message: `${title} added to your watchlist`, type: 'success' });
        } else {
          Alert.alert('Success', `${title} added to your watchlist`);
        }
        if (!content) {
          setSelectedContent(null);
        }
      }
    } catch (error) {
      console.error('Error adding to watchlist:', error);
      if (Platform.OS === 'web') {
        setToast({ visible: true, message: 'Failed to add to watchlist', type: 'error' });
      } else {
        Alert.alert('Error', 'Failed to add to watchlist');
      }
    } finally {
      setAddingToWatchlist(false);
    }
  };

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);

    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    if (text.length >= 3) {
      setSearchLoading(true);
      searchTimeout.current = setTimeout(async () => {
        const results = await TMDB.searchMulti(text);
        setSearchResults(results);
        setSearchLoading(false);
      }, 500);
    } else {
      setSearchResults([]);
      setSearchLoading(false);
    }
  };

  const loadTrailer = async (content: TMDBContent) => {
    setLoadingTrailer(true);
    setTrailerKey(null);
    try {
      const video = content.media_type === 'movie'
        ? await TMDB.getMovieVideos(content.id)
        : await TMDB.getTVVideos(content.id);

      if (video?.key) {
        setTrailerKey(video.key);
      }
    } catch (error) {
      console.error('Error loading trailer:', error);
    } finally {
      setLoadingTrailer(false);
    }
  };

  const handleContentPress = (content: TMDBContent) => {
    setSelectedContent(content);
    loadTrailer(content);
  };

  const handlePlayTrailer = () => {
    if (trailerKey) {
      setShowTrailer(true);
    }
  };

  const handleCloseTrailer = () => {
    setShowTrailer(false);
  };

  const handleSearchFocus = () => {
    setSearchActive(true);
  };

  const handleSearchClose = () => {
    setSearchActive(false);
    setSearchQuery('');
    setSearchResults([]);
    Keyboard.dismiss();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#e50914" />
      </View>
    );
  }

  const featuredItem = trending[0];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Twovie</Text>
        <TouchableOpacity
          style={styles.notificationButton}
          onPress={() => setShowNotifications(true)}
        >
          <Bell size={24} color="#fff" />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <View style={[styles.searchBar, searchActive && styles.searchBarActive]}>
          <Search size={20} color="#999" />
          <TextInput
            ref={searchInputRef}
            style={styles.searchInput}
            placeholder="Search movies and TV shows..."
            placeholderTextColor="#666"
            value={searchQuery}
            onChangeText={handleSearchChange}
            onFocus={handleSearchFocus}
          />
          {searchActive && (
            <TouchableOpacity onPress={handleSearchClose}>
              <X size={20} color="#999" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {searchActive && (
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={handleSearchClose}
        >
          <View style={styles.searchResultsContainer}>
            <TouchableOpacity activeOpacity={1}>
              {searchLoading ? (
                <View style={styles.searchLoadingContainer}>
                  <ActivityIndicator size="large" color="#e50914" />
                </View>
              ) : searchQuery.length >= 3 && searchResults.length > 0 ? (
                <FlatList
                  data={searchResults}
                  keyExtractor={(item) => `search-${item.id}`}
                  renderItem={({ item }) => (
                    <View style={styles.searchResultItem}>
                      <Image
                        source={{ uri: TMDB.getImageUrl(item.poster_path, 'w185') }}
                        style={styles.searchResultPoster}
                      />
                      <View style={styles.searchResultInfo}>
                        <Text style={styles.searchResultTitle}>
                          {item.title || item.name}
                        </Text>
                        <Text style={styles.searchResultType}>
                          {item.media_type === 'movie' ? 'Movie' : 'TV Show'}
                        </Text>
                      </View>
                      <View style={styles.searchResultActions}>
                        <TouchableOpacity
                          style={styles.searchResultButton}
                          onPress={() => {
                            handleSearchClose();
                            handleContentPress(item);
                          }}
                        >
                          <Info size={20} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.searchResultButton}
                          onPress={() => handleAddToWatchlist(item)}
                        >
                          <Plus size={20} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                />
              ) : searchQuery.length >= 3 ? (
                <View style={styles.searchEmptyContainer}>
                  <Text style={styles.searchEmptyText}>No results found</Text>
                </View>
              ) : (
                <View style={styles.searchEmptyContainer}>
                  <Text style={styles.searchEmptyText}>Type at least 3 characters to search</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      )}

      <ScrollView showsVerticalScrollIndicator={false}>
        {featuredItem && (
          <ImageBackground
            source={{ uri: TMDB.getBackdropUrl(featuredItem.backdrop_path) }}
            style={styles.hero}
            resizeMode="cover"
          >
            <View style={styles.heroOverlay}>
              <Text style={styles.heroTitle}>
                {featuredItem.title || featuredItem.name}
              </Text>
              <Text style={styles.heroSubtitle} numberOfLines={3}>
                {featuredItem.overview}
              </Text>
              <TouchableOpacity
                style={styles.heroButton}
                onPress={() => handleAddToWatchlist(featuredItem)}
              >
                <Plus size={20} color="#fff" />
                <Text style={styles.heroButtonText}>Add to My List</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.heroInfoButton}
                onPress={() => handleContentPress(featuredItem)}
              >
                <Info size={20} color="#fff" />
                <Text style={styles.heroButtonText}>More Info</Text>
              </TouchableOpacity>
            </View>
          </ImageBackground>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Trending This Week</Text>
          <FlatList
            horizontal
            data={trending}
            renderItem={({ item }) => (
              <ContentCard item={item} onPress={() => handleContentPress(item)} />
            )}
            keyExtractor={(item) => `trending-${item.id}`}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.list}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Popular Movies</Text>
          <FlatList
            horizontal
            data={popularMovies}
            renderItem={({ item }) => (
              <ContentCard item={item} onPress={() => handleContentPress(item)} />
            )}
            keyExtractor={(item) => `movie-${item.id}`}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.list}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Popular TV Shows</Text>
          <FlatList
            horizontal
            data={popularTV}
            renderItem={({ item }) => (
              <ContentCard item={item} onPress={() => handleContentPress(item)} />
            )}
            keyExtractor={(item) => `tv-${item.id}`}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.list}
          />
        </View>
      </ScrollView>

      <Modal
        visible={selectedContent !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedContent(null)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setSelectedContent(null)}
            >
              <X size={24} color="#fff" />
            </TouchableOpacity>

            {selectedContent && (
              <>
                <Image
                  source={{ uri: TMDB.getImageUrl(selectedContent.poster_path, 'w500') }}
                  style={styles.modalPoster}
                  resizeMode="cover"
                />
                <Text style={styles.modalTitle}>
                  {selectedContent.title || selectedContent.name}
                </Text>
                <Text style={styles.modalOverview}>{selectedContent.overview}</Text>

                <View style={styles.modalActions}>
                  {loadingTrailer ? (
                    <View style={styles.trailerLoading}>
                      <ActivityIndicator size="small" color="#999" />
                    </View>
                  ) : trailerKey ? (
                    <TouchableOpacity
                      style={styles.trailerButton}
                      onPress={handlePlayTrailer}
                    >
                      <Play size={20} color="#fff" fill="#fff" />
                      <Text style={styles.trailerButtonText}>Play Trailer</Text>
                    </TouchableOpacity>
                  ) : null}

                  <TouchableOpacity
                    style={[styles.addButton, addingToWatchlist && styles.addButtonDisabled]}
                    onPress={() => handleAddToWatchlist(selectedContent)}
                    disabled={addingToWatchlist}
                  >
                    {addingToWatchlist ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Plus size={20} color="#fff" />
                        <Text style={styles.addButtonText}>Add to My List</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={showTrailer}
        animationType="fade"
        transparent={false}
        onRequestClose={handleCloseTrailer}
      >
        <View style={styles.trailerModalContainer}>
          <TouchableOpacity
            style={styles.trailerCloseButton}
            onPress={handleCloseTrailer}
          >
            <X size={28} color="#fff" />
          </TouchableOpacity>
          {trailerKey && (
            <WebView
              source={{ uri: `https://www.youtube.com/embed/${trailerKey}?autoplay=1&playsinline=1` }}
              style={styles.trailerWebView}
              allowsFullscreenVideo
              mediaPlaybackRequiresUserAction={false}
            />
          )}
        </View>
      </Modal>

      <NotificationsModal
        visible={showNotifications}
        onClose={() => setShowNotifications(false)}
        onNotificationCountChange={setUnreadCount}
      />

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
  hero: {
    width: '100%',
    height: 500,
  },
  heroOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
    padding: 24,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  heroSubtitle: {
    fontSize: 14,
    color: '#ccc',
    lineHeight: 20,
    marginBottom: 20,
  },
  heroButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e50914',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  heroInfoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  heroButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  list: {
    paddingHorizontal: 16,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 1,
    padding: 8,
  },
  modalPoster: {
    width: 200,
    height: 300,
    borderRadius: 12,
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalOverview: {
    fontSize: 14,
    color: '#ccc',
    lineHeight: 20,
    marginBottom: 24,
    textAlign: 'center',
  },
  modalActions: {
    gap: 12,
    width: '100%',
  },
  trailerLoading: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  trailerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#333',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    width: '100%',
    gap: 8,
  },
  trailerButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e50914',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    width: '100%',
    justifyContent: 'center',
  },
  addButtonDisabled: {
    opacity: 0.6,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  trailerModalContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
  },
  trailerCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 20,
    padding: 8,
  },
  trailerWebView: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 16,
    backgroundColor: '#000',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#e50914',
  },
  notificationButton: {
    position: 'relative',
    padding: 8,
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#e50914',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#000',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  searchBarActive: {
    borderColor: '#e50914',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    zIndex: 10,
    paddingTop: 180,
  },
  searchResultsContainer: {
    backgroundColor: '#1a1a1a',
    marginHorizontal: 16,
    borderRadius: 12,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  searchLoadingContainer: {
    padding: 48,
    alignItems: 'center',
  },
  searchResultItem: {
    flexDirection: 'row',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
    alignItems: 'center',
    gap: 12,
  },
  searchResultPoster: {
    width: 60,
    height: 90,
    borderRadius: 8,
  },
  searchResultInfo: {
    flex: 1,
  },
  searchResultTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  searchResultType: {
    fontSize: 13,
    color: '#999',
  },
  searchResultActions: {
    flexDirection: 'row',
    gap: 8,
  },
  searchResultButton: {
    backgroundColor: '#e50914',
    padding: 10,
    borderRadius: 8,
  },
  searchEmptyContainer: {
    padding: 48,
    alignItems: 'center',
  },
  searchEmptyText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
});
