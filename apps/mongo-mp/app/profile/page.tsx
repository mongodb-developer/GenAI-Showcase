'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Notification } from "@/components/notification"
import { InfoTooltip } from "@/components/info-tooltip"
import { Song } from "@/types/song"

interface User {
  _id: string;
  name: string;
  email: string;
  likes: Song[];
}

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const response = await fetch('/api/user/profile', {
          credentials: 'include'
        });
        if (response.ok) {
          const userData = await response.json();
          console.log('Fetched user data:', userData);
          setUser(userData);
        } else if (response.status === 401) {
          router.push('/login');
        } else {
          throw new Error('Failed to fetch user profile');
        }
      } catch (err) {
        setError('An error occurred while fetching your profile.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserProfile();
  }, [router]);

  const handlePlayLikedSong = (songId: string) => {
    router.push(`/?song=${songId}`);
  };

  if (isLoading) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  if (error) {
    return <Notification variant="destructive" title="Error" message={error} />;
  }

  if (!user) {
    return <div className="flex justify-center items-center min-h-screen">No user data available.</div>;
  }

  return (
    <div className="container mx-auto py-10">
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <div className="flex items-center space-x-4">
            <Avatar className="w-20 h-20">
              <AvatarImage src={`https://api.dicebear.com/6.x/initials/svg?seed=${user.name}`} />
              <AvatarFallback>{user.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-2xl">
                {user.name}
                <InfoTooltip 
                  content="User's name stored in MongoDB"
                  query={`db.users.findOne({ _id: ObjectId("${user._id}") }, { name: 1 })`}
                  side="right"
                />
              </CardTitle>
              <CardDescription>
                {user.email}
                <InfoTooltip 
                  content="User's email stored in MongoDB"
                  query={`db.users.findOne({ _id: ObjectId("${user._id}") }, { email: 1 })`}
                  side="right"
                />
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="info" className="w-full">
            <TabsList>
              <TabsTrigger value="info">Info</TabsTrigger>
              <TabsTrigger value="likes">Likes</TabsTrigger>
            </TabsList>
            <TabsContent value="info">
              <div className="space-y-4">
                <div className="grid w-full max-w-sm items-center gap-1.5">
                  <Label htmlFor="name">Name</Label>
                  <Input type="text" id="name" value={user.name} readOnly />
                </div>
                <div className="grid w-full max-w-sm items-center gap-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input type="email" id="email" value={user.email} readOnly />
                </div>
                <Button>Edit Profile</Button>
              </div>
            </TabsContent>
            <TabsContent value="likes">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">
                  Liked Songs
                  <InfoTooltip 
                    content="User's liked songs stored in MongoDB"
                    query={`db.users.findOne(
  { _id: ObjectId("${user._id}") },
  { likes: 1 }
).likes.map(songId => 
  db.songs.findOne({ _id: songId })
)`}
                    side="right"
                  />
                </h3>
                {user.likes && user.likes.length > 0 ? (
                  user.likes.map((song) => (
                    <div key={song._id} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{song.title}</p>
                        <p className="text-sm text-muted-foreground">{song.artist}</p>
                      </div>
                      <Button variant="ghost" onClick={() => handlePlayLikedSong(song._id)}>Play</Button>
                    </div>
                  ))
                ) : (
                  <p>You haven't liked any songs yet.</p>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

