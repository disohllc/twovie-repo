import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  Image,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { Film, Users, Heart, Sparkles, Star } from 'lucide-react-native';
import { TMDB } from '@/services/tmdb';
import { TMDBContent } from '@/types/database';

const { width } = Dimensions.get('window');

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [trendingMovies, setTrendingMovies] = useState<TMDBContent[]>([]);
  const [trendingTV, setTrendingTV] = useState<TMDBContent[]>([]);
  const [loadingTrending, setLoadingTrending] = useState(true);
  const { signIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    loadTrending();
  }, []);

  const loadTrending = async () => {
    setLoadingTrending(true);
    const [movies, tv] = await Promise.all([
      TMDB.getPopularMovies(1),
      TMDB.getPopularTVShows(1),
    ]);
    setTrendingMovies(movies.slice(0, 10));
    setTrendingTV(tv.slice(0, 10));
    setLoadingTrending(false);
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    console.log('Attempting to sign in...');
    const { error } = await signIn(email, password);
    console.log('Sign in result:', error ? 'Error' : 'Success');

    if (error) {
      setLoading(false);
      console.error('Sign in error:', error);
      Alert.alert('Error', error.message || 'Failed to sign in');
    } else {
      router.replace('/(tabs)');
    }
  };

  const renderTrendingItem = (item: TMDBContent, index: number) => (
    <View key={item.id} style={styles.trendingItem}>
      <View style={styles.rankBadge}>
        <Text style={styles.rankText}>{index + 1}</Text>
      </View>
      <Image
        source={{ uri: TMDB.getImageUrl(item.poster_path, 'w185') }}
        style={styles.trendingPoster}
        resizeMode="cover"
      />
      <View style={styles.trendingInfo}>
        <Text style={styles.trendingTitle} numberOfLines={1}>
          {item.title || item.name}
        </Text>
      </View>
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.authSection}>
        <View style={styles.header}>
          <Film size={56} color="#e50914" />
          <Text style={styles.title}>Twovie</Text>
          <Text style={styles.subtitle}>Decide what to watch together</Text>
        </View>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#666"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!loading}
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#666"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!loading}
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => router.push('/(auth)/register')}
            disabled={loading}
          >
            <Text style={styles.linkText}>
              Don't have an account? <Text style={styles.linkTextBold}>Sign Up</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.infoSection}>
        <Text style={styles.sectionTitle}>What is Twovie?</Text>
        <Text style={styles.infoText}>
          Twovie helps couples and friends decide what to watch together. Create shared watchlists,
          rank your favorites, and never spend hours deciding on movie night again.
        </Text>

        <View style={styles.features}>
          <View style={styles.feature}>
            <View style={styles.featureIcon}>
              <Users size={24} color="#e50914" />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Connect with Friends</Text>
              <Text style={styles.featureText}>
                Invite friends and create shared watchlists
              </Text>
            </View>
          </View>

          <View style={styles.feature}>
            <View style={styles.featureIcon}>
              <Heart size={24} color="#e50914" />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Rank Your Favorites</Text>
              <Text style={styles.featureText}>
                Organize content by preference and find perfect matches
              </Text>
            </View>
          </View>

          <View style={styles.feature}>
            <View style={styles.featureIcon}>
              <Sparkles size={24} color="#e50914" />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Discover Together</Text>
              <Text style={styles.featureText}>
                Explore trending movies and TV shows
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.trendingSection}>
        <View style={styles.trendingSectionHeader}>
          <Star size={24} color="#e50914" />
          <Text style={styles.trendingSectionTitle}>Top 10 Movies</Text>
        </View>
        {loadingTrending ? (
          <View style={styles.loadingTrending}>
            <ActivityIndicator size="large" color="#e50914" />
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.trendingList}>
            {trendingMovies.map((item, index) => renderTrendingItem(item, index))}
          </ScrollView>
        )}
      </View>

      <View style={styles.trendingSection}>
        <View style={styles.trendingSectionHeader}>
          <Star size={24} color="#e50914" />
          <Text style={styles.trendingSectionTitle}>Top 10 TV Shows</Text>
        </View>
        {loadingTrending ? (
          <View style={styles.loadingTrending}>
            <ActivityIndicator size="large" color="#e50914" />
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.trendingList}>
            {trendingTV.map((item, index) => renderTrendingItem(item, index))}
          </ScrollView>
        )}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Twovie 2026</Text>
        <Text style={styles.footerSubtext}>Made for couples who love movies</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  authSection: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 16,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 17,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  form: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  input: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: '#fff',
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#e50914',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  linkButton: {
    marginTop: 24,
    alignItems: 'center',
  },
  linkText: {
    color: '#999',
    fontSize: 14,
  },
  linkTextBold: {
    color: '#e50914',
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#1a1a1a',
    marginVertical: 20,
  },
  infoSection: {
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  sectionTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  infoText: {
    fontSize: 16,
    color: '#ccc',
    lineHeight: 24,
    marginBottom: 32,
  },
  features: {
    gap: 24,
  },
  feature: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'flex-start',
  },
  featureIcon: {
    width: 48,
    height: 48,
    backgroundColor: '#1a1a1a',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  featureText: {
    fontSize: 14,
    color: '#999',
    lineHeight: 20,
  },
  trendingSection: {
    paddingVertical: 24,
  },
  trendingSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  trendingSectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  loadingTrending: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trendingList: {
    paddingLeft: 24,
  },
  trendingItem: {
    width: 120,
    marginRight: 12,
    position: 'relative',
  },
  rankBadge: {
    position: 'absolute',
    top: -8,
    left: -8,
    backgroundColor: '#e50914',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    borderWidth: 2,
    borderColor: '#000',
  },
  rankText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  trendingPoster: {
    width: 120,
    height: 180,
    borderRadius: 8,
    backgroundColor: '#1a1a1a',
  },
  trendingInfo: {
    marginTop: 8,
  },
  trendingTitle: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '500',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  footerText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  footerSubtext: {
    fontSize: 12,
    color: '#666',
  },
});
