import { MongoClient, ObjectId } from 'mongodb';
import { OpenAIEmbeddings } from '@langchain/openai';

interface Movie {
  _id: string;
  title: string;
  plot?: string;
  genres?: string[];
  year?: number;
  directors?: string[];
  cast?: string[];
  imdb?: {
    rating?: number;
    votes?: number;
  };
  poster?: string;
  fullplot?: string;
  runtime?: number;
  awards?: string;
  countries?: string[];
  languages?: string[];
  plot_embedding?: number[];
}

interface MovieSearchOptions {
  limit?: number;
  genres?: string[];
  yearRange?: { min?: number; max?: number };
  minRating?: number;
}

class MovieSearchService {
  private client: MongoClient;
  private embeddings: OpenAIEmbeddings;
  private dbName: string;
  private collectionName: string;

  constructor() {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI environment variable is required');
    }

    this.client = new MongoClient(mongoUri);
    this.dbName = 'sample_mflix';
    this.collectionName = 'embedded_movies';
    
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }

    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: openaiKey,
      modelName: 'text-embedding-3-small',
    });
  }

  async connect() {
    await this.client.connect();
  }

  async searchMoviesByPlot(query: string, options: MovieSearchOptions = {}): Promise<Movie[]> {
    try {
      await this.connect();
      
      // Generate embedding for the query
      const queryEmbedding = await this.embeddings.embedQuery(query);
      
      const collection = this.client.db(this.dbName).collection(this.collectionName);
      
      // Build aggregation pipeline for vector search
      const pipeline: any[] = [
        {
          $vectorSearch: {
            index: 'vector_index', // Assuming this index exists
            path: 'plot_embedding',
            queryVector: queryEmbedding,
            numCandidates: (options.limit || 10) * 10,
            limit: options.limit || 10
          }
        }
      ];

      // Add filters if provided
      const matchConditions: any = {};
      
      if (options.genres && options.genres.length > 0) {
        matchConditions.genres = { $in: options.genres };
      }
      
      if (options.yearRange) {
        if (options.yearRange.min) {
          matchConditions.year = { ...matchConditions.year, $gte: options.yearRange.min };
        }
        if (options.yearRange.max) {
          matchConditions.year = { ...matchConditions.year, $lte: options.yearRange.max };
        }
      }
      
      if (options.minRating) {
        matchConditions['imdb.rating'] = { $gte: options.minRating };
      }

      if (Object.keys(matchConditions).length > 0) {
        pipeline.push({ $match: matchConditions });
      }

      // Add score and project fields
      pipeline.push({
        $addFields: {
          score: { $meta: 'vectorSearchScore' }
        }
      });

      pipeline.push({
        $project: {
          title: 1,
          plot: 1,
          fullplot: 1,
          genres: 1,
          year: 1,
          directors: 1,
          cast: 1,
          imdb: 1,
          poster: 1,
          runtime: 1,
          awards: 1,
          countries: 1,
          languages: 1,
          score: 1
        }
      });

      const results = await collection.aggregate(pipeline).toArray();
      
      return results.map(movie => ({
        _id: movie._id.toString(),
        title: movie.title,
        plot: movie.plot,
        fullplot: movie.fullplot,
        genres: movie.genres,
        year: movie.year,
        directors: movie.directors,
        cast: movie.cast,
        imdb: movie.imdb,
        poster: movie.poster,
        runtime: movie.runtime,
        awards: movie.awards,
        countries: movie.countries,
        languages: movie.languages
      }));
      
    } catch (error) {
      console.error('Movie search error:', error);
      // Fallback to text search if vector search fails
      return await this.fallbackTextSearch(query, options);
    }
  }

  async fallbackTextSearch(query: string, options: MovieSearchOptions = {}): Promise<Movie[]> {
    try {
      await this.connect();
      const collection = this.client.db(this.dbName).collection(this.collectionName);
      
      const searchConditions: any = {
        $or: [
          { title: { $regex: query, $options: 'i' } },
          { plot: { $regex: query, $options: 'i' } },
          { genres: { $regex: query, $options: 'i' } }
        ]
      };

      // Add filters
      if (options.genres && options.genres.length > 0) {
        searchConditions.genres = { $in: options.genres };
      }
      
      if (options.yearRange) {
        if (options.yearRange.min) {
          searchConditions.year = { ...searchConditions.year, $gte: options.yearRange.min };
        }
        if (options.yearRange.max) {
          searchConditions.year = { ...searchConditions.year, $lte: options.yearRange.max };
        }
      }
      
      if (options.minRating) {
        searchConditions['imdb.rating'] = { $gte: options.minRating };
      }

      const results = await collection
        .find(searchConditions)
        .project({
          title: 1,
          plot: 1,
          fullplot: 1,
          genres: 1,
          year: 1,
          directors: 1,
          cast: 1,
          imdb: 1,
          poster: 1,
          runtime: 1,
          awards: 1,
          countries: 1,
          languages: 1
        })
        .limit(options.limit || 10)
        .sort({ 'imdb.rating': -1 })
        .toArray();

      return results.map(movie => ({
        _id: movie._id.toString(),
        title: movie.title,
        plot: movie.plot,
        fullplot: movie.fullplot,
        genres: movie.genres,
        year: movie.year,
        directors: movie.directors,
        cast: movie.cast,
        imdb: movie.imdb,
        poster: movie.poster,
        runtime: movie.runtime,
        awards: movie.awards,
        countries: movie.countries,
        languages: movie.languages
      }));
      
    } catch (error) {
      console.error('Fallback search error:', error);
      return [];
    }
  }

  async getMovieById(movieId: string): Promise<Movie | null> {
    try {
      await this.connect();
      const collection = this.client.db(this.dbName).collection(this.collectionName);
      
      // Try to find by ObjectId first, then by string
      let movie;
      try {
        movie = await collection.findOne({ _id: new ObjectId(movieId) });
      } catch {
        // If ObjectId conversion fails, try as string (for cases where _id might be stored as string)
        movie = await collection.findOne({ _id: movieId as any });
      }
      
      if (!movie) return null;
      
      return {
        _id: movie._id.toString(),
        title: movie.title,
        plot: movie.plot,
        fullplot: movie.fullplot,
        genres: movie.genres,
        year: movie.year,
        directors: movie.directors,
        cast: movie.cast,
        imdb: movie.imdb,
        poster: movie.poster,
        runtime: movie.runtime,
        awards: movie.awards,
        countries: movie.countries,
        languages: movie.languages
      };
      
    } catch (error) {
      console.error('Get movie by ID error:', error);
      return null;
    }
  }

  async getRandomMovies(count: number = 5, genres?: string[]): Promise<Movie[]> {
    try {
      await this.connect();
      const collection = this.client.db(this.dbName).collection(this.collectionName);
      
      const matchStage: any = {};
      if (genres && genres.length > 0) {
        matchStage.genres = { $in: genres };
      }
      
      const pipeline = [
        ...(Object.keys(matchStage).length > 0 ? [{ $match: matchStage }] : []),
        { $sample: { size: count } },
        {
          $project: {
            title: 1,
            plot: 1,
            fullplot: 1,
            genres: 1,
            year: 1,
            directors: 1,
            cast: 1,
            imdb: 1,
            poster: 1,
            runtime: 1,
            awards: 1,
            countries: 1,
            languages: 1
          }
        }
      ];
      
      const results = await collection.aggregate(pipeline).toArray();
      
      return results.map(movie => ({
        _id: movie._id.toString(),
        title: movie.title,
        plot: movie.plot,
        fullplot: movie.fullplot,
        genres: movie.genres,
        year: movie.year,
        directors: movie.directors,
        cast: movie.cast,
        imdb: movie.imdb,
        poster: movie.poster,
        runtime: movie.runtime,
        awards: movie.awards,
        countries: movie.countries,
        languages: movie.languages
      }));
      
    } catch (error) {
      console.error('Get random movies error:', error);
      return [];
    }
  }

  async close() {
    await this.client.close();
  }
}

// Singleton instance
let movieSearchInstance: MovieSearchService | null = null;

export function getMovieSearchService(): MovieSearchService {
  if (!movieSearchInstance) {
    movieSearchInstance = new MovieSearchService();
  }
  return movieSearchInstance;
}

export { MovieSearchService, type Movie, type MovieSearchOptions };
