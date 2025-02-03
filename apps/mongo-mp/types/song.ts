export interface Song {
  _id: string;
  title: string;
  artist: string;
  duration: number;
  genre: string;
  tags: string[];
  play_count: number;
  last_played: string;
  coverUrl: string;
  url: string;
  music_embeddings?: number[];
}

