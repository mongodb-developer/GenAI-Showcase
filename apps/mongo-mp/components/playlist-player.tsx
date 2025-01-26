'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Slider } from "@/components/ui/slider"
import { Play, Pause, SkipForward, SkipBack, Volume2 } from 'lucide-react'
import { Song } from "@/types/song"
import { formatDuration } from "@/lib/utils"

interface PlaylistPlayerProps {
  playlistId: string | null;
  onClose: () => void;
}

export function PlaylistPlayer({ playlistId, onClose }: PlaylistPlayerProps) {
  const [songs, setSongs] = useState<Song[]>([])
  const [currentSongIndex, setCurrentSongIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [volume, setVolume] = useState(1)
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    if (playlistId) {
      fetchPlaylistSongs(playlistId)
    }
  }, [playlistId])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const updateTime = () => setCurrentTime(audio.currentTime)
    audio.addEventListener('timeupdate', updateTime)
    audio.addEventListener('ended', playNext)

    return () => {
      audio.removeEventListener('timeupdate', updateTime)
      audio.removeEventListener('ended', playNext)
    }
  }, [])

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume
    }
  }, [volume])

  const fetchPlaylistSongs = async (id: string) => {
    try {
      const response = await fetch(`/api/playlists/${id}/songs`)
      if (response.ok) {
        const data = await response.json()
        setSongs(data)
      } else {
        console.error('Failed to fetch playlist songs')
      }
    } catch (error) {
      console.error('Error fetching playlist songs:', error)
    }
  }

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
      } else {
        audioRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const playNext = () => {
    setCurrentSongIndex((prevIndex) => {
      const nextIndex = (prevIndex + 1) % songs.length
      if (audioRef.current) {
        audioRef.current.src = songs[nextIndex].url
        audioRef.current.play()
        setIsPlaying(true)
      }
      return nextIndex
    })
  }

  const playPrevious = () => {
    setCurrentSongIndex((prevIndex) => {
      const nextIndex = (prevIndex - 1 + songs.length) % songs.length
      if (audioRef.current) {
        audioRef.current.src = songs[nextIndex].url
        audioRef.current.play()
        setIsPlaying(true)
      }
      return nextIndex
    })
  }

  const handleSeek = (value: number[]) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value[0]
    }
  }

  const handleVolumeChange = (value: number[]) => {
    setVolume(value[0])
  }

  const currentSong = songs[currentSongIndex]

  if (!playlistId || !currentSong) return null

  return (
    <Card className="fixed bottom-4 right-4 w-96 shadow-lg bg-zinc-900 text-white border-zinc-800">
      <CardHeader className="pb-2">
        <CardTitle className="flex justify-between items-center text-lg">
          <span>Now Playing</span>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-zinc-400 hover:text-white">
            Close
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <h3 className="font-semibold text-lg">{currentSong.title}</h3>
          <p className="text-sm text-zinc-400">{currentSong.artist}</p>
        </div>
        
        <audio 
          ref={audioRef} 
          src={currentSong.url}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />

        <div className="space-y-4">
          <div className="space-y-2">
            <Slider
              value={[currentTime]}
              max={currentSong.duration}
              step={1}
              onValueChange={handleSeek}
              className="[&_[role=slider]]:h-4 [&_[role=slider]]:w-4"
            />
            <div className="flex justify-between text-xs text-zinc-400">
              <span>{formatDuration(currentTime)}</span>
              <span>{formatDuration(currentSong.duration)}</span>
            </div>
          </div>

          <div className="flex items-center justify-center space-x-4">
            <Button size="icon" variant="ghost" onClick={playPrevious}>
              <SkipBack className="h-5 w-5" />
            </Button>
            <Button size="icon" onClick={togglePlay} className="h-12 w-12">
              {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
            </Button>
            <Button size="icon" variant="ghost" onClick={playNext}>
              <SkipForward className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex items-center space-x-2">
            <Volume2 className="h-4 w-4 text-zinc-400" />
            <Slider
              value={[volume]}
              max={1}
              step={0.01}
              onValueChange={handleVolumeChange}
              className="w-24"
            />
          </div>
        </div>

        <div className="mt-4">
          <h4 className="text-sm font-medium text-zinc-400 mb-2">Up Next</h4>
          <ScrollArea className="h-32">
            <ul className="space-y-1">
              {songs.map((song, index) => (
                <li 
                  key={song._id} 
                  className={cn(
                    "text-sm p-2 rounded cursor-pointer flex items-center",
                    index === currentSongIndex 
                      ? "bg-emerald-500/20 text-emerald-500" 
                      : "hover:bg-zinc-800 text-zinc-300"
                  )}
                  onClick={() => {
                    setCurrentSongIndex(index)
                    setIsPlaying(true)
                    if (audioRef.current) {
                      audioRef.current.src = song.url
                      audioRef.current.play()
                    }
                  }}
                >
                  <span className="w-6 text-zinc-500">{index + 1}</span>
                  <div>
                    <p className="font-medium">{song.title}</p>
                    <p className="text-zinc-400">{song.artist}</p>
                  </div>
                </li>
              ))}
            </ul>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  )
}

