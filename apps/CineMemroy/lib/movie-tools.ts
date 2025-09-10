import { tool } from 'ai';
import { z } from 'zod';
import { getMovieSearchService, type Movie } from './movie-search';
import { getMemory } from './memory-mongodb';

// Helper function to search for YouTube trailers
async function searchYouTubeTrailer(movieTitle: string, year?: number): Promise<string | null> {
  try {
    // In a real implementation, you'd use YouTube Data API
    // For now, we'll construct a likely YouTube search URL
    const searchQuery = `${movieTitle}${year ? ` ${year}` : ''} official trailer`;
    const youtubeSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`;
    
    // For demo purposes, return a constructed URL
    // In production, you'd make an API call to get the actual video ID
    return youtubeSearchUrl;
  } catch (error) {
    console.error('YouTube trailer search error:', error);
    return null;
  }
}

// Helper function to get movie poster URL
function getMoviePosterUrl(movie: any): string | null {
  // Return the poster URL from the database if available
  if (movie.poster) return movie.poster;
  
  // Fallback: could integrate with TMDB API or similar for missing posters
  // For now, return null if no poster is available
  return null;
}

// Helper function to format movie data for UI display
function formatMovieForUI(movie: any) {
  return {
    id: movie._id,
    title: movie.title,
    year: movie.year,
    plot: movie.plot,
    fullPlot: movie.fullplot || movie.plot,
    genres: movie.genres,
    directors: movie.directors,
    cast: movie.cast,
    rating: movie.imdb?.rating,
    votes: movie.imdb?.votes,
    runtime: movie.runtime,
    posterUrl: getMoviePosterUrl(movie),
    awards: movie.awards,
    countries: movie.countries,
    languages: movie.languages
  };
}

// Movie search tool
export const searchMoviesByPlot = tool({
  description: 'Search for movies based on plot similarity, mood, or description. Use this when users ask for movie recommendations or describe what kind of movie they want to watch.',
  inputSchema: z.object({
    query: z.string().describe('User query, mood, or description of desired movie (e.g., "romantic comedy", "space adventure", "feel-good movie")'),
    limit: z.number().optional().default(5).describe('Number of movies to return (default: 5)'),
    genres: z.array(z.string()).optional().describe('Preferred genres to filter by. Valid genres: Action, Adventure, Animation, Biography, Comedy, Crime, Documentary, Drama, Family, Fantasy, Film-Noir, History, Horror, Music, Musical, Mystery, Romance, Sci-Fi, Short, Sport, Thriller, War, Western (e.g., ["Comedy", "Romance"])'),
    yearRange: z.object({
      min: z.number().optional().describe('Minimum year'),
      max: z.number().optional().describe('Maximum year')
    }).optional().describe('Year range filter'),
    minRating: z.number().optional().describe('Minimum IMDB rating (0-10)')
  }),
  execute: async ({ query, limit, genres, yearRange, minRating }) => {
    try {
      const movieService = getMovieSearchService();
      const movies = await movieService.searchMoviesByPlot(query, {
        limit,
        genres,
        yearRange,
        minRating
      });

      return {
        success: true,
        movies: movies.map(movie => ({
          id: movie._id,
          title: movie.title,
          plot: movie.plot?.substring(0, 200) + (movie.plot && movie.plot.length > 200 ? '...' : ''),
          genres: movie.genres,
          year: movie.year,
          directors: movie.directors,
          cast: movie.cast?.slice(0, 5), // Limit cast to first 5 actors
          rating: movie.imdb?.rating,
          votes: movie.imdb?.votes,
          posterUrl: movie.poster,
          runtime: movie.runtime,
          awards: movie.awards,
          countries: movie.countries,
          languages: movie.languages
        })),
        query: query,
        totalFound: movies.length
      };
    } catch (error) {
      console.error('Movie search tool error:', error);
      return {
        success: false,
        error: 'Failed to search movies. Please try again.',
        movies: []
      };
    }
  }
});

// Get movie details tool
export const getMovieDetails = tool({
  description: 'Get detailed information about a specific movie by its ID',
  inputSchema: z.object({
    movieId: z.string().describe('The movie ID to get details for')
  }),
  execute: async ({ movieId }) => {
    try {
      const movieService = getMovieSearchService();
      const movie = await movieService.getMovieById(movieId);

      if (!movie) {
        return {
          success: false,
          error: 'Movie not found'
        };
      }

      return {
        success: true,
        movie: {
          id: movie._id,
          title: movie.title,
          plot: movie.plot,
          fullPlot: movie.fullplot,
          genres: movie.genres,
          year: movie.year,
          directors: movie.directors,
          cast: movie.cast,
          rating: movie.imdb?.rating,
          votes: movie.imdb?.votes,
          posterUrl: movie.poster,
          runtime: movie.runtime,
          awards: movie.awards,
          countries: movie.countries,
          languages: movie.languages
        }
      };
    } catch (error) {
      console.error('Get movie details error:', error);
      return {
        success: false,
        error: 'Failed to get movie details'
      };
    }
  }
});

// Rate movie tool
export const rateMovie = tool({
  description: 'Allow user to rate a movie and store their preference. Use this when users express their opinion about a movie.',
  inputSchema: z.object({
    movieId: z.string().describe('The movie ID being rated'),
    movieTitle: z.string().describe('The movie title being rated'),
    rating: z.number().min(1).max(10).describe('User rating from 1-10'),
    userId: z.string().describe('User ID'),
    comment: z.string().optional().describe('Optional user comment about the movie'),
    context: z.string().optional().describe('Context of watching (e.g., "date night", "family movie", "alone")')
  }),
  execute: async ({ movieId, movieTitle, rating, userId, comment, context }) => {
    try {
      const memory = await getMemory();
      
      // Store the rating as a memory
      const ratingMemory = `User rated "${movieTitle}" ${rating}/10${comment ? `: ${comment}` : ''}${context ? ` (watched ${context})` : ''}`;
      
      await memory.add([{
        role: 'system',
        content: ratingMemory
      }], {
        userId,
        metadata: {
          type: 'movie_rating',
          movieId,
          movieTitle,
          rating,
          comment,
          context,
          timestamp: new Date().toISOString()
        }
      });

      return {
        success: true,
        message: `Recorded your rating of ${rating}/10 for "${movieTitle}"`,
        rating: {
          movieId,
          movieTitle,
          rating,
          comment,
          context
        }
      };
    } catch (error) {
      console.error('Rate movie error:', error);
      return {
        success: false,
        error: 'Failed to record movie rating'
      };
    }
  }
});

// Get personalized recommendations tool
export const getPersonalizedRecommendations = tool({
  description: 'Get movie recommendations based on user preferences and viewing history stored in memory',
  inputSchema: z.object({
    userId: z.string().describe('User ID to get personalized recommendations for'),
    mood: z.string().optional().describe('Current mood or preference (e.g., "happy", "sad", "adventurous")'),
    limit: z.number().optional().default(5).describe('Number of recommendations to return')
  }),
  execute: async ({ userId, mood, limit }) => {
    try {
      const memory = await getMemory();
      const movieService = getMovieSearchService();
      
      // Search for user's movie preferences in memory
      const userPreferences = await memory.search(`movie preferences ratings ${mood || ''}`, {
        userId,
        limit: 10
      });
      
      // Extract preferred genres and patterns from memory
      let preferredGenres: string[] = [];
      let searchQuery = mood || 'good movie';
      
      if (userPreferences.length > 0) {
        // Analyze user's past ratings and preferences
        const memoryText = userPreferences.map(p => p.data || p.memory || p.text).join(' ');
        
        // Simple genre extraction (could be enhanced with NLP)
        const genreMatches = memoryText.match(/\b(Action|Adventure|Animation|Biography|Comedy|Crime|Documentary|Drama|Family|Fantasy|Film-Noir|History|Horror|Music|Musical|Mystery|Romance|Sci-Fi|Short|Sport|Thriller|War|Western)\b/gi);
        if (genreMatches) {
          preferredGenres = [...new Set(genreMatches)];
        }
        
        // Enhance search query with user preferences
        searchQuery = `${mood || ''} ${preferredGenres.join(' ')} movie recommendation`.trim();
      }
      
      // Get movie recommendations
      const movies = await movieService.searchMoviesByPlot(searchQuery, {
        limit,
        genres: preferredGenres.length > 0 ? preferredGenres : undefined,
        minRating: 6.0 // Only recommend well-rated movies
      });
      
      return {
        success: true,
        recommendations: movies.map(movie => ({
          id: movie._id,
          title: movie.title,
          plot: movie.plot?.substring(0, 200) + (movie.plot && movie.plot.length > 200 ? '...' : ''),
          genres: movie.genres,
          year: movie.year,
          directors: movie.directors,
          cast: movie.cast?.slice(0, 3),
          rating: movie.imdb?.rating,
          votes: movie.imdb?.votes,
          posterUrl: movie.poster,
          runtime: movie.runtime,
          awards: movie.awards,
          countries: movie.countries,
          languages: movie.languages
        })),
        basedOn: {
          userPreferences: userPreferences.length,
          preferredGenres,
          mood,
          searchQuery
        },
        totalFound: movies.length
      };
    } catch (error) {
      console.error('Personalized recommendations error:', error);
      return {
        success: false,
        error: 'Failed to get personalized recommendations',
        recommendations: []
      };
    }
  }
});

// Get random movies tool
export const getRandomMovies = tool({
  description: 'Get random movie suggestions, optionally filtered by genre',
  inputSchema: z.object({
    count: z.number().optional().default(5).describe('Number of random movies to return'),
    genres: z.array(z.string()).optional().describe('Optional genres to filter by. Valid genres: Action, Adventure, Animation, Biography, Comedy, Crime, Documentary, Drama, Family, Fantasy, Film-Noir, History, Horror, Music, Musical, Mystery, Romance, Sci-Fi, Short, Sport, Thriller, War, Western')
  }),
  execute: async ({ count, genres }) => {
    try {
      const movieService = getMovieSearchService();
      const movies = await movieService.getRandomMovies(count, genres);

      return {
        success: true,
        movies: movies.map(movie => ({
          id: movie._id,
          title: movie.title,
          plot: movie.plot?.substring(0, 200) + (movie.plot && movie.plot.length > 200 ? '...' : ''),
          genres: movie.genres,
          year: movie.year,
          directors: movie.directors,
          cast: movie.cast?.slice(0, 3),
          rating: movie.imdb?.rating,
          votes: movie.imdb?.votes,
          posterUrl: getMoviePosterUrl(movie)
        })),
        filters: {
          genres: genres || [],
          count
        }
      };
    } catch (error) {
      console.error('Random movies error:', error);
      return {
        success: false,
        error: 'Failed to get random movies',
        movies: []
      };
    }
  }
});

// Search for movie trailers tool
export const searchMovieTrailer = tool({
  description: 'Search for movie trailers on YouTube. Use this when users want to watch a trailer for a specific movie.',
  inputSchema: z.object({
    movieTitle: z.string().describe('The title of the movie to search trailer for'),
    year: z.number().optional().describe('Optional year of the movie for more accurate search'),
    movieId: z.string().optional().describe('Optional movie ID if available')
  }),
  execute: async ({ movieTitle, year, movieId }) => {
    try {
      const trailerUrl = await searchYouTubeTrailer(movieTitle, year);
      
      // If we have a movie ID, get additional movie details
      let movieDetails = null;
      if (movieId) {
        try {
          const movieService = getMovieSearchService();
          const movie = await movieService.getMovieById(movieId);
          if (movie) {
            movieDetails = {
              title: movie.title,
              year: movie.year,
              plot: movie.plot,
              genres: movie.genres,
              directors: movie.directors,
              cast: movie.cast?.slice(0, 5),
              rating: movie.imdb?.rating,
              posterUrl: getMoviePosterUrl(movie)
            };
          }
        } catch (error) {
          console.error('Error fetching movie details:', error);
        }
      }

      return {
        success: true,
        trailer: {
          movieTitle,
          year,
          trailerUrl,
          searchQuery: `${movieTitle}${year ? ` ${year}` : ''} official trailer`
        },
        movieDetails,
        message: trailerUrl 
          ? `Found trailer search for "${movieTitle}"${year ? ` (${year})` : ''}`
          : `Could not find trailer for "${movieTitle}"`
      };
    } catch (error) {
      console.error('Trailer search error:', error);
      return {
        success: false,
        error: 'Failed to search for movie trailer',
        movieTitle
      };
    }
  }
});

// Enhanced movie display tool for rich visual presentation
export const displayMovieCard = tool({
  description: 'Display a rich movie card with poster, plot, cast, and trailer link. Use this to present movie information in a visually appealing way.',
  inputSchema: z.object({
    movieId: z.string().describe('The movie ID to display'),
    includeTrailer: z.boolean().optional().default(false).describe('Whether to include trailer search')
  }),
  execute: async ({ movieId, includeTrailer }) => {
    try {
      const movieService = getMovieSearchService();
      const movie = await movieService.getMovieById(movieId);

      if (!movie) {
        return {
          success: false,
          error: 'Movie not found'
        };
      }

      let trailerUrl = null;
      if (includeTrailer) {
        trailerUrl = await searchYouTubeTrailer(movie.title, movie.year);
      }

      return {
        success: true,
        movieCard: {
          id: movie._id,
          title: movie.title,
          year: movie.year,
          plot: movie.plot,
          fullPlot: (movie as any).fullplot || movie.plot,
          genres: movie.genres,
          directors: movie.directors,
          cast: movie.cast,
          rating: movie.imdb?.rating,
          votes: movie.imdb?.votes,
          runtime: (movie as any).runtime,
          posterUrl: getMoviePosterUrl(movie),
          trailerUrl: trailerUrl,
          awards: (movie as any).awards,
          countries: (movie as any).countries,
          languages: (movie as any).languages
        },
        displayType: 'rich_card'
      };
    } catch (error) {
      console.error('Display movie card error:', error);
      return {
        success: false,
        error: 'Failed to display movie card'
      };
    }
  }
});

// Export all tools
export const movieTools = {
  searchMoviesByPlot,
  getMovieDetails,
  rateMovie,
  getPersonalizedRecommendations,
  getRandomMovies,
  searchMovieTrailer,
  displayMovieCard
};
