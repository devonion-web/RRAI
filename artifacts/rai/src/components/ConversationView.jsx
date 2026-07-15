import React, { useState, useRef, useCallback, useEffect } from 'react'
import {
  useGetConversation,
  useListMessages,
  useChangeConversationLens,
} from '@workspace/api-client-react'

const NAVY = '#0B1F3A'

const LENS_COLOURS = {
  analyst: '#3b82f6',
  intelligence: '#8b5cf6',
  commercial: '#10b981',
  delivery: '#f59e0b',
}

const LENS_LABELS = {
  analyst: 'Analyst',
  intelligence: 'Intelligence',
  commercial: 'Commercial',
  delivery: 'Delivery',
}

function LensBadge({ lens, interactive, onChangeLens }) {
  const [open, setOpen] = useState(false)
  const colour = LENS_COLOURS[lens] ?? '#64748b'
  const label = LENS_LABELS[lens] ?? lens

  if (!interactive) {
    return (
      <span style={{
        display: 'inline-block',
        background: `${colour}18`,
        color: colour,
        border: `1px solid ${colour}40`,
        borderRadius: 4,
        fontSize: 10,
        fontWeight: 700,
        padding: '2px 7px',
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
      }}>
        {label}
      </span>
    )
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          background: `${colour}18`,
          color: colour,
          border: `1px solid ${colour}40`,
          borderRadius: 4,
          fontSize: 10,
          fontWeight: 700,
          padding: '2px 7px',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        {label} ▾
      </button>
      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          left: 0,
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          boxShadow: '0 4px 16px rgba(11,31,58,0.12)',
          zIndex: 100,
          minWidth: 140,
          padding: 4,
        }}>
          {Object.entries(LENS_LABELS).map(([l, lbl]) => (
            <button
              key={l}
              onClick={() => { onChangeLens(l); setOpen(false) }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                background: l === lens ? '#f4f7fb' : 'none',
                border: 'none',
                borderRadius: 6,
                padding: '7px 10px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 12,
                fontWeight: l === lens ? 700 : 400,
                color: NAVY,
                textAlign: 'left',
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: LENS_COLOURS[l], flexShrink: 0 }} />
              {lbl}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function MessageBubble({ message, isStreaming }) {
  const isUser = message.role === 'user'
  const isFailed = message.status === 'failed'

  return (
    <div style={{
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      marginBottom: 16,
    }}>
      <div style={{
        maxWidth: '72%',
        background: isUser ? NAVY : '#fff',
        color: isUser ? '#fff' : '#1e293b',
        border: isUser ? 'none' : '1px solid #e2e8f0',
        borderRadius: isUser ? '16px 16px 4px 16px' : '4px 16px 16px 16px',
        padding: '12px 16px',
        fontSize: 14,
        lineHeight: 1.6,
        boxShadow: isUser ? 'none' : '0 1px 3px rgba(11,31,58,0.05)',
      }}>
        {isFailed ? (
          <div style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>⚠</span>
            <span>The assistant encountered an error. Please try again.</span>
          </div>
        ) : (
          <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {message.content}
            {isStreaming && (
              <span style={{
                display: 'inline-block',
                width: 8,
                height: 14,
                background: '#3b82f6',
                borderRadius: 2,
                marginLeft: 2,
                verticalAlign: 'middle',
                animation: 'blink 1s step-end infinite',
              }} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 16 }}>
      <div style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: '4px 16px 16px 16px',
        padding: '12px 16px',
        display: 'flex',
        gap: 4,
        alignItems: 'center',
      }}>
        {[0, 150, 300].map(delay => (
          <span key={delay} style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: '#94a3b8',
            display: 'inline-block',
            animation: `pulse 1.2s ease-in-out ${delay}ms infinite`,
          }} />
        ))}
      </div>
    </div>
  )
}

function EmptyConversation({ onSend }) {
  const suggestions = [
    'Give me a brief overview of LogicGate as a platform',
    'What are the main risk management challenges organisations face today?',
    'Help me structure a discovery conversation with a new prospect',
  ]

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 24px',
      gap: 16,
    }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>✦</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: NAVY }}>Start the conversation</div>
      <div style={{ fontSize: 13, color: '#64748b', textAlign: 'center', maxWidth: 360 }}>
        Ask anything. The assistant is aware of your active lens and any linked opportunity.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 400, marginTop: 8 }}>
        {suggestions.map(s => (
          <button
            key={s}
            onClick={() => onSend(s)}
            style={{
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              padding: '10px 14px',
              fontSize: 12,
              color: '#475569',
              cursor: 'pointer',
              fontFamily: 'inherit',
              textAlign: 'left',
              lineHeight: 1.4,
            }}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function ConversationView({ conversationId, onBack }) {
  const [input, setInput] = useState('')
  const [streamingContent, setStreamingContent] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [streamError, setStreamError] = useState(null)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const abortRef = useRef(null)

  const { data: convData, refetch: refetchConv } = useGetConversation(conversationId)
  const { data: msgsData, refetch: refetchMessages } = useListMessages(conversationId)
  const changeLens = useChangeConversationLens()

  const conversation = convData?.conversation
  const messages = msgsData?.messages ?? []
  const lens = conversation?.active_lens ?? 'analyst'

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent, isGenerating])

  // Cleanup on unmount
  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  const sendMessage = useCallback(async (content) => {
    const text = (typeof content === 'string' ? content : input).trim()
    if (!text || isGenerating) return

    setInput('')
    setStreamError(null)
    setStreamingContent('')
    setIsGenerating(true)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const response = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content: text }),
        signal: controller.signal,
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Request failed' }))
        throw new Error(err.error ?? 'Request failed')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim()
          if (!raw) continue

          try {
            const event = JSON.parse(raw)
            if (typeof event.delta === 'string') {
              setStreamingContent(prev => prev + event.delta)
            } else if (event.done) {
              setStreamingContent('')
              await refetchMessages()
              await refetchConv()
            } else if (event.error) {
              setStreamError(event.error)
              setStreamingContent('')
              await refetchMessages()
            }
          } catch {
            // ignore malformed SSE events
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setStreamError(err.message ?? 'Connection error')
      }
    } finally {
      setIsGenerating(false)
      await refetchMessages()
      inputRef.current?.focus()
    }
  }, [conversationId, input, isGenerating, refetchMessages, refetchConv])

  async function handleChangeLens(newLens) {
    try {
      await changeLens.mutateAsync({ id: conversationId, data: { lens: newLens } })
      await refetchConv()
    } catch (err) {
      console.error('Failed to change lens', err)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  if (!conversation) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontFamily: 'Inter, Arial, sans-serif',
        color: '#94a3b8',
        fontSize: 13,
      }}>
        Loading…
      </div>
    )
  }

  const lensColour = LENS_COLOURS[lens] ?? '#64748b'

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      fontFamily: 'Inter, Arial, sans-serif',
      background: '#f4f7fb',
    }}>
      <style>{`
        @keyframes blink { 50% { opacity: 0; } }
        @keyframes pulse {
          0%, 100% { transform: scale(0.8); opacity: 0.4; }
          50% { transform: scale(1.2); opacity: 1; }
        }
      `}</style>

      {/* Header */}
      <div style={{
        background: NAVY,
        color: '#fff',
        padding: '0 20px',
        display: 'flex',
        alignItems: 'center',
        height: 52,
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        gap: 12,
        flexShrink: 0,
      }}>
        <button
          onClick={onBack}
          style={{
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 6,
            color: 'rgba(255,255,255,0.7)',
            padding: '4px 12px',
            fontSize: 12,
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontWeight: 600,
          }}
        >
          ← Home
        </button>

        <div style={{
          fontSize: 14,
          fontWeight: 700,
          color: '#fff',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
        }}>
          {conversation.title}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {conversation.opportunity_id && (
            <span style={{
              fontSize: 10,
              color: 'rgba(255,255,255,0.5)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 4,
              padding: '2px 6px',
            }}>
              Opportunity linked
            </span>
          )}
          <LensBadge
            lens={lens}
            interactive
            onChangeLens={handleChangeLens}
          />
        </div>
      </div>

      {/* Message area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '24px 0',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {messages.length === 0 && !isGenerating ? (
          <EmptyConversation onSend={sendMessage} />
        ) : (
          <div style={{ maxWidth: 760, margin: '0 auto', width: '100%', padding: '0 20px' }}>
            {messages.map(msg => (
              <MessageBubble
                key={msg.id}
                message={msg}
                isStreaming={false}
              />
            ))}

            {isGenerating && streamingContent && (
              <MessageBubble
                message={{ id: 'streaming', role: 'assistant', content: streamingContent, status: 'streaming' }}
                isStreaming
              />
            )}

            {isGenerating && !streamingContent && <TypingIndicator />}

            {streamError && (
              <div style={{
                background: '#fef2f2',
                border: '1px solid #fca5a5',
                borderRadius: 8,
                padding: '10px 14px',
                marginBottom: 16,
                fontSize: 13,
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                <span>⚠</span>
                <span>{streamError}</span>
                <button
                  onClick={() => setStreamError(null)}
                  style={{
                    marginLeft: 'auto',
                    background: 'none',
                    border: 'none',
                    color: '#dc2626',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: 12,
                  }}
                >
                  Dismiss
                </button>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div style={{
        background: '#fff',
        borderTop: '1px solid #e2e8f0',
        padding: '16px 20px',
        flexShrink: 0,
      }}>
        <div style={{
          maxWidth: 760,
          margin: '0 auto',
          display: 'flex',
          gap: 10,
          alignItems: 'flex-end',
        }}>
          <div style={{ flex: 1 }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isGenerating}
              placeholder={isGenerating ? 'Generating response…' : 'Type a message…'}
              rows={1}
              style={{
                width: '100%',
                resize: 'none',
                border: '1px solid #e2e8f0',
                borderRadius: 10,
                padding: '10px 14px',
                fontSize: 14,
                fontFamily: 'inherit',
                lineHeight: 1.5,
                outline: 'none',
                background: isGenerating ? '#f8fafc' : '#fff',
                color: '#1e293b',
                boxSizing: 'border-box',
                minHeight: 42,
                maxHeight: 160,
                overflowY: 'auto',
              }}
              onInput={e => {
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px'
              }}
            />
          </div>

          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || isGenerating}
            style={{
              background: !input.trim() || isGenerating ? '#e2e8f0' : NAVY,
              color: !input.trim() || isGenerating ? '#94a3b8' : '#fff',
              border: 'none',
              borderRadius: 10,
              padding: '10px 18px',
              fontSize: 13,
              fontWeight: 700,
              cursor: !input.trim() || isGenerating ? 'default' : 'pointer',
              fontFamily: 'inherit',
              height: 42,
              flexShrink: 0,
              transition: 'background 0.15s',
            }}
          >
            Send
          </button>
        </div>

        <div style={{
          maxWidth: 760,
          margin: '6px auto 0',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <div style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: LENS_COLOURS[lens] ?? '#64748b',
          }} />
          <span style={{ fontSize: 10, color: '#94a3b8' }}>
            {LENS_LABELS[lens] ?? lens} lens · Enter to send, Shift+Enter for new line
          </span>
        </div>
      </div>
    </div>
  )
}
