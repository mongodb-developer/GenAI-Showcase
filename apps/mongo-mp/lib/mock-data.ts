export const mockPlaylists = [
  {
    id: "1",
    name: "Chill Vibes",
    coverUrl: "/placeholder.svg?height=400&width=400",
    songCount: 45,
    duration: "2h 35m"
  },
  {
    id: "2",
    name: "Workout Mix",
    coverUrl: "/placeholder.svg?height=400&width=400",
    songCount: 32,
    duration: "1h 45m"
  },
  {
    id: "3",
    name: "Focus Flow",
    coverUrl: "/placeholder.svg?height=400&width=400",
    songCount: 28,
    duration: "2h 10m"
  }
]

export const mockSongs = [
  {
    id: "1",
    title: "Midnight Dreams",
    artist: "Luna Wave",
    genre: "Electronic",
    duration: "3:45",
    coverUrl: "/placeholder.svg?height=400&width=400",
    plays: 1234567
  },
  {
    id: "2",
    title: "Electric Soul",
    artist: "Neon Pulse",
    genre: "Electronic",
    duration: "4:20",
    coverUrl: "/placeholder.svg?height=400&width=400",
    plays: 892345
  },
  {
    id: "3",
    title: "Ocean Breeze",
    artist: "Coastal Beats",
    genre: "Ambient",
    duration: "3:55",
    coverUrl: "/placeholder.svg?height=400&width=400",
    plays: 654321
  },
  {
    id: "4",
    title: "Neon Nights",
    artist: "Synthwave Collective",
    genre: "Synthwave",
    duration: "5:10",
    coverUrl: "/placeholder.svg?height=400&width=400",
    plays: 789012
  },
  {
    id: "5",
    title: "Chill Vibes",
    artist: "Lofi Dreamers",
    genre: "Lo-Fi",
    duration: "3:30",
    coverUrl: "/placeholder.svg?height=400&width=400",
    plays: 543210
  },
  {
    id: "6",
    title: "Urban Rhythm",
    artist: "City Soundscape",
    genre: "Hip Hop",
    duration: "4:05",
    coverUrl: "/placeholder.svg?height=400&width=400",
    plays: 678901
  }
]

export const mockFeaturedArtists = [
  {
    id: "1",
    name: "Luna Wave",
    genre: "Electronic",
    followers: 1200000,
    imageUrl: "/placeholder.svg?height=400&width=400"
  },
  {
    id: "2",
    name: "Neon Pulse",
    genre: "Synthwave",
    followers: 890000,
    imageUrl: "/placeholder.svg?height=400&width=400"
  },
  {
    id: "3",
    name: "Coastal Beats",
    genre: "Ambient",
    followers: 750000,
    imageUrl: "/placeholder.svg?height=400&width=400"
  }
]

export const mockUsers = [
  {
    _id: "user1",
    name: "John Doe",
    email: "john.doe@example.com",
    likes: ["1", "2"],
    playlists: [
      {
        playlist_id: "playlist1",
        name: "Chill Vibes",
        song_ids: ["3", "4"]
      }
    ],
    last_played: [
      {song_id: "5", timestamp: "2025-01-15T12:00:00Z"},
      {song_id: "2", timestamp: "2025-01-14T18:30:00Z"}
    ]
  },
  {
    _id: "user2",
    name: "Jane Smith",
    email: "jane.smith@example.com",
    likes: ["3", "4"],
    playlists: [
      {
        playlist_id: "playlist2",
        name: "Workout Mix",
        song_ids: ["1", "5"]
      }
    ],
    last_played: [
      {song_id: "1", timestamp: "2025-01-16T09:30:00Z"},
      {song_id: "4", timestamp: "2025-01-15T20:15:00Z"}
    ]
  }
]

