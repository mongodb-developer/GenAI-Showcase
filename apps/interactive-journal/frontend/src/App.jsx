import { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import Entry from './components/Entry'
import './App.css'

const API_URL = 'http://localhost:8000/api'

function App() {
  const [entries, setEntries] = useState([])
  const [activeEntry, setActiveEntry] = useState(null)
  const [messages, setMessages] = useState([])
  const [isV2, setIsV2] = useState(false)
  const [v2Initialized, setV2Initialized] = useState(false)
  const [activeSection, setActiveSection] = useState(null)

  useEffect(() => {
    fetchEntries()
  }, [isV2])

  useEffect(() => {
    if (activeEntry) {
      fetchMessages(activeEntry)
    }
  }, [activeEntry])

  const fetchEntries = async () => {
    const version = isV2 ? 2 : 1
    const res = await fetch(`${API_URL}/entries/?version=${version}`)
    const data = await res.json()
    setEntries(data)
  }

  const fetchMessages = async (entryId) => {
    const res = await fetch(`${API_URL}/entries/${entryId}/messages`)
    const data = await res.json()
    setMessages(data)
  }

  const createEntry = async () => {
    const version = isV2 ? 2 : 1
    const formData = new FormData()
    formData.append('version', version)
    const res = await fetch(`${API_URL}/entries/`, {
      method: 'POST',
      body: formData
    })
    const data = await res.json()
    await fetchEntries()
    setActiveEntry(data._id)
    setMessages([])
    setActiveSection(null)
  }

  const deleteEntry = async (entryId) => {
    await fetch(`${API_URL}/entries/${entryId}`, { method: 'DELETE' })
    await fetchEntries()
    if (activeEntry === entryId) {
      setActiveEntry(null)
      setMessages([])
    }
  }

  const initV2 = async () => {
    if (v2Initialized) return
    try {
      await fetch(`${API_URL}/entries/init-v2`, { method: 'POST' })
      setV2Initialized(true)
    } catch (error) {
      console.error('Failed to initialize V2:', error)
    }
  }

  const toggleVersion = async () => {
    const newIsV2 = !isV2
    if (newIsV2 && !v2Initialized) {
      await initV2()
    }
    setIsV2(newIsV2)
    setActiveEntry(null)
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

    const res = await fetch(`${API_URL}/entries/${activeEntry}/messages`, {
      method: 'POST',
      body: formData
    })
    const data = await res.json()

    // Add AI response
    setMessages(prev => [...prev, { _id: Date.now().toString() + '-ai', role: 'assistant', content: data.response }])
  }

  return (
    <div className="app">
      <Sidebar
        entries={entries}
        activeEntry={activeEntry}
        onSelectEntry={(entryId) => {
          setActiveEntry(entryId)
          if (isV2) setActiveSection('entries')
        }}
        onNewEntry={createEntry}
        onDeleteEntry={deleteEntry}
        isV2={isV2}
        onToggleVersion={toggleVersion}
        activeSection={activeSection}
        onSectionChange={(section) => {
          setActiveSection(section)
          setActiveEntry(null)
          setMessages([])
        }}
      />
      <Entry
        messages={messages}
        onSendMessage={sendMessage}
        hasActiveEntry={!!activeEntry}
        isV2={isV2}
        activeSection={activeSection}
        onSelectEntry={setActiveEntry}
      />
    </div>
  )
}

export default App
