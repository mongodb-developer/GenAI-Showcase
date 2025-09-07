import React, { useState, useRef } from 'react';
import VideoUpload from './components/VideoUpload';
import VideoSelector from './components/VideoSelector';
import ProgressTracker from './components/ProgressTracker';
import SearchInterface from './components/SearchInterface';
import SearchResults from './components/SearchResults';
import VideoPlayer from './components/VideoPlayer';
import { videoApi } from './services/api';

function App() {
  // State management
  const [uploadedFile, setUploadedFile] = useState(null);
  const [videoId, setVideoId] = useState(null);
  const [progress, setProgress] = useState(null);

  // Enhanced progress protection - prevents inappropriate progress clearing
  const setProgressSafely = (newProgress, context = {}) => {
    console.log('📊 setProgressSafely called:', {
      current: progress,
      new: newProgress,
      context,
      currentVideoId: videoId,
      processingComplete,
      uploadedFile: !!uploadedFile,
      selectedUploadedVideo: !!selectedUploadedVideo,
      callStack: new Error().stack?.split('\n')[2]?.trim() // Show where this was called from
    });

    // Enhanced protection logic
    if (newProgress === null && !context.forceAllow) {
      // Don't clear completed progress unless explicitly starting a new upload
      if (progress?.status === 'completed') {
        console.log('🛡️ Protecting completed progress from being cleared');
        return;
      }

      // Don't clear progress if we have an active video and processing is complete
      if (processingComplete && (videoId || selectedUploadedVideo)) {
        console.log('🛡️ Protecting progress - video still active and processing complete');
        return;
      }
    }

    // Only allow progress updates if they make sense contextually
    if (newProgress && newProgress.status === 'processing') {
      // Processing updates should only happen when we have an active upload
      if (!videoId && !uploadedFile && !context.newUpload) {
        console.log('🛡️ Blocking processing update - no active video');
        return;
      }
    }

    console.log('✅ Progress update allowed:', newProgress);
    setProgress(newProgress);
  };
  const [isUploading, setIsUploading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState(null);
  const [selectedFrame, setSelectedFrame] = useState(null);
  const [processingComplete, setProcessingComplete] = useState(false);
  const [selectedUploadedVideo, setSelectedUploadedVideo] = useState(null);

  // Refs
  const wsRef = useRef(null);

  // Handle file selection and upload
  const handleFileSelect = async (file) => {
    try {
      setIsUploading(true);
      setUploadedFile(file);
      setProcessingComplete(false);
      setSearchResults(null);
      setSelectedFrame(null);
      setSelectedUploadedVideo(null);
      // Clear previous progress when starting new upload
      setProgressSafely({
        status: 'processing',
        progress: 0,
        message: 'Uploading video...'
      }, { reason: 'new_upload', newUpload: true });

      // Close any existing WebSocket connection first
      if (wsRef.current) {
        console.log('🔌 Closing previous WebSocket connection');
        wsRef.current.close();
        wsRef.current = null;
      }

      // Upload the video
      const uploadResponse = await videoApi.uploadVideo(file);
      const newVideoId = uploadResponse.video_id;
      setVideoId(newVideoId);

      // Connect to WebSocket for progress updates
      const ws = videoApi.createWebSocket(newVideoId);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('🔄 WebSocket received:', data);
        console.log('🔄 Setting progress to:', data);
        // Use setProgressSafely for WebSocket updates too, but allow overwriting during active processing
        if (data.status === 'processing' || data.status === 'failed') {
          setProgress(data); // Allow direct updates for processing/failed states
        } else {
          setProgressSafely(data, { reason: 'websocket_update', source: 'websocket' }); // Use protection for other states
        }

        if (data.status === 'completed') {
          console.log('✅ Processing completed, setting states');
          setProcessingComplete(true);
          setIsUploading(false);
          // Keep the progress visible for completion - don't auto-clear
          // Let the user manually start a new upload or select a different video to clear it
        } else if (data.status === 'failed') {
          setIsUploading(false);
          console.error('Processing failed:', data.message);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsUploading(false);
        setProgress({
          status: 'failed',
          progress: 0,
          message: 'Connection error occurred'
        });
      };

      ws.onclose = () => {
        console.log('🔌 WebSocket disconnected');
        console.log('🔌 Progress at disconnect:', progress);
      };

    } catch (error) {
      console.error('Upload failed:', error);
      setIsUploading(false);
      setProgress({
        status: 'failed',
        progress: 0,
        message: `Upload failed: ${error.message}`
      });
    }
  };

  // Handle video selection from uploaded videos
  const handleVideoSelect = (video) => {
    console.log('🎥 handleVideoSelect called with:', video);
    console.log('🎥 Current progress:', progress);
    console.log('🎥 Current videoId:', videoId);

    if (video) {
      setSelectedUploadedVideo(video);
      setVideoId(video.video_id);
      setProcessingComplete(true);
      setUploadedFile(null);
      // Only clear progress if switching from a different video or if it's not completed
      const shouldClearProgress = progress && (progress.status !== 'completed' || videoId !== video.video_id);
      console.log('🎥 Should clear progress?', shouldClearProgress, {
        hasProgress: !!progress,
        progressStatus: progress?.status,
        videoIdMatch: videoId === video.video_id
      });

      if (shouldClearProgress) {
        console.log('🎥 CLEARING PROGRESS from video selection');
        setProgressSafely(null, { reason: 'video_switch', forceAllow: false });
      }
      setSearchResults(null);
      setSelectedFrame(null);
    } else {
      console.log('🎥 Video selection cleared');
      setSelectedUploadedVideo(null);
      if (!uploadedFile) {
        console.log('🎥 CLEARING PROGRESS - no uploaded file');
        setVideoId(null);
        setProcessingComplete(false);
        setProgressSafely(null, { reason: 'no_active_video', forceAllow: true });
      }
    }
  };

  // Handle search
  const handleSearch = async (query, searchType = 'hybrid') => {
    const canSearch = processingComplete || selectedUploadedVideo;

    if (!canSearch) {
      alert('Please upload a new video or select a previously uploaded video before searching');
      return;
    }

    try {
      setIsSearching(true);
      setSearchResults(null);
      setSelectedFrame(null);

      const results = await videoApi.searchFrames(query, 8, videoId, searchType);
      setSearchResults(results);
    } catch (error) {
      console.error('Search failed:', error);
      alert(`Search failed: ${error.message}`);
    } finally {
      setIsSearching(false);
    }
  };

  // Handle frame selection (jump to timestamp)
  const handleFrameSelect = (frame) => {
    setSelectedFrame(frame);
  };

  // Cleanup WebSocket on unmount
  React.useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return (
    <div className="app">
      <div className="container">
        {/* Header */}
        <div className="header">
          <h1>🎬 Video Intelligence</h1>
          <p>AI-powered video search system</p>
        </div>

        {/* Main Content */}
        <div className="content">
          {/* Upload Section */}
          <VideoUpload
            onFileSelect={handleFileSelect}
            isUploading={isUploading}
          />

          {/* Progress Tracking */}
          <ProgressTracker progress={progress} />

          {/* Video Selector for Previously Uploaded Videos */}
          <VideoSelector
            onVideoSelect={handleVideoSelect}
            isSearching={isSearching}
          />

          {/* Search Interface */}
          <SearchInterface
            onSearch={handleSearch}
            isSearching={isSearching}
            canSearch={processingComplete || selectedUploadedVideo}
          />

          {/* Search Results */}
          {searchResults && (
            <SearchResults
              results={searchResults}
              onFrameSelect={handleFrameSelect}
              query={searchResults.query}
            />
          )}

          {/* Video Player */}
          <VideoPlayer
            videoFile={uploadedFile}
            videoUrl={selectedUploadedVideo ? selectedUploadedVideo.frontend_path : null}
            selectedFrame={selectedFrame}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
