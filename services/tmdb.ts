import Constants from 'expo-constants';
import { TMDBContent } from '@/types/database';

const TMDB_API_KEY = Constants.expoConfig?.extra?.tmdbApiKey || process.env.EXPO_PUBLIC_TMDB_API_KEY || 'demo_key';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';

export const TMDB = {
  async getPopularMovies(page = 1): Promise<TMDBContent[]> {
    try {
      const response = await fetch(
        `${BASE_URL}/movie/popular?api_key=${TMDB_API_KEY}&page=${page}&language=en-US`
      );
      const data = await response.json();
      return data.results.map((item: any) => ({
        ...item,
        media_type: 'movie',
      }));
    } catch (error) {
      console.error('Error fetching popular movies:', error);
      return [];
    }
  },

  async getPopularTVShows(page = 1): Promise<TMDBContent[]> {
    try {
      const response = await fetch(
        `${BASE_URL}/tv/popular?api_key=${TMDB_API_KEY}&page=${page}&language=en-US`
      );
      const data = await response.json();
      return data.results.map((item: any) => ({
        ...item,
        media_type: 'tv',
      }));
    } catch (error) {
      console.error('Error fetching popular TV shows:', error);
      return [];
    }
  },

  async getTrending(timeWindow: 'day' | 'week' = 'week'): Promise<TMDBContent[]> {
    try {
      const response = await fetch(
        `${BASE_URL}/trending/all/${timeWindow}?api_key=${TMDB_API_KEY}&language=en-US`
      );
      const data = await response.json();
      return data.results;
    } catch (error) {
      console.error('Error fetching trending:', error);
      return [];
    }
  },

  async searchMulti(query: string): Promise<TMDBContent[]> {
    try {
      const response = await fetch(
        `${BASE_URL}/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=en-US&page=1`
      );
      const data = await response.json();
      return data.results.filter(
        (item: any) => item.media_type === 'movie' || item.media_type === 'tv'
      );
    } catch (error) {
      console.error('Error searching:', error);
      return [];
    }
  },

  async getMovieDetails(movieId: number) {
    try {
      const response = await fetch(
        `${BASE_URL}/movie/${movieId}?api_key=${TMDB_API_KEY}&language=en-US`
      );
      return await response.json();
    } catch (error) {
      console.error('Error fetching movie details:', error);
      return null;
    }
  },

  async getTVDetails(tvId: number) {
    try {
      const response = await fetch(
        `${BASE_URL}/tv/${tvId}?api_key=${TMDB_API_KEY}&language=en-US`
      );
      return await response.json();
    } catch (error) {
      console.error('Error fetching TV details:', error);
      return null;
    }
  },

  getImageUrl(path: string | null, size: 'w185' | 'w342' | 'w500' | 'w780' | 'original' = 'w500'): string {
    if (!path) return 'https://via.placeholder.com/500x750/1a1a1a/666666?text=No+Image';
    return `${IMAGE_BASE_URL}/${size}${path}`;
  },

  getBackdropUrl(path: string | null, size: 'w300' | 'w780' | 'w1280' | 'original' = 'w1280'): string {
    if (!path) return 'https://via.placeholder.com/1280x720/1a1a1a/666666?text=No+Image';
    return `${IMAGE_BASE_URL}/${size}${path}`;
  },

  async getMovieVideos(movieId: number) {
    try {
      const response = await fetch(
        `${BASE_URL}/movie/${movieId}/videos?api_key=${TMDB_API_KEY}&language=en-US`
      );
      const data = await response.json();
      return data.results.find(
        (video: any) => video.type === 'Trailer' && video.site === 'YouTube'
      );
    } catch (error) {
      console.error('Error fetching movie videos:', error);
      return null;
    }
  },

  async getTVVideos(tvId: number) {
    try {
      const response = await fetch(
        `${BASE_URL}/tv/${tvId}/videos?api_key=${TMDB_API_KEY}&language=en-US`
      );
      const data = await response.json();
      return data.results.find(
        (video: any) => video.type === 'Trailer' && video.site === 'YouTube'
      );
    } catch (error) {
      console.error('Error fetching TV videos:', error);
      return null;
    }
  },
};
