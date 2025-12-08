import { useState, useEffect } from 'react'

function Sidebar({ chats, activeChat, onSelectChat, onNewChat, onDeleteChat }) {
  const [openMenu, setOpenMenu] = useState(null)
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 })

  const handleMenuClick = (e, chatId) => {
    e.stopPropagation()
    if (openMenu === chatId) {
      setOpenMenu(null)
    } else {
      const rect = e.currentTarget.getBoundingClientRect()
      setMenuPosition({
        top: rect.bottom + 4,
        left: rect.left
      })
      setOpenMenu(chatId)
    }
  }

  const handleDelete = (e, chatId) => {
    e.stopPropagation()
    onDeleteChat(chatId)
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

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h1 className="logo">Memoir</h1>
      </div>

      <div className="sidebar-section">
        <button className="new-chat-btn" onClick={onNewChat}>
          <span className="new-chat-icon">+</span>
          New Entry
        </button>
      </div>

      <div className="sidebar-section">
        <div className="section-header">Previous Entries</div>
        <div className="chat-list">
          {chats.length === 0 ? (
            <div className="empty-state">No entries yet</div>
          ) : (
            chats.map((chat) => (
              <div
                key={chat._id}
                className={`chat-item ${activeChat === chat._id ? 'active' : ''} ${openMenu === chat._id ? 'menu-open' : ''}`}
                onClick={() => onSelectChat(chat._id)}
              >
                <span className="chat-title">{chat.title}</span>
                <button
                  className={`menu-btn ${openMenu === chat._id ? 'open' : ''}`}
                  onClick={(e) => handleMenuClick(e, chat._id)}
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
    </div>
  )
}

export default Sidebar
