import { Inter } from 'next/font/google'
import { UserProvider } from '@/contexts/UserContext'
import { Navbar } from '@/components/navbar'
import { BottomNav } from '@/components/bottom-nav'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'MongoMP - Music Streaming Platform',
  description: 'Stream your favorite music with MongoMP',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <UserProvider>
          <div 
            className="min-h-screen bg-black pb-16 sm:pb-0"
            style={{
              backgroundImage: `
                radial-gradient(at 0% 0%, rgba(var(--color-secondary-rgb), 0.15) 0, transparent 50%),
                radial-gradient(at 100% 0%, rgba(var(--color-primary-rgb), 0.15) 0, transparent 50%),
                radial-gradient(at 50% 100%, rgba(34, 197, 94, 0.15) 0, transparent 50%)
              `
            }}
          >
            <Navbar />
            {children}
            <BottomNav />
          </div>
        </UserProvider>
      </body>
    </html>
  )
}

