'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Play, Info } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { InfoTooltip } from "@/components/info-tooltip"
import { Badge } from "@/components/ui/badge"
import { useUser } from '@/contexts/UserContext'
import { Playlist } from '@/types/playlist'
import { cn } from "@/lib/utils"

export function LibraryContent() {
  const { user } = useUser()
  const router = useRouter()
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [newPlaylistName, setNewPlaylistName] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) {
      fetchPlaylists()
    }
  }, [user])

  const fetchPlaylists = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/playlists')
      if (response.ok) {
        const data = await response.json()
        setPlaylists(data)
      } else {
        console.error('Failed to fetch playlists')
      }
    } catch (error) {
      console.error('Error fetching playlists:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return

    try {
      const response = await fetch('/api/playlists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newPlaylistName }),
      })

      if (response.ok) {
        const newPlaylist = await response.json()
        setPlaylists([...playlists, newPlaylist])
        setNewPlaylistName('')
        setIsDialogOpen(false)
      } else {
        console.error('Failed to create playlist')
      }
    } catch (error) {
      console.error('Error creating playlist:', error)
    }
  }

  const handleDeletePlaylist = async (playlistId: string) => {
    try {
      const response = await fetch(`/api/playlists/${playlistId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setPlaylists(playlists.filter(playlist => playlist._id !== playlistId))
      } else {
        console.error('Failed to delete playlist')
      }
    } catch (error) {
      console.error('Error deleting playlist:', error)
    }
  }

  const getUniqueGenres = (songs: any[]) => {
    return [...new Set(songs.map(song => song.genre))];
  }

  if (!user) {
    return <div className="text-center mt-8">Please log in to view your library.</div>
  }

  if (loading) {
    return <div className="text-center mt-8">Loading your playlists...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Your Library</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Create Playlist
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create New Playlist</DialogTitle>
              <DialogDescription>
                Enter a name for your new playlist.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  Name
                </Label>
                <Input
                  id="name"
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  className="col-span-3"
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreatePlaylist}>
                Create Playlist
                <InfoTooltip
                  content="MongoDB creates a new document in the playlists collection with a unique _id."
                  query={`db.playlists.insertOne({
  name: "${newPlaylistName}",
  user_id: ObjectId("${user.id}"),
  songs: [],
  created_at: new Date(),
  updated_at: new Date()
})`}
                  side="top"
                />
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {playlists.map((playlist) => {
          const genres = getUniqueGenres(playlist.songs);
          return (
            <Card
              key={playlist._id}
              className="relative bg-zinc-900 text-white overflow-hidden hover:bg-zinc-800 transition-colors"
            >
              <CardContent className="p-6">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold mb-2">{playlist.name}</h2>
                  <p className="text-zinc-400 mb-4">{playlist.songs.length} songs</p>
                  <div className="flex flex-wrap gap-2">
                    {genres.map((genre) => (
                      <Badge
                        key={genre}
                        variant="secondary"
                        className="bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500/30"
                      >
                        {genre}
                      </Badge>
                    ))}
                  </div>
                </div>
                <ScrollArea className="h-[200px] mb-6">
                  {playlist.songs.length > 0 ? (
                    <ul className="space-y-2">
                      {playlist.songs.map((song, idx) => (
                        <li
                          key={song._id}
                          className="flex items-center text-sm text-zinc-300 p-2 rounded hover:bg-zinc-700"
                        >
                          <span className="w-6 text-zinc-500">{idx + 1}</span>
                          <div className="flex-1">
                            <p className="font-medium">{song.title}</p>
                            <p className="text-zinc-400">{song.artist}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-zinc-500 text-center py-4">No songs in this playlist</p>
                  )}
                </ScrollArea>
                <div className="flex items-center justify-between gap-4">
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => handleDeletePlaylist(playlist._id)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                    <InfoTooltip
                      content="MongoDB removes the playlist document from the collection."
                      query={`db.playlists.deleteOne({ _id: ObjectId("${playlist._id}") })`}
                      side="top"
                    />
                  </Button>
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={() => router.push(`/?playlist=${playlist._id}`)}
                  >
                    <Play className="mr-2 h-4 w-4" /> Play
                    <InfoTooltip
                      content="MongoDB retrieves the playlist's songs for playback."
                      query={`db.playlists.aggregate([
  { $match: { _id: ObjectId("${playlist._id}") } },
  { $lookup: {
      from: "songs",
      localField: "songs",
      foreignField: "_id",
      as: "songDetails"
    }
  }
])`}
                      side="top"
                    />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-2"
                  >
                    <InfoTooltip
                      content={`Created on ${new Date(playlist.created_at).toLocaleDateString()}`}
                      side="left"
                    >
                      <Info className="h-4 w-4" />
                    </InfoTooltip>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  )
}
