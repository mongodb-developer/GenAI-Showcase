import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Clock, Film } from 'lucide-react';
import { videoApi } from '../services/api';

const VideoSelector = ({ onVideoSelect, isSearching }) => {
  const [videos, setVideos] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    loadUploadedVideos();
  }, []);

  const loadUploadedVideos = async () => {
    try {
      setLoading(true);
      const response = await videoApi.getUploadedVideos();
      setVideos(response.videos || []);
      setError(null);
    } catch (err) {
      console.error('Failed to load uploaded videos:', err);
      setError('Failed to load uploaded videos');
    } finally {
      setLoading(false);
    }
  };

  const handleVideoSelection = (e) => {
    const videoId = e.target.value;
    setSelectedVideo(videoId);

    if (videoId) {
      const video = videos.find(v => v.video_id === videoId);
      onVideoSelect(video);
    } else {
      onVideoSelect(null);
    }
  };

  const formatDuration = (duration) => {
    if (!duration) return 'Unknown';
    const minutes = Math.floor(duration / 60);
    const seconds = Math.floor(duration % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Unknown';
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <div className="video-selector">
      <div className="selector-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="selector-title">
          <Film size={20} />
          <span>Previously Uploaded Videos {videos.length > 0 ? `(${videos.length})` : ''}</span>
        </div>
        <button className="toggle-button">
          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
      </div>

      <div className={`selector-content ${isExpanded ? 'expanded' : 'collapsed'}`}>
        <div className="selector-inner">
          {loading ? (
            <div className="loading-message">Loading uploaded videos...</div>
          ) : error ? (
            <div className="error-message">{error}</div>
          ) : videos.length === 0 ? (
            <div className="no-videos-message">
              No videos have been uploaded yet. Upload a video above to get started.
            </div>
          ) : (
            <>
              <div className="select-wrapper">
                <select
                  value={selectedVideo}
                  onChange={handleVideoSelection}
                  disabled={isSearching}
                  className="video-dropdown"
                >
                  <option value="">Select a previously uploaded video...</option>
                  {videos.map((video) => (
                    <option key={video.video_id} value={video.video_id}>
                      {video.original_filename} - {formatDuration(video.duration)} ({formatDate(video.created_at)})
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} className="select-icon" />
              </div>

              {selectedVideo && (
                <div className="selected-video-info">
                  {(() => {
                    const video = videos.find(v => v.video_id === selectedVideo);
                    return (
                      <div className="video-details">
                        <div className="detail-item">
                          <strong>Filename:</strong> {video.original_filename}
                        </div>
                        <div className="detail-item">
                          <strong>Duration:</strong> {formatDuration(video.duration)}
                        </div>
                        <div className="detail-item">
                          <strong>Resolution:</strong> {video.width}x{video.height}
                        </div>
                        <div className="detail-item">
                          <strong>Frames:</strong> {video.total_frames}
                        </div>
                        <div className="detail-item">
                          <Clock size={14} />
                          <span>Processed on {formatDate(video.processed_at)}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default VideoSelector;
