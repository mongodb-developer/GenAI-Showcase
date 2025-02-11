'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { mockUsers, mockSongs } from "@/lib/mock-data"

export function UserManagement() {
  const [users, setUsers] = useState(mockUsers)
  const [selectedUser, setSelectedUser] = useState(users[0])

  const handleUpdateUser = (field: string, value: string) => {
    const updatedUser = { ...selectedUser, [field]: value }
    setSelectedUser(updatedUser)
    setUsers(users.map(user => user._id === updatedUser._id ? updatedUser : user))
  }

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>User Management</CardTitle>
        <CardDescription>Manage user profiles and preferences</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={users[0]._id} className="w-full">
          <TabsList className="grid grid-cols-2 mb-4">
            {users.map(user => (
              <TabsTrigger
                key={user._id}
                value={user._id}
                onClick={() => setSelectedUser(user)}
              >
                {user.name}
              </TabsTrigger>
            ))}
          </TabsList>
          {users.map(user => (
            <TabsContent key={user._id} value={user._id}>
              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  <Avatar className="w-20 h-20">
                    <AvatarImage src={`https://api.dicebear.com/6.x/initials/svg?seed=${user.name}`} />
                    <AvatarFallback>{user.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-2xl font-semibold">{user.name}</h3>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                </div>
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      value={selectedUser.name}
                      onChange={(e) => handleUpdateUser('name', e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={selectedUser.email}
                      onChange={(e) => handleUpdateUser('email', e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-semibold mb-2">Liked Songs</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {user.likes.map(songId => {
                      const song = mockSongs.find(s => s.id === songId)
                      return song ? (
                        <div key={song.id} className="flex items-center space-x-2">
                          <div className="w-8 h-8 bg-primary/10 rounded flex items-center justify-center">
                            <span className="text-xs">{song.id}</span>
                          </div>
                          <div className="text-sm">{song.title}</div>
                        </div>
                      ) : null
                    })}
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-semibold mb-2">Playlists</h4>
                  {user.playlists.map(playlist => (
                    <div key={playlist.playlist_id} className="mb-2">
                      <h5 className="text-sm font-medium">{playlist.name}</h5>
                      <p className="text-xs text-muted-foreground">{playlist.song_ids.length} songs</p>
                    </div>
                  ))}
                </div>
                <div>
                  <h4 className="text-sm font-semibold mb-2">Recently Played</h4>
                  {user.last_played.map(({song_id, timestamp}) => {
                    const song = mockSongs.find(s => s.id === song_id)
                    return song ? (
                      <div key={`${song.id}-${timestamp}`} className="flex justify-between items-center mb-2">
                        <div className="text-sm">{song.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(timestamp).toLocaleString()}
                        </div>
                      </div>
                    ) : null
                  })}
                </div>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  )
}
