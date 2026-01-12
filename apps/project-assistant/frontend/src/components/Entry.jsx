import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'

function Entry({ messages, onSendMessage, hasActiveProject, activeProject, projects, onRefreshMessages, isV2, activeSection, onSelectProject }) {
  const [input, setInput] = useState('')
  const [selectedImages, setSelectedImages] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [isSearching, setIsSearching] = useState(false)
  const [saveStatus, setSaveStatus] = useState(null)
  const messagesEndRef = useRef(null)
  const fileInputRef = useRef(null)

  const handleSaveProject = async () => {
    setSaveStatus('saving')
    try {
      const activeProjectObj = projects.find(p => p._id === activeProject)
      const formData = new FormData()
      formData.append('project_date', activeProjectObj?.created_at || new Date().toISOString())
      formData.append('project_title', activeProjectObj?.title || 'Unknown')

      await fetch(`http://localhost:8000/api/projects/${activeProject}/save`, {
        method: 'POST',
        body: formData
      })
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus(null), 2000)
    } catch (error) {
      console.error('Failed to save project:', error)
      setSaveStatus(null)
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    setSearchQuery('')
    setSearchResults(null)
  }, [isV2])


  const handleSubmit = (e) => {
    e.preventDefault()
    if ((input.trim() || selectedImages.length > 0) && hasActiveProject) {
      onSendMessage(input, selectedImages)
      setInput('')
      setSelectedImages([])
    }
  }

  const handlePhotoClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || [])

    files.forEach(file => {
      setSelectedImages(prev => [...prev, {
        file,
        preview: URL.createObjectURL(file),
        name: file.name
      }])
    })

    // Reset input so same file can be selected again
    e.target.value = ''
  }

  const removeImage = (index) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index))
  }

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!searchQuery.trim()) return

    setIsSearching(true)
    try {
      const version = isV2 ? 2 : 1
      const res = await fetch(`http://localhost:8000/api/projects/search?q=${encodeURIComponent(searchQuery)}&version=${version}`)
      const data = await res.json()
      setSearchResults(data)
    } catch (error) {
      console.error('Search failed:', error)
    }
    setIsSearching(false)
  }

  const clearSearch = () => {
    setSearchQuery('')
    setSearchResults(null)
  }

  // Show search interface when Projects tab is clicked and no project selected
  if (activeSection === 'projects' && !hasActiveProject) {
    return (
      <div className="entry">
        <div className="entry-search">
          <h2 className="search-title">Search your projects</h2>
          <form className="search-form-main" onSubmit={handleSearch}>
            <input
              type="text"
              className="search-input-main"
              placeholder="What are you looking for?"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button type="button" className="search-clear-main" onClick={clearSearch}>
                ×
              </button>
            )}
          </form>
          {searchResults && (
            <div className="search-results-main">
              {searchResults.length === 0 ? (
                <p className="no-results">No matches found</p>
              ) : (
                searchResults.map((result) => (
                  <div
                    key={result._id}
                    className="search-result-item"
                    onClick={() => onSelectProject(result._id)}
                  >
                    <div className="result-header">
                      <span className="result-title">
                        {result.project_title || 'Unknown Project'}
                      </span>
                      <span className="result-score">
                        {(result.score * 100).toFixed(0)}% match
                      </span>
                    </div>
                    {result.image ? (
                      <img src={`/uploads/${result.image}`} alt="Result" className="result-image" />
                    ) : (
                      <p className="result-content">{result.content}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  if (!hasActiveProject) {
    return (
      <div className="entry">
        <div className="entry-empty">
          <p className="greeting">What are you building today?</p>
        </div>
      </div>
    )
  }

  return (
    <div className="entry">
      <div className="messages">
        {messages.map((msg) => (
          <div key={msg._id} className={`message ${msg.role}`}>
            <div className="message-content">
              <div className="message-label">
                {msg.role === 'user' ? 'You' : 'Assistant'}
              </div>
              {msg.content && (
                <div className="message-text">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              )}
              {msg.image && (
                <img src={msg.image.startsWith('blob:') ? msg.image : `/uploads/${msg.image}`} alt="Uploaded" className="message-image" />
              )}
            </div>
          </div>
        ))}
        {isV2 && messages.length > 0 && (
          <div className="save-entry">
            <button
              className={`save-btn ${saveStatus || ''}`}
              onClick={handleSaveProject}
              disabled={saveStatus === 'saving'}
            >
              {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : 'Save'}
            </button>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Image previews */}
      {selectedImages.length > 0 && (
        <div className="image-preview-container">
          {selectedImages.map((img, index) => (
            <div key={index} className="image-preview">
              <img src={img.preview} alt={img.name} />
              <button
                type="button"
                className="remove-image-btn"
                onClick={() => removeImage(index)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <form className="entry-input" onSubmit={handleSubmit}>
        <div className="entry-input-wrapper">
          {isV2 && (
            <>
              <button
                type="button"
                className="photo-btn"
                onClick={handlePhotoClick}
                aria-label="Upload photo"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                multiple
                style={{ display: 'none' }}
              />
            </>
          )}
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="What are you working on?"
          />
          <button type="submit" className="send-btn" aria-label="Send">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </button>
        </div>
      </form>
    </div>
  )
}

export default Entry
