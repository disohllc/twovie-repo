import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { TMDBContent } from '@/types/database';
import { TMDB } from '@/services/tmdb';

type ContentCardProps = {
  item: TMDBContent;
  onPress?: () => void;
};

export function ContentCard({ item, onPress }: ContentCardProps) {
  const title = item.title || item.name || 'Unknown';
  const releaseDate = item.release_date || item.first_air_date || '';
  const year = releaseDate ? new Date(releaseDate).getFullYear() : '';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <Image
        source={{ uri: TMDB.getImageUrl(item.poster_path, 'w342') }}
        style={styles.poster}
        resizeMode="cover"
      />
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        <View style={styles.metadata}>
          {year && <Text style={styles.year}>{year}</Text>}
          <View style={styles.dot} />
          <Text style={styles.type}>{item.media_type === 'movie' ? 'Movie' : 'TV Show'}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 140,
    marginRight: 12,
  },
  poster: {
    width: 140,
    height: 210,
    borderRadius: 8,
    backgroundColor: '#1a1a1a',
  },
  info: {
    marginTop: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    lineHeight: 18,
  },
  metadata: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  year: {
    fontSize: 12,
    color: '#999',
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#666',
    marginHorizontal: 6,
  },
  type: {
    fontSize: 12,
    color: '#999',
  },
});
