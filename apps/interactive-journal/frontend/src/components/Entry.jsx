import { useState, useRef, useEffect } from 'react'

function Entry({ messages, onSendMessage, hasActiveEntry, activeEntry, entries, onRefreshMessages, isV2, activeSection, onSelectEntry }) {
  const [input, setInput] = useState('')
  const [selectedImages, setSelectedImages] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [isSearching, setIsSearching] = useState(false)
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false)
  const [insights, setInsights] = useState(null)
  const [saveStatus, setSaveStatus] = useState(null)
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

  const handleSaveEntry = async () => {
    setSaveStatus('saving')
    try {
      const activeEntryObj = entries.find(e => e._id === activeEntry)
      const formData = new FormData()
      formData.append('entry_date', activeEntryObj?.created_at || new Date().toISOString())

      await fetch(`http://localhost:8000/api/entries/${activeEntry}/analyze`, {
        method: 'POST',
        body: formData
      })
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus(null), 2000)
    } catch (error) {
      console.error('Failed to save entry:', error)
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
    if (isV2 && activeSection === 'insights') {
      fetch('http://localhost:8000/api/entries/insights')
        .then(res => res.json())
        .then(data => setInsights(data))
        .catch(err => console.error('Failed to fetch insights:', err))
    }
  }, [isV2, activeSection])

  useEffect(() => {
    setSearchQuery('')
    setSearchResults(null)
  }, [isV2])


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
      const version = isV2 ? 2 : 1
      const res = await fetch(`http://localhost:8000/api/entries/search?q=${encodeURIComponent(searchQuery)}&version=${version}`)
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

  // Show search interface when Entries tab is clicked and no entry selected
  if (activeSection === 'entries' && !hasActiveEntry) {
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
                    <div className="result-header">
                      <span className="result-date">
                        {new Date(result.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
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

  // Show insights when V2 Insights tab is active and no entry selected
  if (isV2 && activeSection === 'insights' && !hasActiveEntry) {
    return (
      <div className="entry">
        <div className="entry-search">
          <h2 className="search-title">Your month in review</h2>
          {insights ? (
            <>
              <div className="insights-grid">
                <div className="insight-card">
                  <span className="insight-value">{insights.total_entries}</span>
                  <span className="insight-label">Entries</span>
                </div>
                <div className="insight-card">
                  <span className="insight-value">{insights.longest_streak}</span>
                  <span className="insight-label">Longest streak</span>
                </div>
              </div>

              {(insights.mood.positive > 0 || insights.mood.neutral > 0 || insights.mood.mixed > 0 || insights.mood.negative > 0) && (
                <div className="mood-section">
                  <h3 className="section-title">Mood</h3>
                  <div className="mood-bars">
                    <div className="mood-row">
                      <span className="mood-emoji">😊</span>
                      <div className="mood-bar-track">
                        <div className="mood-bar-fill positive" style={{ width: `${insights.mood.positive}%` }} />
                      </div>
                      <span className="mood-percent">{insights.mood.positive}%</span>
                    </div>
                    <div className="mood-row">
                      <span className="mood-emoji">😐</span>
                      <div className="mood-bar-track">
                        <div className="mood-bar-fill neutral" style={{ width: `${insights.mood.neutral}%` }} />
                      </div>
                      <span className="mood-percent">{insights.mood.neutral}%</span>
                    </div>
                    <div className="mood-row">
                      <span className="mood-emoji">🤔</span>
                      <div className="mood-bar-track">
                        <div className="mood-bar-fill mixed" style={{ width: `${insights.mood.mixed}%` }} />
                      </div>
                      <span className="mood-percent">{insights.mood.mixed}%</span>
                    </div>
                    <div className="mood-row">
                      <span className="mood-emoji">😔</span>
                      <div className="mood-bar-track">
                        <div className="mood-bar-fill negative" style={{ width: `${insights.mood.negative}%` }} />
                      </div>
                      <span className="mood-percent">{insights.mood.negative}%</span>
                    </div>
                  </div>
                </div>
              )}

              {insights.themes.length > 0 && (
                <div className="themes-section">
                  <h3 className="section-title">Themes</h3>
                  <div className="word-cloud">
                    {insights.themes.map((item, i) => (
                      <span
                        key={i}
                        className="theme-word"
                        style={{ fontSize: `${Math.max(14, Math.min(32, 14 + item.count * 4))}px` }}
                      >
                        {item.theme}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="no-results">Loading...</p>
          )}
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
        {isV2 && messages.length > 0 && (
          <div className="save-entry">
            <button
              className={`save-btn ${saveStatus || ''}`}
              onClick={handleSaveEntry}
              disabled={saveStatus === 'saving'}
            >
              {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved ✓' : 'Save'}
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
