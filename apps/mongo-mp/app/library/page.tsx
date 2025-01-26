import { Metadata } from "next"
import { LibraryContent } from "@/components/library-content"

export const metadata: Metadata = {
  title: "Library - MongoMP",
  description: "Your music library and playlists on MongoMP",
}

export default function LibraryPage() {
  return (
    <div className="container mx-auto py-10">
      <LibraryContent />
    </div>
  )
}

