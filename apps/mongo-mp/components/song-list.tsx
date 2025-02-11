'use client'

import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { SongCard } from "@/components/song-card"
import { InfoTooltip } from "@/components/info-tooltip"
import { Song } from "@/types/song"
import { Playlist } from "@/types/playlist"
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState, useRef, useEffect } from 'react';

interface SongListProps {
  genre: string
  songs: Song[]
  currentSong: Song | null
  isPlaying: boolean
  onTogglePlay: (song: Song) => void
  onToggleLike: (songId: string) => void
  onAddToPlaylist: (songId: string, playlistId: string) => void
  userLikes: string[]
  playlists: Playlist[]
}

export function SongList({
  genre,
  songs,
  currentSong,
  isPlaying,
  onTogglePlay,
  onToggleLike,
  onAddToPlaylist,
  userLikes,
  playlists
}: SongListProps) {
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const checkScroll = () => {
      if (scrollAreaRef.current) {
        setCanScrollLeft(scrollAreaRef.current.scrollLeft > 0)
      }
    }

    const scrollArea = scrollAreaRef.current
    if (scrollArea) {
      scrollArea.addEventListener('scroll', checkScroll)
      // Initial check
      checkScroll()
    }

    return () => {
      if (scrollArea) {
        scrollArea.removeEventListener('scroll', checkScroll)
      }
    }
  }, [])

  return (
    <div className="space-y-4 p-6 rounded-lg relative overflow-hidden" style={{
      backgroundImage: 'linear-gradient(to right, rgba(var(--primary-rgb), 0.1), rgba(var(--secondary-rgb), 0.1))'
    }}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -left-1/4 -top-1/4 w-1/2 h-1/2 bg-gradient-radial from-primary/20 to-transparent rounded-full" />
        <div className="absolute -right-1/4 -bottom-1/4 w-1/2 h-1/2 bg-gradient-radial from-secondary/20 to-transparent rounded-full" />
      </div>
      <h2 className="text-3xl font-bold tracking-tight text-primary mb-4 flex items-center">
        {genre}
        <InfoTooltip
          content={`Songs in the ${genre} genre. MongoDB's flexible schema allows for easy categorization and retrieval of songs by genre.`}
          query={`db.collection("songs").find({ genre: "${genre}" }).toArray()`}
          side="right"
        />
      </h2>
      <ScrollArea className="w-full whitespace-nowrap rounded-md bg-background/30 backdrop-blur-sm relative">
        <div
          ref={scrollAreaRef}
          className="flex w-max space-x-6 p-6"
        >
          {songs.map((song) => (
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
        <div
          className={cn(
            "absolute left-0 top-1/2 -translate-y-1/2 bg-gradient-to-r from-background to-transparent p-2 transition-opacity duration-300 sm:hidden",
            canScrollLeft ? "opacity-100" : "opacity-0"
          )}
        >
          <ChevronLeft className="h-6 w-6 text-primary" />
        </div>
      </ScrollArea>
    </div>
  )
}
