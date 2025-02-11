"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Music2, PlayCircle, Radio } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SongList } from "@/components/song-list"
import { PlayingSongPopup } from "@/components/playing-song-popup"
import { SearchBar } from "@/components/search-bar"
import { InfoTooltip } from "@/components/info-tooltip"
import { mockFeaturedArtists } from "@/lib/mock-data"
import type { Song } from "@/types/song"
import type { Playlist } from "@/types/playlist"
import Image from "next/image"
import { useUser } from "@/contexts/UserContext"
import { useToast } from "@/components/ui/use-toast"
import { PlaylistPlayer } from "@/components/playlist-player"
import { SuggestedSongs } from "@/components/suggested-songs"

export default function HomeContent() {
  const [songsByGenre, setSongsByGenre] = useState<Record<string, Song[]>>({})
  const [currentSong, setCurrentSong] = useState<Song | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [currentPlaylistId, setCurrentPlaylistId] = useState<string | null>(null)
  const { user } = useUser()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const router = useRouter()

  const fetchSongs = async (query?: string) => {
    try {
      setLoading(true)
      const url = query ? `/api/songs?query=${encodeURIComponent(query)}` : "/api/songs"
      const response = await fetch(url)
      if (!response.ok) throw new Error("Failed to fetch songs")
      const data = await response.json()
      setSongsByGenre(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch songs")
    } finally {
      setLoading(false)
    }
  }

  const fetchPlaylists = async () => {
    try {
      const response = await fetch("/api/playlists")
      if (response.ok) {
        const data = await response.json()
        setPlaylists(data)
      } else {
        console.error("Failed to fetch playlists")
      }
    } catch (error) {
      console.error("Error fetching playlists:", error)
    }
  }

  const fetchPlaylistSongs = async (playlistId: string) => {
    try {
      const response = await fetch(`/api/playlists/${playlistId}/songs`)
      if (response.ok) {
        const data = await response.json()
        if (data.length > 0) {
          setCurrentSong(data[0])
          setIsPlaying(true)
        }
      } else {
        console.error("Failed to fetch playlist songs")
      }
    } catch (error) {
      console.error("Error fetching playlist songs:", error)
    }
  }

  useEffect(() => {
    fetchSongs()
    fetchPlaylists()
  }, [])

  useEffect(() => {
    const songId = searchParams.get("song")
    if (songId) {
      const findAndPlaySong = (songId: string) => {
        for (const genre in songsByGenre) {
          const song = songsByGenre[genre].find((s) => s._id === songId)
          if (song) {
            setCurrentSong(song)
            setIsPlaying(true)
            return
          }
        }
      }
      findAndPlaySong(songId)
    }
  }, [searchParams, songsByGenre])

  useEffect(() => {
    const playlistId = searchParams.get("playlist")
    if (playlistId) {
      fetchPlaylistSongs(playlistId)
    }
  }, [searchParams])

  const handleSearch = (query: string) => {
    fetchSongs(query)
  }

  const handleTogglePlay = (song: Song) => {
    if (currentSong && currentSong._id === song._id) {
      setIsPlaying(!isPlaying)
    } else {
      setCurrentSong(song)
      setIsPlaying(true)
    }
  }

  const handleToggleLike = async (songId: string) => {
    // This function will be passed down to SongList and then to SongCard
    // The actual API call is handled in the SongCard component
  }

  const handleAddToPlaylist = async (songId: string, playlistId: string) => {
    try {
      const response = await fetch(`/api/playlists/${playlistId}/add-song`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ songId }),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Song added to playlist successfully",
        })
        // Optionally, you can update the local state of playlists here
      } else {
        throw new Error("Failed to add song to playlist")
      }
    } catch (error) {
      console.error("Error adding song to playlist:", error)
      toast({
        title: "Error",
        description: "Failed to add song to playlist",
        variant: "destructive",
      })
    }
  }

  const handlePlayPlaylist = (playlistId: string) => {
    setCurrentPlaylistId(playlistId)
  }

  const getRandomSong = useCallback(() => {
    const allSongs = Object.values(songsByGenre).flat()
    if (allSongs.length === 0) return null
    const randomIndex = Math.floor(Math.random() * allSongs.length)
    return allSongs[randomIndex]
  }, [songsByGenre])

  const playRandomSong = useCallback(() => {
    const randomSong = getRandomSong()
    if (randomSong) {
      router.push(`/?song=${randomSong._id}`)
    } else {
      toast({
        title: "Error",
        description: "No songs available to play",
        variant: "destructive",
      })
    }
  }, [getRandomSong, router, toast])

  const selectRandomSong = useCallback(
    (currentSongId: string) => {
      const allSongs = Object.values(songsByGenre).flat()
      const availableSongs = allSongs.filter((song) => song._id !== currentSongId)
      if (availableSongs.length === 0) return
      const randomIndex = Math.floor(Math.random() * availableSongs.length)
      const randomSong = availableSongs[randomIndex]
      setCurrentSong(randomSong)
      setIsPlaying(true)
    },
    [songsByGenre],
  )

  const handleSelectSong = (song: Song) => {
    setCurrentSong(song)
    setIsPlaying(true)
  }

  if (loading) return <div className="flex justify-center items-center min-h-screen">Loading...</div>
  if (error) return <div className="flex justify-center items-center min-h-screen text-red-500">{error}</div>

  return (
    <main className="container mx-auto min-h-screen p-8">
      {/* Hero Section */}
      <section className="mb-12 flex flex-col items-center space-y-4 text-center">
        <Music2 className="h-16 w-16 text-primary" />
        <h1 className="text-4xl font-bold tracking-tighter text-primary sm:text-5xl">
          Welcome to MongoMP
          <InfoTooltip
            content="MongoMP is an educational music streaming platform powered by MongoDB, offering a seamless listening experience."
            side="bottom"
          />
        </h1>
        <p className="max-w-[600px] text-muted-foreground">
          Your premium music streaming platform. Discover millions of songs, create playlists, and enjoy high-quality
          audio.
        </p>
        <div className="flex gap-4">
          <Button size="lg" onClick={playRandomSong}>
            <PlayCircle className="mr-2 h-5 w-5" />
            Start Listening
          </Button>
          <Button variant="secondary" size="lg" onClick={playRandomSong}>
            <Radio className="mr-2 h-5 w-5" />
            Browse Stations
          </Button>
        </div>
      </section>

      {/* Search Bar */}
      <section className="mb-8">
        <div className="flex items-center">
          <SearchBar onSearch={handleSearch} />
          <InfoTooltip
            content="Our search functionality uses MongoDB's text search capabilities for fast and accurate results."
            query={`db.songs.aggregate([
  {
    '$search': {
      'index': 'default',
      'text': {
        'query': 'searchQuery',
        'path': ['title', 'artist', 'genre', 'tags']
      }
    }
  },
  {
    '$project': {
      '_id': 1,
      'title': 1,
      'artist': 1,
      'genre': 1,
      'duration': 1,
      'coverUrl': 1,
      'play_count': 1,
      'tags': 1
    }
  }
])`}
          />
        </div>
      </section>

      {/* Suggested Songs */}
      <section className="mb-12">
        <SuggestedSongs
          currentSong={currentSong}
          isPlaying={isPlaying}
          onTogglePlay={handleTogglePlay}
          onToggleLike={handleToggleLike}
          onAddToPlaylist={handleAddToPlaylist}
          userLikes={user?.likes || []}
          playlists={playlists}
        />
      </section>

      {/* Songs by Genre */}
      <section className="mb-12 space-y-8">
        <h2 className="text-2xl font-semibold tracking-tight flex items-center">
          Songs by Genre
          <InfoTooltip
            content="Songs are grouped by genre, leveraging MongoDB's aggregation pipeline for efficient data organization."
            query={`const songs = await db.collection("songs").find({}).toArray()
const songsByGenre = songs.reduce((acc, song) => {
  if (!acc[song.genre]) {
    acc[song.genre] = []
  }
  acc[song.genre].push({
    ...song,
    _id: song._id.toString()
  })
  return acc
}, {})`}
          />
        </h2>
        {Object.entries(songsByGenre).map(([genre, songs]) => (
          <SongList
            key={genre}
            genre={genre}
            songs={songs}
            currentSong={currentSong}
            isPlaying={isPlaying}
            onTogglePlay={handleTogglePlay}
            onToggleLike={handleToggleLike}
            onAddToPlaylist={handleAddToPlaylist}
            userLikes={user?.likes || []}
            playlists={playlists}
            onPlayPlaylist={handlePlayPlaylist}
          />
        ))}
      </section>

      {/* Featured Artists */}
      <section className="mb-12">
        <h2 className="mb-6 text-2xl font-semibold tracking-tight flex items-center">
          Featured Artists
          <InfoTooltip
            content="Featured artists are dynamically selected based on popularity metrics stored in MongoDB."
            query={`// Note: This is a mock query as we're currently using static data
db.artists.find({}).sort({ followers: -1 }).limit(6).toArray()`}
          />
        </h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {mockFeaturedArtists.map((artist) => (
            <div key={artist.id} className="group relative overflow-hidden rounded-lg bg-card">
              <div className="relative aspect-square">
                <Image
                  src={artist.imageUrl || "/placeholder.svg"}
                  alt={artist.name}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  className="object-cover transition-all group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-0 p-4">
                  <h3 className="font-semibold text-white">{artist.name}</h3>
                  <p className="text-sm text-white/70">{artist.genre}</p>
                  <p className="text-xs text-white/50">{artist.followers.toLocaleString()} followers</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {currentSong && (
        <PlayingSongPopup
          song={currentSong}
          isPlaying={isPlaying}
          onTogglePlay={() => setIsPlaying(!isPlaying)}
          onClose={() => {
            setCurrentSong(null)
            setIsPlaying(false)
          }}
          onSelectRandomSong={selectRandomSong}
          onSelectSong={handleSelectSong}
        />
      )}
      {currentPlaylistId && (
        <PlaylistPlayer playlistId={currentPlaylistId} onClose={() => setCurrentPlaylistId(null)} />
      )}
    </main>
  )
}
