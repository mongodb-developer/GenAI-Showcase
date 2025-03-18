"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, Loader2, User } from "lucide-react"
import { toast } from "@/components/ui/use-toast"

interface ProfileData {
  id: string
  name: string
  email: string
  role: string
  bio: string
  jobTitle: string
  company: string
  avatar: string
  createdAt: string
}

export default function ProfilePage() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [name, setName] = useState("")
  const [bio, setBio] = useState("")
  const [jobTitle, setJobTitle] = useState("")
  const [company, setCompany] = useState("")

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login")
    }
  }, [authLoading, user, router])

  // Fetch profile data
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setIsLoading(true)
        const response = await fetch("/api/user/profile")

        if (!response.ok) {
          throw new Error("Failed to fetch profile")
        }

        const data = await response.json()
        setProfile(data.user)

        // Initialize form state
        setName(data.user.name || "")
        setBio(data.user.bio || "")
        setJobTitle(data.user.jobTitle || "")
        setCompany(data.user.company || "")
      } catch (error) {
        console.error("Error fetching profile:", error)
        setError("Failed to load profile data. Please try again.")
      } finally {
        setIsLoading(false)
      }
    }

    if (user) {
      fetchProfile()
    }
  }, [user])

  const handleSaveProfile = async () => {
    try {
      setIsSaving(true)
      setError(null)

      const response = await fetch("/api/user/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          bio,
          jobTitle,
          company,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to update profile")
      }

      const data = await response.json()
      setProfile(data.user)

      toast({
        title: "Success",
        description: "Your profile has been updated successfully.",
      })
    } catch (error) {
      console.error("Error updating profile:", error)
      setError(error instanceof Error ? error.message : "Failed to update profile")

      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="container max-w-3xl py-8">
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  return (
    <div className="container max-w-3xl py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        <Button onClick={handleSaveProfile} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Changes"
          )}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>General Information</CardTitle>
              <CardDescription>Update your personal information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={profile?.avatar || ""} alt={profile?.name || "User"} />
                  <AvatarFallback className="text-2xl">
                    {profile?.name?.charAt(0) || <User className="h-8 w-8" />}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-lg font-medium">{profile?.name}</h3>
                  <p className="text-sm text-muted-foreground">{profile?.email}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Member since {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : "N/A"}
                  </p>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your full name"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell us about yourself"
                    rows={4}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="jobTitle">Job Title</Label>
                  <Input
                    id="jobTitle"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="Your job title"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="company">Company</Label>
                  <Input
                    id="company"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Your company"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="account">
          <Card>
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
              <CardDescription>Manage your account settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email Address</Label>
                <Input id="email" value={profile?.email || ""} disabled />
                <p className="text-xs text-muted-foreground">
                  Your email address is used for login and cannot be changed.
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="role">Account Role</Label>
                <Input id="role" value={profile?.role || "user"} disabled />
                <p className="text-xs text-muted-foreground">
                  Your account role determines your permissions in the system.
                </p>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col items-start gap-4">
              <div>
                <h3 className="text-sm font-medium mb-1">Change Password</h3>
                <p className="text-sm text-muted-foreground mb-2">Update your password to keep your account secure.</p>
                <Button variant="outline">Change Password</Button>
              </div>

              <div>
                <h3 className="text-sm font-medium mb-1 text-destructive">Danger Zone</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Permanently delete your account and all associated data.
                </p>
                <Button variant="destructive">Delete Account</Button>
              </div>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
