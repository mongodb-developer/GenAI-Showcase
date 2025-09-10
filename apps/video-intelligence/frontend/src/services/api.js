import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const videoApi = {
  // Upload a video file
  uploadVideo: async (file, onUploadProgress) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress,
    });

    return response.data;
  },

  // Create WebSocket connection for progress updates
  createWebSocket: (videoId) => {
    const wsUrl = `${API_BASE_URL.replace('http', 'ws')}/ws/${videoId}`;
    return new WebSocket(wsUrl);
  },

  // Search for frames
  searchFrames: async (query, topK = 5, videoId = null, searchType = 'hybrid') => {
    const requestBody = {
      query,
      top_k: topK,
      search_type: searchType,
    };

    if (videoId) {
      requestBody.video_id = videoId;
    }

    const response = await api.post('/search', requestBody);

    return response.data;
  },

  // Get all uploaded videos
  getUploadedVideos: async () => {
    const response = await api.get('/videos');
    return response.data;
  },

  // Get video metadata
  getVideoMetadata: async (videoId) => {
    const response = await api.get(`/video/${videoId}/metadata`);
    return response.data;
  },

  // Delete video
  deleteVideo: async (videoId) => {
    const response = await api.delete(`/video/${videoId}`);
    return response.data;
  },

  // Get frame image URL
  getFrameUrl: (framePath) => {
    if (framePath.startsWith('/frames')) {
      return `${API_BASE_URL}${framePath}`;
    }
    return `${API_BASE_URL}/frames/${framePath}`;
  },
};

export default api;
