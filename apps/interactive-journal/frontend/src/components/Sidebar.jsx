import { useState, useEffect } from 'react'

function Sidebar({ entries, activeEntry, onSelectEntry, onNewEntry, onDeleteEntry, isV2, onToggleVersion, activeSection, onSectionChange }) {
  const [openMenu, setOpenMenu] = useState(null)
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 })
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [selectedDate, setSelectedDate] = useState('')

  const handleNewEntryClick = () => {
    setSelectedDate(new Date().toISOString().split('T')[0])
    setShowDatePicker(true)
  }

  const handleDateConfirm = () => {
    if (selectedDate) {
      onNewEntry(selectedDate)
      setShowDatePicker(false)
    }
  }

  // Filter entries to only show recent ones (last 7 days) in V2
  const recentEntries = entries.filter(entry => {
    const entryDate = new Date(entry.created_at)
    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
    return entryDate >= oneWeekAgo
  })

  const handleMenuClick = (e, entryId) => {
    e.stopPropagation()
    if (openMenu === entryId) {
      setOpenMenu(null)
    } else {
      const rect = e.currentTarget.getBoundingClientRect()
      setMenuPosition({
        top: rect.bottom + 4,
        left: rect.left
      })
      setOpenMenu(entryId)
    }
  }

  const handleDelete = (e, entryId) => {
    e.stopPropagation()
    onDeleteEntry(entryId)
    setOpenMenu(null)
  }

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setOpenMenu(null)
    if (openMenu) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [openMenu])

  // Ensure active entry is always included, sorted chronologically
  const getDisplayEntries = () => {
    if (!isV2) return entries
    const activeEntryObj = entries.find(e => e._id === activeEntry)
    if (!activeEntryObj || recentEntries.find(e => e._id === activeEntry)) {
      return recentEntries
    }
    return [...recentEntries, activeEntryObj].sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    )
  }
  const displayEntries = getDisplayEntries()

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h1 className="logo">Memoir</h1>
        <div className="version-toggle">
          <span className={`version-label ${!isV2 ? 'active' : ''}`}>V1</span>
          <button
            className={`toggle-switch ${isV2 ? 'on' : ''}`}
            onClick={onToggleVersion}
            aria-label="Toggle version"
          >
            <span className="toggle-knob" />
          </button>
          <span className={`version-label ${isV2 ? 'active' : ''}`}>V2</span>
        </div>
      </div>

      <div className="sidebar-section">
        <button className="new-entry-btn" onClick={handleNewEntryClick}>
          <span className="new-entry-icon">+</span>
          New Entry
        </button>
      </div>

      {showDatePicker && (
        <div className="date-picker-overlay" onClick={() => setShowDatePicker(false)}>
          <div className="date-picker-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Select entry date</h3>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="date-input"
            />
            <div className="date-picker-actions">
              <button className="date-cancel-btn" onClick={() => setShowDatePicker(false)}>
                Cancel
              </button>
              <button className="date-confirm-btn" onClick={handleDateConfirm}>
                Create Entry
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="sidebar-nav">
        <button
          className={`nav-item ${activeSection === 'entries' ? 'active' : ''}`}
          onClick={() => onSectionChange('entries')}
        >
          Entries
        </button>
        {isV2 && (
          <button
            className={`nav-item ${activeSection === 'insights' ? 'active' : ''}`}
            onClick={() => onSectionChange('insights')}
          >
            Insights
          </button>
        )}
      </div>

      <div className="sidebar-section">
        <div className="section-header">Recent</div>
        <div className="entry-list">
          {displayEntries.length === 0 ? (
            <div className="empty-state">No recent entries</div>
          ) : (
            displayEntries.map((entry) => (
              <div
                key={entry._id}
                className={`entry-item ${activeEntry === entry._id ? 'active' : ''} ${openMenu === entry._id ? 'menu-open' : ''}`}
                onClick={() => onSelectEntry(entry._id)}
              >
                <span className="entry-title">{formatDate(entry.created_at)}</span>
                <button
                  className={`menu-btn ${openMenu === entry._id ? 'open' : ''}`}
                  onClick={(e) => handleMenuClick(e, entry._id)}
                >
                  ⋯
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Fixed position dropdown */}
      {openMenu && (
        <div
          className="dropdown-menu"
          style={{ top: menuPosition.top, left: menuPosition.left }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="dropdown-item delete"
            onClick={(e) => handleDelete(e, openMenu)}
          >
            Delete
          </button>
        </div>
      )}

      <div className="user-info">
        <span className="user-avatar">A</span>
        <span className="user-name">Apoorva</span>
      </div>
    </div>
  )
}

export default Sidebar
