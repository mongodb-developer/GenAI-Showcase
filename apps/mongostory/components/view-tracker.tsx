"use client"

import { useEffect } from "react"

interface ViewTrackerProps {
  contentId: string
  visitorId: string
}

export function ViewTracker({ contentId, visitorId }: ViewTrackerProps) {
  useEffect(() => {
    const startTime = Date.now()

    // Record session when user leaves the page
    const handleUnload = () => {
      const duration = Math.round((Date.now() - startTime) / 1000) // Convert to seconds
      // Use sendBeacon for more reliable data sending on page unload
      const blob = new Blob(
        [
          JSON.stringify({
            contentId,
            visitorId,
            duration,
          }),
        ],
        { type: "application/json" },
      )
      navigator.sendBeacon("/api/analytics/session", blob)
    }

    // Record session every 5 minutes for long sessions
    const interval = setInterval(
      () => {
        const duration = Math.round((Date.now() - startTime) / 1000)
        fetch("/api/analytics/session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contentId,
            visitorId,
            duration,
          }),
        }).catch((error) => {
          console.error("Error recording session:", error)
        })
      },
      5 * 60 * 1000,
    ) // Every 5 minutes

    window.addEventListener("unload", handleUnload)

    return () => {
      clearInterval(interval)
      window.removeEventListener("unload", handleUnload)
    }
  }, [contentId, visitorId])

  return null
}
