import React, { useRef, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Play } from 'lucide-react';

const VideoPlayer = ({ videoFile, videoUrl, selectedFrame, onTimeUpdate }) => {
  const videoRef = useRef(null);
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    if (selectedFrame && videoRef.current) {
      videoRef.current.currentTime = selectedFrame.timestamp;
    }
  }, [selectedFrame]);

  const handleTimeUpdate = () => {
    if (onTimeUpdate && videoRef.current) {
      onTimeUpdate(videoRef.current.currentTime);
    }
  };

  // Memoize video source to prevent unnecessary recreations
  const videoSrc = useMemo(() => {
    if (videoUrl) {
      // Use provided URL (for previously uploaded videos)
      return videoUrl;
    } else if (videoFile) {
      // Create object URL for newly uploaded files
      return URL.createObjectURL(videoFile);
    }
    return null;
  }, [videoUrl, videoFile]);

  return (
    <div className="video-player-section">
      <div className="video-player-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="video-player-title">
          <Play size={20} />
          <span>Video Playback</span>
        </div>
        <button className="toggle-button">
          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
      </div>

      <div className={`video-player-content ${isExpanded ? 'expanded' : 'collapsed'}`}>
        <div className="video-player-inner">
          {!videoSrc ? (
            <div className="video-placeholder">
              <p>Upload a video or select a previously uploaded video to see the player here</p>
            </div>
          ) : (
            <div className="video-player-container">
              <video
                ref={videoRef}
                src={videoSrc}
                controls
                className="video-player"
                onTimeUpdate={handleTimeUpdate}
              />
              {selectedFrame && (
                <div className="video-info">
                  <p>
                    🎯 Jumped to frame at {Math.floor(selectedFrame.timestamp / 60)}:
                    {Math.floor(selectedFrame.timestamp % 60).toString().padStart(2, '0')}
                  </p>
                  <p style={{ fontSize: '0.8rem', opacity: 0.8 }}>
                    {selectedFrame.description}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;
