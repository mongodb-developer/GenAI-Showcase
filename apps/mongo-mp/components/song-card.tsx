'use client'

import { useMemo, useState } from 'react'
import { Play, Pause, Heart, Plus } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tag } from "@/components/tag"
import { formatDuration } from "@/lib/utils"
import { useUser } from '@/contexts/UserContext'
import { Playlist } from '@/types/playlist'
import { InfoTooltip } from "@/components/info-tooltip"

interface SongCardProps {
  id: string
  title: string
  artist: string
  duration: number
  plays?: number
  tags: string[]
  isPlaying: boolean
  isLiked: boolean
  onTogglePlay: (id: string) => void
  onToggleLike: (id: string) => void
  onAddToPlaylist: (songId: string, playlistId: string) => void
  playlists: Playlist[]
}

export function SongCard({
  id,
  title,
  artist,
  duration,
  plays,
  tags,
  isPlaying,
  isLiked,
  onTogglePlay,
  onToggleLike,
  onAddToPlaylist,
  playlists
}: SongCardProps) {
  const { user } = useUser()
  const [likeStatus, setLikeStatus] = useState(isLiked)

  const handleTogglePlay = () => {
    onTogglePlay(id)
  }

  const handleToggleLike = async () => {
    if (user) {
      setLikeStatus(!likeStatus)
      onToggleLike(id)
      try {
        const response = await fetch('/api/user/toggle-like', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ songId: id }),
        })
        if (!response.ok) {
          setLikeStatus(likeStatus) // Revert if the API call fails
          throw new Error('Failed to toggle like')
        }
      } catch (error) {
        console.error('Error toggling like:', error)
        setLikeStatus(likeStatus) // Revert if there's an error
      }
    }
  }

  const gradientStyle = useMemo(() => {
    const color1 = `hsl(${Math.random() * 360}, 70%, 60%)`
    const color2 = `hsl(${Math.random() * 360}, 70%, 60%)`
    return {
      backgroundImage: `linear-gradient(135deg, ${color1}, ${color2})`
    }
  }, [])

  return (
    <Card
      className="group relative overflow-hidden border-0 bg-card transition-colors hover:bg-accent w-[250px] sm:w-[200px]"
    >
      <CardContent className="p-0">
        <div className="relative aspect-square sm:aspect-[4/5]" style={gradientStyle}>
          <Button
            size="icon"
            variant="secondary"
            className="absolute bottom-2 right-2 h-10 w-10 translate-y-4 opacity-0 transition-all group-hover:translate-y-0 group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation()
              handleTogglePlay()
            }}
          >
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className={`absolute top-2 right-2 h-8 w-8 ${likeStatus ? 'text-red-500' : 'text-white'}`}
            onClick={(e) => {
              e.stopPropagation()
              handleToggleLike()
            }}
          >
            <Heart className={`h-5 w-5 ${likeStatus ? 'fill-current' : ''}`} />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="absolute top-2 left-2 h-8 w-8 text-white"
              >
                <Plus className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {playlists.map((playlist) => (
                <DropdownMenuItem
                  key={playlist._id}
                  onClick={() => onAddToPlaylist(id, playlist._id)}
                >
                  Add to {playlist.name}
                  <InfoTooltip
                    content="MongoDB uses $addToSet to efficiently add songs to playlists without duplicates."
                    query={`db.playlists.updateOne(
  { _id: ObjectId("${playlist._id}") },
  { $addToSet: { songs: ObjectId("${id}") } }
)`}
                    side="right"
                  />
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="p-4">
          <h3 className="font-semibold text-foreground truncate">{title}</h3>
          <p className="text-sm text-muted-foreground truncate">{artist}</p>
          <div className="mt-2 flex flex-wrap">
            {tags.map((tag) => (
              <Tag key={tag} name={tag} />
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>{plays !== undefined ? `${plays.toLocaleString()} plays` : 'N/A plays'}</span>
            <span>{formatDuration(duration)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
