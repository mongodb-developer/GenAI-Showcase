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

  const createEntry = async (entryDate) => {
    const version = isV2 ? 2 : 1
    const formData = new FormData()
    formData.append('version', version)
    formData.append('entry_date', entryDate)
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

  const toggleVersion = () => {
    setIsV2(!isV2)
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
    const activeEntryObj = entries.find(e => e._id === activeEntry)
    if (activeEntryObj?.created_at) {
      formData.append('entry_date', activeEntryObj.created_at)
    }

    const res = await fetch(`${API_URL}/entries/${activeEntry}/messages`, {
      method: 'POST',
      body: formData
    })

    // Read the streaming response
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    const aiMessageId = Date.now().toString() + '-ai'
    let fullResponse = ''
    let messageAdded = false

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      fullResponse += chunk

      // Add AI message on first chunk, then update
      if (!messageAdded) {
        setMessages(prev => [...prev, { _id: aiMessageId, role: 'assistant', content: fullResponse }])
        messageAdded = true
      } else {
        setMessages(prev => prev.map(msg =>
          msg._id === aiMessageId ? { ...msg, content: fullResponse } : msg
        ))
      }
    }
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
        activeEntry={activeEntry}
        entries={entries}
        onRefreshMessages={() => activeEntry && fetchMessages(activeEntry)}
        isV2={isV2}
        activeSection={activeSection}
        onSelectEntry={setActiveEntry}
      />
    </div>
  )
}

export default App
