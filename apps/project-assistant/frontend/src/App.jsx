import { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import Entry from './components/Entry'
import './App.css'

const API_URL = 'http://localhost:8000/api'

function App() {
  const [projects, setProjects] = useState([])
  const [activeProject, setActiveProject] = useState(null)
  const [messages, setMessages] = useState([])
  const [isV2, setIsV2] = useState(false)
  const [activeSection, setActiveSection] = useState(null)

  useEffect(() => {
    fetchProjects()
  }, [isV2])

  useEffect(() => {
    if (activeProject) {
      fetchMessages(activeProject)
    }
  }, [activeProject])

  const fetchProjects = async () => {
    const version = isV2 ? 2 : 1
    const res = await fetch(`${API_URL}/projects/?version=${version}`)
    const data = await res.json()
    setProjects(data)
  }

  const fetchMessages = async (projectId) => {
    const res = await fetch(`${API_URL}/projects/${projectId}/messages`)
    const data = await res.json()
    setMessages(data)
  }

  const createProject = async (title) => {
    const version = isV2 ? 2 : 1
    const formData = new FormData()
    formData.append('version', version)
    formData.append('title', title)
    const res = await fetch(`${API_URL}/projects/`, {
      method: 'POST',
      body: formData
    })
    const data = await res.json()
    await fetchProjects()
    setActiveProject(data._id)
    setMessages([])
    setActiveSection(null)
  }

  const deleteProject = async (projectId) => {
    await fetch(`${API_URL}/projects/${projectId}`, { method: 'DELETE' })
    await fetchProjects()
    if (activeProject === projectId) {
      setActiveProject(null)
      setMessages([])
    }
  }

  const toggleVersion = () => {
    setIsV2(!isV2)
    setActiveProject(null)
    setMessages([])
  }

  const sendMessage = async (content, images = []) => {
    // Show user messages immediately (text and images separately)
    const newMessages = []

    if (content.trim()) {
      newMessages.push({
        _id: Date.now().toString(),
        role: 'user',
        content
      })
    }

    images.forEach((img, index) => {
      newMessages.push({
        _id: Date.now().toString() + '-img-' + index,
        role: 'user',
        image: img.preview
      })
    })

    // Show user messages immediately
    setMessages(prev => [...prev, ...newMessages])

    // Send to backend using FormData
    const formData = new FormData()
    if (content) {
      formData.append('content', content)
    }
    images.forEach(img => {
      formData.append('images', img.file)
    })
    formData.append('version', isV2 ? 2 : 1)
    const activeProjectObj = projects.find(p => p._id === activeProject)
    if (activeProjectObj?.created_at) {
      formData.append('project_date', activeProjectObj.created_at)
    }
    formData.append('project_title', activeProjectObj?.title || 'Unknown')

    // Add placeholder message for assistant response
    const aiMessageId = Date.now().toString() + '-ai'
    setMessages(prev => [...prev, {
      _id: aiMessageId,
      role: 'assistant',
      thinking: '',
      content: ''
    }])

    const res = await fetch(`${API_URL}/projects/${activeProject}/messages`, {
      method: 'POST',
      body: formData
    })

    // Read newline-delimited JSON stream
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let thinkingContent = ''
    let responseContent = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // Process complete JSON lines
      const lines = buffer.split('\n')
      buffer = lines.pop() // Keep incomplete line in buffer

      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const chunk = JSON.parse(line)
          if (chunk.type === 'thinking') {
            thinkingContent += chunk.content
          } else if (chunk.type === 'response') {
            responseContent += chunk.content
          }

          // Update message with current state
          setMessages(prev => prev.map(msg =>
            msg._id === aiMessageId
              ? { ...msg, thinking: thinkingContent, content: responseContent }
              : msg
          ))
        } catch (e) {
          console.error('Failed to parse chunk:', e)
        }
      }
    }
  }

  return (
    <div className="app">
      <Sidebar
        projects={projects}
        activeProject={activeProject}
        onSelectProject={(projectId) => {
          setActiveProject(projectId)
          if (isV2) setActiveSection('projects')
        }}
        onNewProject={createProject}
        onDeleteProject={deleteProject}
        isV2={isV2}
        onToggleVersion={toggleVersion}
        activeSection={activeSection}
        onSectionChange={(section) => {
          setActiveSection(section)
          setActiveProject(null)
          setMessages([])
        }}
      />
      <Entry
        messages={messages}
        onSendMessage={sendMessage}
        hasActiveProject={!!activeProject}
        activeProject={activeProject}
        projects={projects}
        onRefreshMessages={() => activeProject && fetchMessages(activeProject)}
        isV2={isV2}
        activeSection={activeSection}
        onSelectProject={setActiveProject}
      />
    </div>
  )
}

export default App
