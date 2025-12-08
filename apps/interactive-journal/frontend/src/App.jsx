import { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import Chat from './components/Chat'
import './App.css'

const API_URL = 'http://localhost:8000/api'

function App() {
  const [chats, setChats] = useState([])
  const [activeChat, setActiveChat] = useState(null)
  const [messages, setMessages] = useState([])

  useEffect(() => {
    fetchChats()
  }, [])

  useEffect(() => {
    if (activeChat) {
      fetchMessages(activeChat)
    }
  }, [activeChat])

  const fetchChats = async () => {
    const res = await fetch(`${API_URL}/chats/`)
    const data = await res.json()
    setChats(data)
  }

  const fetchMessages = async (chatId) => {
    const res = await fetch(`${API_URL}/chats/${chatId}/messages`)
    const data = await res.json()
    setMessages(data)
  }

  const createChat = async () => {
    const res = await fetch(`${API_URL}/chats/`, { method: 'POST' })
    const data = await res.json()
    await fetchChats()
    setActiveChat(data._id)
    setMessages([])
  }

  const deleteChat = async (chatId) => {
    await fetch(`${API_URL}/chats/${chatId}`, { method: 'DELETE' })
    await fetchChats()
    if (activeChat === chatId) {
      setActiveChat(null)
      setMessages([])
    }
  }

  const sendMessage = async (content) => {
    // Show user message immediately
    const userMsg = {
      _id: Date.now().toString(),
      role: 'user',
      content
    }
    setMessages(prev => [...prev, userMsg])

    // Get AI response
    const res = await fetch(`${API_URL}/chats/${activeChat}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    })
    const data = await res.json()

    // Add AI response
    setMessages(prev => [...prev, { _id: Date.now().toString() + '-ai', role: 'assistant', content: data.response }])
  }

  return (
    <div className="app">
      <Sidebar
        chats={chats}
        activeChat={activeChat}
        onSelectChat={setActiveChat}
        onNewChat={createChat}
        onDeleteChat={deleteChat}
      />
      <Chat
        messages={messages}
        onSendMessage={sendMessage}
        hasActiveChat={!!activeChat}
      />
    </div>
  )
}

export default App
