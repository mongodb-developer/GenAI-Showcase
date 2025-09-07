import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, ChevronUp, ChevronDown } from 'lucide-react';

const VideoUpload = ({ onFileSelect, isUploading }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      onFileSelect(acceptedFiles[0]);
    }
  }, [onFileSelect]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/*': ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv']
    },
    multiple: false,
    disabled: isUploading,
  });

  return (
    <div className="upload-section">
      <div className="upload-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="upload-title">
          <Upload size={20} />
          <span>Upload Video</span>
        </div>
        <button className="toggle-button">
          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
      </div>

      <div className={`upload-content ${isExpanded ? 'expanded' : 'collapsed'}`}>
        <div className="upload-inner">
          <div
            {...getRootProps()}
            className={`dropzone ${isDragActive ? 'active' : ''} ${isUploading ? 'disabled' : ''}`}
          >
            <input {...getInputProps()} />
            <Upload size={48} className="upload-icon" />
            {isDragActive ? (
              <div className="upload-text">Drop the video here...</div>
            ) : (
              <>
                <div className="upload-text">
                  {isUploading ? 'Processing...' : 'Drag & drop a video here, or click to select'}
                </div>
                <div className="upload-hint">
                  Supports MP4, AVI, MOV, WMV, FLV, WebM, MKV files (max 500MB)
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoUpload;
