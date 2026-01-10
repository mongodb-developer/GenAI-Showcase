import { useState, useEffect } from 'react'

function Sidebar({ projects, activeProject, onSelectProject, onNewProject, onDeleteProject, isV2, onToggleVersion, activeSection, onSectionChange }) {
  const [openMenu, setOpenMenu] = useState(null)
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 })
  const [showNewProject, setShowNewProject] = useState(false)
  const [projectTitle, setProjectTitle] = useState('')

  const handleNewProjectClick = () => {
    setProjectTitle('')
    setShowNewProject(true)
  }

  const handleCreateProject = () => {
    if (projectTitle.trim()) {
      onNewProject(projectTitle.trim())
      setShowNewProject(false)
      setProjectTitle('')
    }
  }

  // Filter projects to only show recent ones (last 7 days) in V2
  const recentProjects = projects.filter(project => {
    const projectDate = new Date(project.created_at)
    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
    return projectDate >= oneWeekAgo
  })

  const handleMenuClick = (e, projectId) => {
    e.stopPropagation()
    if (openMenu === projectId) {
      setOpenMenu(null)
    } else {
      const rect = e.currentTarget.getBoundingClientRect()
      setMenuPosition({
        top: rect.bottom + 4,
        left: rect.left
      })
      setOpenMenu(projectId)
    }
  }

  const handleDelete = (e, projectId) => {
    e.stopPropagation()
    onDeleteProject(projectId)
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

  // Ensure active project is always included, sorted chronologically
  const getDisplayProjects = () => {
    if (!isV2) return projects
    const activeProjectObj = projects.find(p => p._id === activeProject)
    if (!activeProjectObj || recentProjects.find(p => p._id === activeProject)) {
      return recentProjects
    }
    return [...recentProjects, activeProjectObj].sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    )
  }
  const displayProjects = getDisplayProjects()

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
        <div className="logo-container">
          <img src="/mongodb-logo.png" alt="MongoDB" className="logo-icon" />
          <h1 className="logo">DevAssist</h1>
        </div>
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
        <button className="new-entry-btn" onClick={handleNewProjectClick}>
          <span className="new-entry-icon">+</span>
          New Project
        </button>
      </div>

      {showNewProject && (
        <div className="date-picker-overlay" onClick={() => setShowNewProject(false)}>
          <div className="date-picker-modal" onClick={(e) => e.stopPropagation()}>
            <h3>New Project</h3>
            <input
              type="text"
              value={projectTitle}
              onChange={(e) => setProjectTitle(e.target.value)}
              className="date-input"
              placeholder="Project name"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
            />
            <div className="date-picker-actions">
              <button className="date-cancel-btn" onClick={() => setShowNewProject(false)}>
                Cancel
              </button>
              <button className="date-confirm-btn" onClick={handleCreateProject}>
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="sidebar-nav">
        <button
          className={`nav-item ${activeSection === 'projects' ? 'active' : ''}`}
          onClick={() => onSectionChange('projects')}
        >
          Projects
        </button>
      </div>

      <div className="sidebar-section">
        <div className="section-header">Recent</div>
        <div className="entry-list">
          {displayProjects.length === 0 ? (
            <div className="empty-state">No projects yet</div>
          ) : (
            displayProjects.map((project) => (
              <div
                key={project._id}
                className={`entry-item ${activeProject === project._id ? 'active' : ''} ${openMenu === project._id ? 'menu-open' : ''}`}
                onClick={() => onSelectProject(project._id)}
              >
                <span className="entry-title">{project.title}</span>
                <button
                  className={`menu-btn ${openMenu === project._id ? 'open' : ''}`}
                  onClick={(e) => handleMenuClick(e, project._id)}
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
