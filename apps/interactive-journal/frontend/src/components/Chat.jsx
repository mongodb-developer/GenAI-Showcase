import { useState, useRef, useEffect } from 'react'

function Chat({ messages, onSendMessage, hasActiveChat }) {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (input.trim() && hasActiveChat) {
      onSendMessage(input)
      setInput('')
    }
  }

  if (!hasActiveChat) {
    return (
      <div className="chat">
        <div className="chat-empty">
          <p>Select an entry or create a new one to start journaling</p>
        </div>
      </div>
    )
  }

  return (
    <div className="chat">
      <div className="messages">
        {messages.map((msg) => (
          <div key={msg._id} className={`message ${msg.role}`}>
            <div className="message-content">
              <div className="message-label">
                {msg.role === 'user' ? 'You' : 'Memoir'}
              </div>
              {msg.content}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form className="chat-input" onSubmit={handleSubmit}>
        <div className="chat-input-wrapper">
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

export default Chat
