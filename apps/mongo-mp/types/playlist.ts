import { Song } from './song'

export interface Playlist {
  _id: string
  name: string
  user_id: string
  songs: Song[]
  created_at: string
  updated_at: string
}

