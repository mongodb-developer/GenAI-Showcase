"use client"

import { useEffect, useState } from "react"
import { SongCard } from "@/components/song-card"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { InfoTooltip } from "@/components/info-tooltip"
import type { Song } from "@/types/song"
import type { Playlist } from "@/types/playlist"

interface SuggestedSongsProps {
  currentSong: Song | null
  isPlaying: boolean
  onTogglePlay: (song: Song) => void
  onToggleLike: (songId: string) => void
  onAddToPlaylist: (songId: string, playlistId: string) => void
  userLikes: string[]
  playlists: Playlist[]
}

export function SuggestedSongs({
  currentSong,
  isPlaying,
  onTogglePlay,
  onToggleLike,
  onAddToPlaylist,
  userLikes,
  playlists,
}: SuggestedSongsProps) {
  const [suggestedSongs, setSuggestedSongs] = useState<Song[]>([])

  useEffect(() => {
    const fetchSuggestedSongs = async () => {
      try {
        const response = await fetch("/api/songs/suggested")
        if (response.ok) {
          const data = await response.json()
          setSuggestedSongs(data)
        }
      } catch (error) {
        console.error("Failed to fetch suggested songs:", error)
      }
    }

    fetchSuggestedSongs()
  }, [])

  if (suggestedSongs.length === 0) {
    return null
  }

  return (
    <div
      className="space-y-4 p-6 rounded-lg relative overflow-hidden"
      style={{
        backgroundImage: "linear-gradient(to right, rgba(var(--primary-rgb), 0.1), rgba(var(--secondary-rgb), 0.1))",
      }}
    >
      <h2 className="text-3xl font-bold tracking-tight text-primary mb-4 flex items-center">
        Suggested for You
        <InfoTooltip
          content="These songs are recommended based on your liked songs, using MongoDB's vector search capabilities."
          query={`db.songs.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "music_embeddings",
      queryVector: user.liked_embeddings,
      numCandidates: 100,
      limit: 10
    }
  }
])`}
          side="right"
        />
      </h2>
      <ScrollArea className="w-full whitespace-nowrap rounded-md bg-background/30 backdrop-blur-sm">
        <div className="flex w-max space-x-6 p-6">
          {suggestedSongs.map((song) => (
            <SongCard
              key={song._id}
              id={song._id}
              title={song.title}
              artist={song.artist}
              duration={song.duration}
              plays={song.play_count}
              tags={song.tags}
              isPlaying={currentSong?._id === song._id && isPlaying}
              isLiked={userLikes.includes(song._id)}
              onTogglePlay={() => onTogglePlay(song)}
              onToggleLike={() => onToggleLike(song._id)}
              onAddToPlaylist={onAddToPlaylist}
              playlists={playlists}
            />
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  )
}
