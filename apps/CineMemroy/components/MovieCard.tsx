"use client"

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Star, Calendar, Users, Play, ExternalLink } from 'lucide-react'

interface MovieCardProps {
  movie: {
    id: string
    title: string
    year?: number
    plot?: string
    fullPlot?: string
    genres?: string[]
    directors?: string[]
    cast?: string[]
    rating?: number
    votes?: number
    runtime?: string
    posterUrl?: string | null
    trailerUrl?: string | null
    awards?: string | { wins?: number; nominations?: number; text?: string }
    countries?: string[]
    languages?: string[]
  }
  compact?: boolean
}

export function MovieCard({ movie, compact = false }: MovieCardProps) {
  const handleTrailerClick = () => {
    if (movie.trailerUrl) {
      window.open(movie.trailerUrl, '_blank')
    }
  }

  if (compact) {
    return (
      <Card className="mb-4 hover:shadow-lg transition-shadow">
        <CardContent className="p-4">
          <div className="flex gap-4">
            {movie.posterUrl && (
              <div className="flex-shrink-0">
                <img
                  src={movie.posterUrl}
                  alt={`${movie.title} poster`}
                  className="w-16 h-24 object-cover rounded"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none'
                  }}
                />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-lg leading-tight">
                    {movie.title}
                    {movie.year && (
                      <span className="text-muted-foreground ml-2">({movie.year})</span>
                    )}
                  </h3>
                  {movie.rating && (
                    <div className="flex items-center gap-1 mt-1">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      <span className="text-sm font-medium">{movie.rating}/10</span>
                      {movie.votes && (
                        <span className="text-xs text-muted-foreground">
                          ({movie.votes.toLocaleString()} votes)
                        </span>
                      )}
                    </div>
                  )}
                </div>
                {movie.trailerUrl && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleTrailerClick}
                    className="flex-shrink-0"
                  >
                    <Play className="w-4 h-4 mr-1" />
                    Trailer
                  </Button>
                )}
              </div>
              
              {movie.genres && movie.genres.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {movie.genres.slice(0, 3).map((genre) => (
                    <Badge key={genre} variant="secondary" className="text-xs">
                      {genre}
                    </Badge>
                  ))}
                  {movie.genres.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{movie.genres.length - 3} more
                    </Badge>
                  )}
                </div>
              )}
              
              {movie.plot && (
                <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                  {movie.plot}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="mb-6 hover:shadow-xl transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-2xl">
              {movie.title}
              {movie.year && (
                <span className="text-muted-foreground ml-3 text-lg font-normal">
                  ({movie.year})
                </span>
              )}
            </CardTitle>
            
            <div className="flex items-center gap-4 mt-2">
              {movie.rating && (
                <div className="flex items-center gap-1">
                  <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                  <span className="font-semibold">{movie.rating}/10</span>
                  {movie.votes && (
                    <span className="text-sm text-muted-foreground">
                      ({movie.votes.toLocaleString()} votes)
                    </span>
                  )}
                </div>
              )}
              
              {movie.runtime && (
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  <span className="text-sm">{movie.runtime}</span>
                </div>
              )}
            </div>
          </div>
          
          {movie.trailerUrl && (
            <Button onClick={handleTrailerClick} className="flex-shrink-0">
              <Play className="w-4 h-4 mr-2" />
              Watch Trailer
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="flex gap-6">
          {movie.posterUrl && (
            <div className="flex-shrink-0">
              <img
                src={movie.posterUrl}
                alt={`${movie.title} poster`}
                className="w-48 h-72 object-cover rounded-lg shadow-md"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none'
                }}
              />
            </div>
          )}
          
          <div className="flex-1 space-y-4">
            {movie.genres && movie.genres.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2">Genres</h4>
                <div className="flex flex-wrap gap-2">
                  {movie.genres.map((genre) => (
                    <Badge key={genre} variant="secondary">
                      {genre}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            
            {movie.fullPlot && (
              <div>
                <h4 className="font-semibold mb-2">Plot</h4>
                <p className="text-muted-foreground leading-relaxed">
                  {movie.fullPlot}
                </p>
              </div>
            )}
            
            {movie.directors && movie.directors.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2">Director(s)</h4>
                <p className="text-muted-foreground">
                  {movie.directors.join(', ')}
                </p>
              </div>
            )}
            
            {movie.cast && movie.cast.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2">Cast</h4>
                <div className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  <p className="text-muted-foreground">
                    {movie.cast.slice(0, 5).join(', ')}
                    {movie.cast.length > 5 && ` and ${movie.cast.length - 5} more`}
                  </p>
                </div>
              </div>
            )}
            
            {movie.awards && (
              <div>
                <h4 className="font-semibold mb-2">Awards</h4>
                <p className="text-muted-foreground">
                  {typeof movie.awards === 'string' 
                    ? movie.awards 
                    : movie.awards.text || `${movie.awards.wins || 0} wins, ${movie.awards.nominations || 0} nominations`
                  }
                </p>
              </div>
            )}
            
            <div className="flex gap-6 text-sm text-muted-foreground">
              {movie.countries && movie.countries.length > 0 && (
                <div>
                  <span className="font-medium">Countries: </span>
                  {movie.countries.join(', ')}
                </div>
              )}
              
              {movie.languages && movie.languages.length > 0 && (
                <div>
                  <span className="font-medium">Languages: </span>
                  {movie.languages.join(', ')}
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default MovieCard
