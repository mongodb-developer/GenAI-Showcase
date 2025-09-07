import React from 'react';

const ProgressTracker = ({ progress }) => {
  if (!progress) return null;

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return '#22c55e';
      case 'failed':
        return '#ef4444';
      case 'processing':
        return '#667eea';
      default:
        return '#667eea';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'completed':
        return '✅ Completed';
      case 'failed':
        return '❌ Failed';
      case 'processing':
        return '🔄 Processing';
      default:
        return 'Processing';
    }
  };

  return (
    <div className="progress-section">
      <div className="progress-header">
        <div className="progress-title">
          {getStatusText(progress.status)}
        </div>
        <div
          className="progress-percentage"
          style={{ color: getStatusColor(progress.status) }}
        >
          {progress.progress}%
        </div>
      </div>

      <div className="progress-bar">
        <div
          className="progress-fill"
          style={{
            width: `${progress.progress}%`,
            background: progress.status === 'failed'
              ? '#ef4444'
              : 'linear-gradient(90deg, #667eea, #764ba2)'
          }}
        />
      </div>

      <div className="progress-message">
        {progress.message}
      </div>

      {(progress.frames_processed || progress.total_frames) && (
        <div className="progress-stats">
          {progress.frames_processed && (
            <span>Frames processed: {progress.frames_processed}</span>
          )}
          {progress.total_frames && (
            <span>Total frames: {progress.total_frames}</span>
          )}
        </div>
      )}
    </div>
  );
};

export default ProgressTracker;
