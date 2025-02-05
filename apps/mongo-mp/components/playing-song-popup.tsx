'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import { X, Play, Pause, SkipBack, SkipForward, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { InfoTooltip } from "@/components/info-tooltip"
import { ScrollArea } from "@/components/ui/scroll-area"
import { formatDuration } from "@/lib/utils"
import { Song } from "@/types/song"
import RetroEqualizer from './RetroEqualizer'

interface PlayingSongPopupProps {
  song: Song
  isPlaying: boolean
  onTogglePlay: () => void
  onClose: () => void
  onSelectRandomSong: (currentSongId: string) => void
  onSelectSong: (song: Song) => void
}

export function PlayingSongPopup({ song, isPlaying, onTogglePlay, onClose, onSelectRandomSong, onSelectSong }: PlayingSongPopupProps) {
  const [currentTime, setCurrentTime] = useState(0)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playCountIncremented, setPlayCountIncremented] = useState(false)
  const [similarSongs, setSimilarSongs] = useState<Song[]>([])
  const [showSimilarSongs, setShowSimilarSongs] = useState(false)

  const gradientStyle = useMemo(() => {
    const color1 = `hsl(${Math.random() * 360}, 70%, 60%)`
    const color2 = `hsl(${Math.random() * 360}, 70%, 60%)`
    return {
      backgroundImage: `linear-gradient(135deg, ${color1}, ${color2})`
    }
  }, [song._id])

  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play()
      } else {
        audioRef.current.pause()
      }
    }
  }, [isPlaying, song])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const updateTime = () => setCurrentTime(audio.currentTime)
    audio.addEventListener('timeupdate', updateTime)

    const handlePlay = async () => {
      if (!playCountIncremented) {
        try {
          const response = await fetch('/api/songs/increment-plays', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ songId: song._id }),
          })
          if (response.ok) {
            setPlayCountIncremented(true)
          }
        } catch (error) {
          console.error('Failed to increment play count:', error)
        }
      }
    }
    audio.addEventListener('play', handlePlay)

    return () => {
      audio.removeEventListener('timeupdate', updateTime)
      audio.removeEventListener('play', handlePlay)
    }
  }, [song._id, playCountIncremented])

  useEffect(() => {
    const fetchSimilarSongs = async () => {
      try {
        const response = await fetch(`/api/songs/similar?songId=${song._id}`)
        if (response.ok) {
          const data = await response.json()
          setSimilarSongs(data)
        }
      } catch (error) {
        console.error('Failed to fetch similar songs:', error)
      }
    }

    fetchSimilarSongs()
  }, [song._id])

  const handleSeek = (value: number[]) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value[0]
    }
  }

  const handleNextPrevious = () => {
    onSelectRandomSong(song._id)
  }

  return (
    <Card className="fixed bottom-16 sm:bottom-4 right-4 w-96 shadow-lg z-50">
      <CardContent className="p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold flex items-center">
            Now Playing
            <InfoTooltip content="Play count and last played timestamp are updated in MongoDB in real-time as you listen." />
          </h3>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center space-x-4 mb-4">
          <div className="relative w-16 h-16 rounded-md" style={gradientStyle}></div>
          <div>
            <p className="font-medium">{song.title}</p>
            <p className="text-sm text-muted-foreground">{song.artist}</p>
          </div>
        </div>
        <RetroEqualizer bpm={120} isPlaying={isPlaying} />
        <audio ref={audioRef} src={song.url} />

        <Slider
          value={[currentTime]}
          max={song.duration}
          step={1}
          className="my-4"
          onValueChange={handleSeek}
        />
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>{formatDuration(currentTime)}</span>
          <span>{formatDuration(song.duration)}</span>
        </div>
        <div className="flex justify-center items-center space-x-2 mt-4">
          <Button variant="ghost" size="icon" onClick={handleNextPrevious}>
            <SkipBack className="h-4 w-4" />
          </Button>
          <Button size="icon" onClick={onTogglePlay}>
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={handleNextPrevious}>
            <SkipForward className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-4">
          <Button
            variant="ghost"
            className="w-full justify-between"
            onClick={() => setShowSimilarSongs(!showSimilarSongs)}
          >
            Same Vibes
            <InfoTooltip
              content="Find similar songs using MongoDB's vector search capabilities. Songs are matched based on their musical characteristics encoded as high-dimensional vectors."
              query={`db.songs.aggregate([
  {
    '$vectorSearch': {
      'index': 'vector_index',
      'path': 'music_embeddings',
      'queryVector': currentSong.music_embeddings,
      'numCandidates': 50,
      'limit': 6
    }
  },
  {
    '$match': {
      '_id': { '$ne': currentSongId }
    }
  },
  {
    '$project': {
      '_id': 1,
      'title': 1,
      'artist': 1,
      'genre': 1,
      'duration': 1,
      'play_count': 1,
      'score': { '$meta': 'vectorSearchScore' }
    }
  }
])`}
              side="top"
            />
            {showSimilarSongs ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
          {showSimilarSongs && (
            <ScrollArea className="h-40 mt-2">
              {similarSongs.map((similarSong) => (
                <div
                  key={similarSong._id}
                  className="flex items-center justify-between p-2 hover:bg-accent cursor-pointer"
                  onClick={() => onSelectSong(similarSong)}
                >
                  <div>
                    <p className="font-medium">{similarSong.title}</p>
                    <p className="text-sm text-muted-foreground">{similarSong.artist}</p>
                  </div>
                  <Button variant="ghost" size="icon">
                    <Play className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </ScrollArea>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
