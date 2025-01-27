import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Search - MongoMP",
  description: "Search for your favorite songs on MongoMP",
}

export default function SearchPage() {
  return (
    <div className="container mx-auto py-10">
      <h1 className="text-4xl font-bold mb-4">Search</h1>
      <p>Search functionality coming soon!</p>
    </div>
  )
}

