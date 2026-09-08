import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import {
  Hash,
  MessageSquare,
  Send,
  Search,
  Reply,
  X,
} from 'lucide-react'
import { useAppState } from '@/stores/AppState'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import type { DiscussionMessage } from '@/types'

function formatMessageTime(date: Date): string {
  const now = new Date()
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()

  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (isToday) return time

  const dateStr = date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
  return `${dateStr} ${time}`
}

export function Discussions() {
  const {
    addMessage: addLocalMessage,
    markChannelRead,
    users,
    currentUser,
    addNotification,
  } = useAppState()

  const [selectedChannel, setSelectedChannel] = useState(channels[0]?.id || '')
  const [newMessage, setNewMessage] = useState('')
  const [channelSearch, setChannelSearch] = useState('')
  const [replyTo, setReplyTo] = useState<DiscussionMessage | null>(null)
  const [showMentionDropdown, setShowMentionDropdown] = useState(false)
  const [mentionFilter, setMentionFilter] = useState('')
  const [mentionStartIndex, setMentionStartIndex] = useState(-1)

  // API data
  const [channels, setChannels] = useState<DiscussionChannel[]>([])
  const [messages, setMessages] = useState<DiscussionMessage[]>([])

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const mentionDropdownRef = useRef<HTMLDivElement>(null)

  const activeChannel = useMemo(
    () => channels.find((c) => c.id === selectedChannel),
    [channels, selectedChannel]
  )

  const channelMessages = useMemo(
    () =>
      messages
        .filter((m) => m.channelId === selectedChannel)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
    [messages, selectedChannel]
  )

  const filteredChannels = useMemo(
    () =>
      channels.filter((c) =>
        c.name.toLowerCase().includes(channelSearch.toLowerCase())
      ),
    [channels, channelSearch]
  )

  const mentionResults = useMemo(() => {
    if (!showMentionDropdown) return []
    const filter = mentionFilter.toLowerCase()
    return users
      .filter(
        (u) =>
          u.id !== currentUser?.id &&
          u.name.toLowerCase().includes(filter)
      )
      .slice(0, 6)
  }, [users, currentUser, mentionFilter, showMentionDropdown])

  const getUserById = useCallback(
    (id: string) => users.find((u) => u.id === id) || { name: 'Unknown', id },
    [users]
  )

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [channelMessages.length, scrollToBottom])

  useEffect(() => {
    ;(async () => {
      try {
        const ch = await api.getChannels()
        setChannels(ch)
      } catch (err) {
        console.error('Failed to load channels:', err)
      }
    })()
  }, [])

  useEffect(() => {
    ;(async () => {
      if (selectedChannel) {
        try {
          const msgs = await api.getMessages(selectedChannel)
          setMessages(msgs)
        } catch (err) {
          console.error('Failed to load messages:', err)
        }
      }
    })()
  }, [selectedChannel])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        mentionDropdownRef.current &&
        !mentionDropdownRef.current.contains(e.target as Node)
      ) {
        setShowMentionDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleChannelSelect = useCallback(
    (channelId: string) => {
      setSelectedChannel(channelId)
      setReplyTo(null)
      setShowMentionDropdown(false)
    },
    []
  )

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value
      setNewMessage(value)

      const cursorPos = e.target.selectionStart ?? value.length
      const textBeforeCursor = value.slice(0, cursorPos)
      const atIndex = textBeforeCursor.lastIndexOf('@')

      if (atIndex >= 0) {
        const charBeforeAt = atIndex > 0 ? textBeforeCursor[atIndex - 1] : ' '
        if (atIndex === 0 || charBeforeAt === ' ') {
          const filter = textBeforeCursor.slice(atIndex + 1)
          if (!filter.includes(' ')) {
            setMentionFilter(filter)
            setMentionStartIndex(atIndex)
            setShowMentionDropdown(true)
            return
          }
        }
      }
      setShowMentionDropdown(false)
    },
    []
  )

  const insertMention = useCallback(
    (userName: string) => {
      const before = newMessage.slice(0, mentionStartIndex)
      const cursorPos = inputRef.current?.selectionStart ?? newMessage.length
      const after = newMessage.slice(cursorPos)
      const inserted = `${before}@${userName} ${after}`
      setNewMessage(inserted)
      setShowMentionDropdown(false)
      setTimeout(() => {
        if (inputRef.current) {
          const pos = before.length + userName.length + 2
          inputRef.current.focus()
          inputRef.current.setSelectionRange(pos, pos)
        }
      }, 0)
    },
    [newMessage, mentionStartIndex]
  )

  const handleSend = useCallback(() => {
    if (!newMessage.trim()) return

    const mentionRegex = /@(\w+)/g
    const mentions: string[] = []
    let match
    while ((match = mentionRegex.exec(newMessage)) !== null) {
      const mentionedUser = users.find(
        (u) => u.name.toLowerCase() === match![1].toLowerCase()
      )
      if (mentionedUser) mentions.push(mentionedUser.id)
    }

    const msg: DiscussionMessage = {
      id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      channelId: selectedChannel,
      userId: currentUser?.id || '',
      content: newMessage.trim(),
      mentions,
      repliesTo: replyTo?.id,
      createdAt: new Date(),
    }

    // Save to API
    ;(async () => {
      try {
        const result = await api.createMessage(selectedChannel, {
          content: newMessage.trim(),
          mentions,
          repliesTo: replyTo?.id,
        })
        // Refresh messages from API
        const msgs = await api.getMessages(selectedChannel)
        setMessages(msgs)
      } catch (err) {
        console.error('Failed to send message:', err)
      }
    })()

    // Also add locally for immediate UI feedback
    addLocalMessage(msg)

    setNewMessage('')
    setReplyTo(null)
  }, [newMessage, users, currentUser, selectedChannel, addLocalMessage, api])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        if (showMentionDropdown && mentionResults.length > 0) {
          insertMention(mentionResults[0].name)
        } else {
          handleSend()
        }
      }
      if (e.key === 'Escape') {
        setShowMentionDropdown(false)
      }
    },
    [showMentionDropdown, mentionResults, insertMention, handleSend]
  )

  const getRepliedMessage = useCallback(
    (msg: DiscussionMessage): DiscussionMessage | undefined => {
      if (!msg.repliesTo) return undefined
      return messages.find((m) => m.id === msg.repliesTo)
    },
    [messages]
  )

  return (
    <div className="flex h-[calc(100vh-160px)] glass-card overflow-hidden">
      {/* Channel List */}
      <div className="w-[280px] border-r border-border flex flex-col bg-bg-charcoal">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-text-primary">Channels</h3>
            <span className="text-[11px] text-text-muted">{channels.length}</span>
          </div>
          <div className="input-field flex items-center gap-2 !px-3 !py-2">
            <Search className="w-3.5 h-3.5 text-text-muted" />
            <input
              type="text"
              placeholder="Search channels..."
              value={channelSearch}
              onChange={(e) => setChannelSearch(e.target.value)}
              className="bg-transparent border-none outline-none text-xs text-text-primary placeholder:text-text-muted w-full"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {filteredChannels.length === 0 && (
            <p className="text-xs text-text-muted text-center py-4">No channels found</p>
          )}
          {filteredChannels.map((channel) => (
            <button
              key={channel.id}
              onClick={() => handleChannelSelect(channel.id)}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-all group',
                selectedChannel === channel.id
                  ? 'bg-gold/10 text-gold'
                  : 'text-text-secondary hover:bg-white/[0.03] hover:text-text-primary'
              )}
            >
              <Hash className="w-4 h-4 flex-shrink-0 opacity-50" />
              <span className="text-sm font-medium truncate flex-1">{channel.name}</span>
              {channel.unreadCount > 0 && (
                <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-gold/20 text-gold text-[10px] font-bold flex items-center justify-center">
                  {channel.unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-bg-surface">
        {/* Channel Header */}
        <div className="h-[60px] flex items-center justify-between px-6 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <Hash className="w-5 h-5 text-text-muted" />
            <div>
              <h3 className="text-sm font-semibold text-text-primary">
                {activeChannel?.name || 'Select a channel'}
              </h3>
              <p className="text-[11px] text-text-muted">{activeChannel?.description}</p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-1">
          {channelMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-14 h-14 rounded-2xl bg-gold/10 flex items-center justify-center mb-4">
                <MessageSquare className="w-6 h-6 text-gold" />
              </div>
              <p className="text-sm text-text-primary font-medium mb-1">No messages yet</p>
              <p className="text-xs text-text-muted max-w-[260px]">
                Start the conversation in #{activeChannel?.name || 'this channel'}
              </p>
            </div>
          ) : (
            channelMessages.map((msg, idx) => {
              const author = getUserById(msg.userId)
              const repliedMsg = getRepliedMessage(msg)
              const showAuthor =
                idx === 0 || channelMessages[idx - 1].userId !== msg.userId

              return (
                <div key={msg.id} className="group">
                  {showAuthor && (
                    <div className="flex items-start gap-3 pt-3">
                      <div className="w-8 h-8 rounded-lg bg-gold/15 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-gold">
                          {author.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-semibold text-text-primary">
                            {author.name}
                          </span>
                          <span className="text-[10px] text-text-muted">
                            {formatMessageTime(msg.createdAt)}
                          </span>
                        </div>
                        {repliedMsg && (
                          <div className="flex items-center gap-1.5 mb-1 pl-2 border-l-2 border-gold/30">
                            <Reply className="w-3 h-3 text-text-muted rotate-180" />
                            <span className="text-[11px] text-text-muted truncate max-w-[400px]">
                              {getUserById(repliedMsg.userId).name}: {repliedMsg.content}
                            </span>
                          </div>
                        )}
                        <p className="text-sm text-text-secondary leading-relaxed break-words">
                          {msg.content.split(/(@\w+)/g).map((part, i) =>
                            part.startsWith('@') ? (
                              <span key={i} className="text-gold font-medium">
                                {part}
                              </span>
                            ) : (
                              part
                            )
                          )}
                        </p>
                      </div>
                    </div>
                  )}

                  {!showAuthor && (
                    <div className="flex items-start gap-3 py-0.5">
                      <div className="w-8 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        {repliedMsg && (
                          <div className="flex items-center gap-1.5 mb-1 pl-2 border-l-2 border-gold/30">
                            <Reply className="w-3 h-3 text-text-muted rotate-180" />
                            <span className="text-[11px] text-text-muted truncate max-w-[400px]">
                              {getUserById(repliedMsg.userId).name}: {repliedMsg.content}
                            </span>
                          </div>
                        )}
                        <p className="text-sm text-text-secondary leading-relaxed break-words">
                          {msg.content.split(/(@\w+)/g).map((part, i) =>
                            part.startsWith('@') ? (
                              <span key={i} className="text-gold font-medium">
                                {part}
                              </span>
                            ) : (
                              part
                            )
                          )}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Reply button on hover */}
                  <div className="flex items-center gap-1 ml-11 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setReplyTo(msg)}
                      className="p-1 rounded hover:bg-white/[0.05] text-text-muted hover:text-text-secondary transition-colors"
                      title="Reply"
                    >
                      <Reply className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <div className="p-4 border-t border-border flex-shrink-0 relative">
          {/* Reply preview */}
          {replyTo && (
            <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-white/[0.03] rounded-lg border-l-2 border-gold/40">
              <Reply className="w-3.5 h-3.5 text-gold rotate-180 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-[11px] text-gold font-medium">
                  {getUserById(replyTo.userId).name}
                </span>
                <span className="text-[11px] text-text-muted ml-2 truncate">
                  {replyTo.content}
                </span>
              </div>
              <button
                onClick={() => setReplyTo(null)}
                className="p-0.5 rounded hover:bg-white/[0.05] text-text-muted"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="flex items-center gap-3 bg-white/[0.03] border border-border rounded-xl px-4 py-3 focus-within:border-gold focus-within:shadow-[0_0_0_3px_rgba(212,175,55,0.1)] transition-all">
            <input
              ref={inputRef}
              type="text"
              placeholder={activeChannel ? `Message #${activeChannel.name}` : 'Select a channel...'}
              value={newMessage}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              disabled={!activeChannel}
              className="flex-1 bg-transparent border-none outline-none text-sm text-text-primary placeholder:text-text-muted disabled:opacity-40"
            />
            <button
              onClick={handleSend}
              disabled={!newMessage.trim() || !activeChannel}
              className={cn(
                'p-2 rounded-lg transition-all',
                newMessage.trim() && activeChannel
                  ? 'bg-gold text-bg-charcoal hover:bg-gold/80'
                  : 'text-text-muted cursor-not-allowed'
              )}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>

          {/* Mention Dropdown */}
          {showMentionDropdown && mentionResults.length > 0 && (
            <div
              ref={mentionDropdownRef}
              className="absolute bottom-full left-4 right-4 mb-2 bg-bg-charcoal border border-border rounded-xl shadow-2xl overflow-hidden z-50"
            >
              <div className="px-3 py-2 border-b border-border">
                <span className="text-[11px] text-text-muted font-medium">Mention a user</span>
              </div>
              <div className="max-h-[200px] overflow-y-auto p-1">
                {mentionResults.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => insertMention(user.name)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left hover:bg-white/[0.05] transition-colors"
                  >
                    <div className="w-7 h-7 rounded-lg bg-gold/15 flex items-center justify-center flex-shrink-0">
                      <span className="text-[11px] font-bold text-gold">
                        {user.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary">{user.name}</p>
                      <p className="text-[11px] text-text-muted">{user.role}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
