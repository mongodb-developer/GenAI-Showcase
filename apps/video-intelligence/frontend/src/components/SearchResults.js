import React from 'react';
import { videoApi } from '../services/api';

const SearchResults = ({ results, onFrameSelect, query }) => {
  if (!results) return null;

  const formatTimestamp = (seconds) => {
    // Go back 10 seconds from the search result timestamp
    const adjustedSeconds = Math.max(0, seconds - 10);
    const mins = Math.floor(adjustedSeconds / 60);
    const secs = Math.floor(adjustedSeconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatScore = (score) => {
    // Round to 3 decimal places for non-hybrid, show as integer for hybrid (ranks)
    return Number.isInteger(score) ? score.toString() : score.toFixed(3);
  };

  const handleFrameClick = (result) => {
    onFrameSelect(result);
  };

  if (results.results.length === 0) {
    return (
      <div className="results-section">
        <div style={{
          textAlign: 'center',
          padding: '40px',
          color: '#666'
        }}>
          <p>No frames found matching "{query}"</p>
          <p style={{ fontSize: '0.9rem', marginTop: '10px' }}>
            Try different keywords or more general descriptions
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="results-section">
      <div className="results-header">
        <div>
          <div className="results-title">Search Results</div>
          <div className="results-info">
            Found {results.total_results} frames matching "{results.query}"
            ({results.processing_time.toFixed(2)}s)
          </div>
        </div>
      </div>

      <div className="results-grid">
        {results.results.map((result, index) => (
          <div
            key={index}
            className="result-card"
            onClick={() => handleFrameClick(result)}
          >
            <img
              src={videoApi.getFrameUrl(result.thumbnail_path)}
              alt={`Frame at ${formatTimestamp(result.timestamp)}`}
              className="result-thumbnail"
              onError={(e) => {
                // Fallback to placeholder if thumbnail fails
                e.target.src = `data:image/svg+xml;base64,${btoa(`
                  <svg width="320" height="240" xmlns="http://www.w3.org/2000/svg">
                    <rect width="100%" height="100%" fill="#f0f2ff"/>
                    <text x="50%" y="50%" text-anchor="middle" fill="#667eea" font-size="14">
                      Frame ${result.frame_number}
                    </text>
                  </svg>
                `)}`;
              }}
            />
            <div className="result-content">
              <div className="result-timestamp">
                {formatTimestamp(result.timestamp)}
              </div>
              <div className="result-description">
                {result.description}
              </div>
              <div className="result-score">
                {Number.isInteger(result.similarity_score) ? 'Rank' : 'Similarity'}: {formatScore(result.similarity_score)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SearchResults;
