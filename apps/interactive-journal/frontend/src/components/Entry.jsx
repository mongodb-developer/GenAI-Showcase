import { useState, useRef, useEffect } from 'react'

function Entry({ messages, onSendMessage, hasActiveEntry, activeEntry, entries, onRefreshMessages, isV2, activeSection, onSelectEntry }) {
  const [input, setInput] = useState('')
  const [selectedImages, setSelectedImages] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [isSearching, setIsSearching] = useState(false)
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false)
  const messagesEndRef = useRef(null)
  const fileInputRef = useRef(null)

  const handleGeneratePrompt = async () => {
    setIsGeneratingPrompt(true)
    try {
      const activeEntryObj = entries.find(e => e._id === activeEntry)
      const formData = new FormData()
      formData.append('entry_id', activeEntry)
      formData.append('entry_date', activeEntryObj?.created_at || new Date().toISOString())

      await fetch('http://localhost:8000/api/entries/generate-prompt', {
        method: 'POST',
        body: formData
      })
      onRefreshMessages()
    } catch (error) {
      console.error('Failed to generate prompt:', error)
    }
    setIsGeneratingPrompt(false)
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])


  const handleSubmit = (e) => {
    e.preventDefault()
    if ((input.trim() || selectedImages.length > 0) && hasActiveEntry) {
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
      const res = await fetch(`http://localhost:8000/api/entries/search?q=${encodeURIComponent(searchQuery)}`)
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

  // Show search interface when V2 Entries tab is clicked and no entry selected
  if (isV2 && activeSection === 'entries' && !hasActiveEntry) {
    return (
      <div className="entry">
        <div className="entry-search">
          <h2 className="search-title">Search your entries</h2>
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
                    onClick={() => onSelectEntry(result._id)}
                  >
                    <span className="result-date">
                      {new Date(result.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </span>
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

  // Show insights placeholder when V2 Insights tab is active and no entry selected
  if (isV2 && activeSection === 'insights' && !hasActiveEntry) {
    return (
      <div className="entry">
        <div className="entry-empty">
          <p>Insights coming soon...</p>
        </div>
      </div>
    )
  }

  if (!hasActiveEntry) {
    return (
      <div className="entry">
        <div className="entry-empty">
          <p className="greeting">How was your day, Apoorva?</p>
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
                {msg.role === 'user' ? 'You' : 'Memoir'}
              </div>
              {msg.content && <p className="message-text">{msg.content}</p>}
              {msg.image && (
                <img src={msg.image.startsWith('blob:') ? msg.image : `/uploads/${msg.image}`} alt="Uploaded" className="message-image" />
              )}
            </div>
          </div>
        ))}
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

      {isV2 && messages.length === 0 && (
        <div className="prompt-generator">
          <button
            className="generate-prompt-btn"
            onClick={handleGeneratePrompt}
            disabled={isGeneratingPrompt}
          >
            {isGeneratingPrompt ? 'Generating...' : "Need inspiration? Generate a prompt"}
          </button>
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
            placeholder="What's on your mind?"
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
