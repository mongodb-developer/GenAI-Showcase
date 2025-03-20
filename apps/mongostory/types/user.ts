export interface User {
  _id: string
  name: string
  email: string
  password: string
  role: "admin" | "editor" | "user"
  createdAt: string
  updatedAt?: string
}

export interface UserProfile {
  id: string
  name: string
  email: string
  role: string
}
