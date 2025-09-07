# 🎬 Video Intelligence App

An AI-powered video search system that allows users to upload videos, extract intelligent insights from frames, and search through video content using natural language queries.

## ✨ Features

- **Video Upload**: Drag-and-drop interface for video files (MP4, AVI, MOV, etc.)
- **Real-time Processing**: Live progress updates during video analysis
- **AI-Powered Analysis**:
  - Frame extraction at regular intervals
  - Detailed scene descriptions using GPT-4 Vision
  - Semantic embeddings using Voyage AI multimodal models
- **Multiple Search Types**:
  - **Hybrid Search**: Combines semantic and text-based search for best results (default)
  - **Semantic Search**: AI-powered similarity search using embeddings
  - **Text Search**: Traditional keyword search through frame descriptions
- **Interactive Results**: Thumbnail grid showing matching frames with normalized similarity scores
- **Collapsible Interface**: Toggle sections (upload area, video playback, previously uploaded videos) for better space management
- **Video Player Integration**: Click frames to jump to specific timestamps in the video
- **Video Management**: Upload new videos or select from previously uploaded ones
- **MongoDB Storage**: Scalable storage with vector search capabilities

## 🏗️ Architecture

```
├── backend/                 # Python FastAPI backend
│   ├── services/           # Core business logic
│   │   ├── ai_service.py          # OpenAI & Voyage AI integration
│   │   ├── mongodb_service.py     # Database operations
│   │   └── video_processor.py     # Video frame extraction
│   ├── models/             # Pydantic schemas
│   └── main.py            # FastAPI application
├── frontend/               # React frontend
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── services/      # API client
│   │   └── styles/        # CSS styles
└── uploads/               # Temporary video storage
```

## 🚀 Quick Start

### Prerequisites

- Python 3.8+
- Node.js 16+
- MongoDB Atlas account
- OpenAI API key
- Voyage AI API key

### 1. MongoDB Atlas Setup

1. Create a [MongoDB Atlas](https://cloud.mongodb.com/) account
2. Create a new cluster
3. Create a database user with read/write permissions
4. Get your connection string
5. Create the following indexes in your database:

#### Vector Search Index
In Atlas UI, create a search index with this definition:
```json
{
  "fields": [
    {
      "numDimensions": 1024,
      "path": "embedding",
      "similarity": "cosine",
      "type": "vector"
    }
  ]
}
```
Name it `vector_search_index`

#### Text Search Index
Create another search index:
```json
{
  "mappings": {
    "dynamic": false,
    "fields": {
      "description": {
        "type": "string",
        "analyzer": "lucene.standard"
      },
      "metadata.scene_type": {
        "type": "string"
      },
      "metadata.objects": {
        "type": "string"
      }
    }
  }
}
```
Name it `text_search_index`

### 2. Backend Setup

1. Navigate to the backend directory:
```bash
cd apps/video-intelligence/backend
```

2. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Create environment file:
```bash
cp .env.example .env
```

5. Edit `.env` with your credentials:
```env
# MongoDB Atlas Configuration
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-url>/<database>?retryWrites=true&w=majority
DATABASE_NAME=video_intelligence

# AI Service API Keys
VOYAGE_AI_API_KEY=your_voyage_ai_api_key_here
OPENAI_API_KEY=your_openai_api_key_here

# Application Settings
UPLOAD_DIR=uploads
FRAMES_DIR=frames
MAX_FILE_SIZE_MB=500
FRAME_EXTRACTION_INTERVAL=2

# CORS Settings
FRONTEND_URL=http://localhost:3000
```

6. Start the backend server:
```bash
python main.py
```

The API will be available at `http://localhost:8000`

### 3. Frontend Setup

1. Navigate to the frontend directory:
```bash
cd apps/video-intelligence/frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

The app will open at `http://localhost:3000`

## 🎯 Usage

1. **Upload Video**:
   - Drag and drop a video file or click to select
   - Supported formats: MP4, AVI, MOV, WMV, FLV, WebM, MKV
   - Maximum file size: 500MB

2. **Monitor Processing**:
   - Watch real-time progress as the system extracts frames
   - AI generates descriptions and embeddings for each frame
   - Processing time depends on video length and complexity

3. **Search Content**:
   - Choose your search type: Hybrid (recommended), Semantic, or Text
   - Enter natural language queries in the search box
   - Examples: "find frames with a person", "outdoor scenes", "blue objects"
   - Results show thumbnail grid with normalized similarity scores (0-100%)

4. **Navigate Video**:
   - Click on any frame thumbnail to jump to that timestamp
   - Video player automatically seeks to the selected frame
   - Use collapsible video playback section to save space
   - View AI-generated descriptions for each frame

5. **Manage Videos**:
   - Select from previously uploaded videos using the collapsible selector
   - Delete videos you no longer need
   - Upload multiple videos and switch between them seamlessly

## 🔧 API Endpoints

- `POST /upload` - Upload video file
- `GET /ws/{video_id}` - WebSocket for processing updates
- `POST /search` - Search frames with natural language (supports hybrid, semantic, and text search)
- `GET /video/{video_id}/metadata` - Get video metadata
- `DELETE /video/{video_id}` - Delete video and associated data
- `GET /frames/{video_id}/{frame_name}` - Serve frame images
- `GET /videos` - Get list of all uploaded videos

## 🧪 Development

### Backend Development
```bash
# Install development dependencies
pip install -r requirements.txt

# Run with auto-reload
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend Development
```bash
# Start development server with hot reload
npm start

# Build for production
npm run build
```

## 📊 Performance Optimization

- **Frame Extraction**: Configurable interval (default: 2 seconds)
- **Batch Processing**: AI operations processed in batches of 3-5 frames
- **Progressive Processing**: Frames are processed and saved incrementally during upload
- **Vector Quantization**: Multiple index types (scalar, binary, full-fidelity)
- **Thumbnail Generation**: Optimized images for faster UI loading
- **WebSocket Progress**: Real-time updates without polling
- **Score Normalization**: Similarity scores normalized to 0-1 range for consistent display
- **Smooth UI Transitions**: Collapsible sections with cubic-bezier animations

## 🚀 Deployment

### Backend (Docker)
```dockerfile
FROM python:3.9-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Frontend (Netlify/Vercel)
```bash
npm run build
# Deploy the build/ directory
```

## 🔒 Security Considerations

- File upload validation and size limits
- API rate limiting
- Environment variable protection
- CORS configuration for production
- MongoDB connection string security

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📝 License

This project is part of the MongoDB GenAI Showcase repository.

## 🆘 Troubleshooting

### Common Issues

1. **MongoDB Connection Failed**
   - Verify connection string format
   - Check network access (whitelist IP in Atlas)
   - Ensure database user has correct permissions

2. **Video Processing Slow**
   - Reduce frame extraction interval
   - Use smaller video files for testing
   - Check API rate limits for OpenAI/Voyage

3. **Search Returns No Results**
   - Verify both vector and text search indexes are created in Atlas
   - Check if video processing completed successfully
   - Try different search types (hybrid, semantic, text)
   - Try more general search terms

4. **WebSocket Connection Issues**
   - Ensure backend is running
   - Check CORS settings
   - Verify WebSocket URL format

5. **Similarity Scores Over 100%**
   - This has been fixed with score normalization
   - Scores now display as 0-100% range
   - If still occurring, check hybrid search index configuration

6. **422 Validation Errors During Search**
   - This has been resolved with improved request validation
   - Ensure search_type is one of: "hybrid", "semantic", "text"
   - Check request body format matches API expectations

### Debug Mode

Enable detailed logging:
```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

## 📞 Support

For issues and questions:
- Check existing GitHub issues
- Create new issue with detailed description
- Include logs and error messages
