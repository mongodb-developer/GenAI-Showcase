'use client'

import { Suspense } from 'react'
import HomeContent from './home-content'

export const dynamic = 'force-dynamic'

export default function Home() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HomeContent />
    </Suspense>
  )
}

