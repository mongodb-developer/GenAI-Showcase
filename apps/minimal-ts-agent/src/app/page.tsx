"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState, useRef, useEffect } from "react";

const transport = new DefaultChatTransport({ api: "/api/chat" });

const suggestions = [
  "What does the MongoDB brand book say about humor?",
  "How should MongoDB sound when writing technical docs?",
  "What are the four characteristics of MongoDB's tone of voice?",
  "Should I use the Oxford comma when writing for MongoDB?",
  "How does MongoDB approach jargon in writing?",
  "What's the difference between how MongoDB sounds and how it writes?",
];

export default function ChatPage() {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status } = useChat({ transport });

  const isLoading = status === "streaming" || status === "submitted";

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage({ text: input });
    setInput("");
  };

  const handleSuggestion = (suggestion: string) => {
    if (isLoading) return;
    sendMessage({ text: suggestion });
  };

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto">
      {/* Header */}
      <header className="flex items-center gap-3 px-6 py-4 border-b border-border-color">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-mdb-green/10">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            className="text-mdb-green"
          >
            <path
              d="M12.14 2.06c-.26-.7-1.02-.7-1.28 0L8.5 8.5l-6.44 2.36c-.7.26-.7 1.02 0 1.28L8.5 14.5l2.36 6.44c.26.7 1.02.7 1.28 0L14.5 14.5l6.44-2.36c.7-.26.7-1.02 0-1.28L14.5 8.5l-2.36-6.44z"
              fill="currentColor"
            />
          </svg>
        </div>
        <div>
          <h1 className="text-lg font-semibold">MongoDB Brand Expert</h1>
          <p className="text-sm text-muted">
            RAG Agent powered by ToolLoopAgent + Atlas Vector Search
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2 text-xs text-muted">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-mdb-green animate-pulse"></span>
            Gemini Flash
          </span>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">
                Ask me about the MongoDB Brand Book
              </h2>
              <p className="text-muted max-w-md">
                I use an agentic reasoning loop to search MongoDB Atlas Vector
                Search and deliver precise answers from the official brand
                guidelines.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl w-full">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => handleSuggestion(suggestion)}
                  className="text-left px-4 py-3 rounded-xl border border-border-color bg-card-bg hover:border-mdb-green/50 hover:bg-mdb-green/5 transition-all text-sm text-foreground/80"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            {message.role === "assistant" && (
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-mdb-green/10 flex items-center justify-center mt-1">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="text-mdb-green"
                >
                  <path
                    d="M12.14 2.06c-.26-.7-1.02-.7-1.28 0L8.5 8.5l-6.44 2.36c-.7.26-.7 1.02 0 1.28L8.5 14.5l2.36 6.44c.26.7 1.02.7 1.28 0L14.5 14.5l6.44-2.36c.7-.26.7-1.02 0-1.28L14.5 8.5l-2.36-6.44z"
                    fill="currentColor"
                  />
                </svg>
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                message.role === "user"
                  ? "bg-mdb-green text-black font-medium"
                  : "bg-card-bg border border-border-color"
              }`}
            >
              {message.parts?.map((part, i) => {
                switch (part.type) {
                  case "text":
                    return (
                      <div
                        key={i}
                        className={`prose ${
                          message.role === "user"
                            ? "text-black [&_strong]:text-black"
                            : ""
                        }`}
                        dangerouslySetInnerHTML={{
                          __html: formatMarkdown(part.text),
                        }}
                      />
                    );
                  default:
                    // Handle tool invocation parts (type starts with "tool-")
                    if (part.type.startsWith("tool-")) {
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const toolPart = part as any;
                      const isDone = toolPart.state === "result" || toolPart.state === "output" || "output" in toolPart;
                      return (
                        <div
                          key={i}
                          className="flex items-center gap-2 text-sm text-muted py-1"
                        >
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-mdb-green/10 text-mdb-green text-xs font-mono">
                            {isDone ? (
                              <svg
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                              >
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            ) : (
                              <span className="w-3 h-3 border-2 border-mdb-green border-t-transparent rounded-full animate-spin" />
                            )}
                            🔍 searchDocumentation
                          </span>
                          {!isDone && (
                            <span className="text-xs text-muted">
                              Searching MongoDB...
                            </span>
                          )}
                        </div>
                      );
                    }
                    return null;
                }
              })}
            </div>
          </div>
        ))}

        {isLoading &&
          messages.length > 0 &&
          messages[messages.length - 1].role === "user" && (
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-mdb-green/10 flex items-center justify-center">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="text-mdb-green animate-pulse"
                >
                  <path
                    d="M12.14 2.06c-.26-.7-1.02-.7-1.28 0L8.5 8.5l-6.44 2.36c-.7.26-.7 1.02 0 1.28L8.5 14.5l2.36 6.44c.26.7 1.02.7 1.28 0L14.5 14.5l6.44-2.36c.7-.26.7-1.02 0-1.28L14.5 8.5l-2.36-6.44z"
                    fill="currentColor"
                  />
                </svg>
              </div>
              <div className="bg-card-bg border border-border-color rounded-2xl px-4 py-3">
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-mdb-green/60 rounded-full animate-bounce [animation-delay:0ms]"></span>
                  <span className="w-2 h-2 bg-mdb-green/60 rounded-full animate-bounce [animation-delay:150ms]"></span>
                  <span className="w-2 h-2 bg-mdb-green/60 rounded-full animate-bounce [animation-delay:300ms]"></span>
                </div>
              </div>
            </div>
          )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border-color px-6 py-4">
        <form onSubmit={handleSubmit} className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about MongoDB brand guidelines..."
            className="flex-1 bg-card-bg border border-border-color rounded-xl px-4 py-3 text-foreground placeholder:text-muted focus:outline-none focus:border-mdb-green/50 focus:ring-1 focus:ring-mdb-green/25 transition-all"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="bg-mdb-green text-black font-semibold px-6 py-3 rounded-xl hover:bg-mdb-green/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {isLoading ? (
              <span className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin inline-block" />
            ) : (
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            )}
          </button>
        </form>
        <p className="text-xs text-muted text-center mt-2">
          Powered by Vercel AI SDK ToolLoopAgent • Gemini Flash • MongoDB Atlas
          Vector Search
        </p>
      </div>
    </div>
  );
}

// Simple markdown formatter (no dependencies needed)
function formatMarkdown(text: string): string {
  return (
    text
      // Headers
      .replace(/^### (.+)$/gm, "<h3>$1</h3>")
      .replace(/^## (.+)$/gm, "<h2>$1</h2>")
      .replace(/^# (.+)$/gm, "<h1>$1</h1>")
      // Bold
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      // Italic
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      // Inline code
      .replace(/`(.+?)`/g, "<code>$1</code>")
      // Unordered lists
      .replace(/^- (.+)$/gm, "<li>$1</li>")
      .replace(/(<li>.*<\/li>\n?)+/g, "<ul>$&</ul>")
      // Ordered lists
      .replace(/^\d+\. (.+)$/gm, "<li>$1</li>")
      // Line breaks
      .replace(/\n\n/g, "</p><p>")
      .replace(/\n/g, "<br/>")
      // Wrap in paragraphs
      .replace(/^(.+)/, "<p>$1</p>")
  );
}
