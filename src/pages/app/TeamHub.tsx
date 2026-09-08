import { useState, useMemo } from 'react'
import {
  Megaphone,
  Lightbulb,
  BarChart3,
  Trophy,
  Palette,
  Truck,
  AlertTriangle,
  BookOpen,
  MessageSquare,
  Plus,
  Search,
  X,
  Send,
  MoreHorizontal,
  Pencil,
  Trash2,
  Bookmark,
  BookmarkCheck,
  ChevronDown,
  ChevronUp,
  Link2,
} from 'lucide-react'
import { useAppState } from '@/stores/AppState'
import { cn } from '@/lib/utils'
import type { PostType, Post, PostComment, PostReaction } from '@/types'

const postTypeConfig: Record<PostType, { label: string; icon: typeof Megaphone; color: string; bgColor: string }> = {
  ANNOUNCEMENT: { label: 'Announcement', icon: Megaphone, color: 'text-gold', bgColor: 'bg-gold/10' },
  PRODUCT_IDEA: { label: 'Product Idea', icon: Lightbulb, color: 'text-warning', bgColor: 'bg-warning/10' },
  PRODUCT_ANALYSIS: { label: 'Analysis', icon: BarChart3, color: 'text-info', bgColor: 'bg-info/10' },
  WINNING_PRODUCT: { label: 'Winner', icon: Trophy, color: 'text-success', bgColor: 'bg-success/10' },
  MARKETING: { label: 'Marketing', icon: Megaphone, color: 'text-purple', bgColor: 'bg-purple/10' },
  CREATIVE: { label: 'Creative', icon: Palette, color: 'text-orange', bgColor: 'bg-orange/10' },
  SUPPLIER_INFO: { label: 'Supplier', icon: Truck, color: 'text-blue', bgColor: 'bg-blue/10' },
  WARNING: { label: 'Warning', icon: AlertTriangle, color: 'text-danger', bgColor: 'bg-danger/10' },
  KNOWLEDGE: { label: 'Knowledge', icon: BookOpen, color: 'text-info', bgColor: 'bg-info/10' },
  GENERAL: { label: 'General', icon: MessageSquare, color: 'text-text-muted', bgColor: 'bg-white/5' },
}

const filterOptions: { label: string; value: PostType | 'ALL' }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Announcements', value: 'ANNOUNCEMENT' },
  { label: 'Product Ideas', value: 'PRODUCT_IDEA' },
  { label: 'Analysis', value: 'PRODUCT_ANALYSIS' },
  { label: 'Winners', value: 'WINNING_PRODUCT' },
  { label: 'Marketing', value: 'MARKETING' },
  { label: 'Creative', value: 'CREATIVE' },
  { label: 'Suppliers', value: 'SUPPLIER_INFO' },
  { label: 'Warnings', value: 'WARNING' },
  { label: 'Knowledge', value: 'KNOWLEDGE' },
  { label: 'General', value: 'GENERAL' },
]

const reactionEmojis = ['👍', '❤️', '🔥', '🎯', '💡', '👏']

const allPostTypes = Object.keys(postTypeConfig) as PostType[]

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9)
}

function timeAgo(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 60) return 'just now'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7) return `${diffDay}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function TeamHub() {
  const { posts, addPost, updatePost, deletePost, users, currentUser, products, addActivityLog, addNotification } = useAppState()

  const [filter, setFilter] = useState<PostType | 'ALL'>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingPost, setEditingPost] = useState<Post | null>(null)

  // Comment states
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({})
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({})

  // Menu state
  const [openMenu, setOpenMenu] = useState<string | null>(null)

  const getUserById = (id: string) => users.find(u => u.id === id) || { id, name: 'Unknown User', initials: '??' }

  const sortedPosts = useMemo(() => {
    let filtered = filter === 'ALL' ? [...posts] : posts.filter(p => p.type === filter)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(p =>
        p.title.toLowerCase().includes(q) ||
        p.content.toLowerCase().includes(q)
      )
    }
    return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [posts, filter, searchQuery])

  const handleCreatePost = (data: {
    title: string
    content: string
    type: PostType
    links: string[]
    productId?: string
  }) => {
    if (!currentUser) return
    const newPost: Post = {
      id: uid(),
      userId: currentUser.id,
      type: data.type,
      title: data.title,
      content: data.content,
      links: data.links.length > 0 ? data.links : undefined,
      productId: data.productId || undefined,
      reactions: [],
      comments: [],
      bookmarks: [],
      createdAt: new Date(),
    }
    addPost(newPost)
    addActivityLog({
      id: uid(),
      action: 'POST_CREATED',
      userId: currentUser.id,
      entityType: 'POST',
      entityId: newPost.id,
      entityName: data.title,
      details: `Created a new ${postTypeConfig[data.type].label} post`,
      createdAt: new Date(),
    })
    addNotification({
      id: uid(),
      type: 'GENERAL',
      title: 'New Post',
      message: `${currentUser.name} created a new post: ${data.title}`,
      isRead: false,
      userId: currentUser.id,
      createdAt: new Date(),
    })
    setShowCreateModal(false)
  }

  const handleUpdatePost = (post: Post, data: { title: string; content: string; type: PostType }) => {
    updatePost({ ...post, title: data.title, content: data.content, type: data.type, updatedAt: new Date() })
    setEditingPost(null)
  }

  const handleDeletePost = (postId: string) => {
    if (!currentUser) return
    const post = posts.find(p => p.id === postId)
    if (!post || post.userId !== currentUser.id) return
    deletePost(postId)
    setOpenMenu(null)
  }

  const handleReaction = (post: Post, emoji: string) => {
    if (!currentUser) return
    const existing = post.reactions.find(r => r.emoji === emoji)
    let newReactions: PostReaction[]

    if (existing) {
      if (existing.users.includes(currentUser.id)) {
        const updatedUsers = existing.users.filter(u => u !== currentUser.id)
        if (updatedUsers.length === 0) {
          newReactions = post.reactions.filter(r => r.emoji !== emoji)
        } else {
          newReactions = post.reactions.map(r =>
            r.emoji === emoji ? { ...r, users: updatedUsers } : r
          )
        }
      } else {
        newReactions = post.reactions.map(r =>
          r.emoji === emoji ? { ...r, users: [...r.users, currentUser.id] } : r
        )
      }
    } else {
      newReactions = [...post.reactions, { emoji, users: [currentUser.id] }]
    }
    updatePost({ ...post, reactions: newReactions })
  }

  const handleBookmark = (post: Post) => {
    if (!currentUser) return
    const isBookmarked = post.bookmarks.includes(currentUser.id)
    const newBookmarks = isBookmarked
      ? post.bookmarks.filter(b => b !== currentUser.id)
      : [...post.bookmarks, currentUser.id]
    updatePost({ ...post, bookmarks: newBookmarks })
  }

  const handleAddComment = (postId: string) => {
    if (!currentUser) return
    const content = (commentInputs[postId] || '').trim()
    if (!content) return

    const post = posts.find(p => p.id === postId)
    if (!post) return

    const newComment: PostComment = {
      id: uid(),
      postId,
      userId: currentUser.id,
      content,
      mentions: [],
      createdAt: new Date(),
    }

    updatePost({ ...post, comments: [...post.comments, newComment] })
    setCommentInputs(prev => ({ ...prev, [postId]: '' }))

    addActivityLog({
      id: uid(),
      action: 'COMMENT_ADDED',
      userId: currentUser.id,
      entityType: 'POST',
      entityId: postId,
      entityName: post.title,
      details: `Commented on: ${post.title}`,
      createdAt: new Date(),
    })
    addNotification({
      id: uid(),
      type: 'COMMENT_ADDED',
      title: 'New Comment',
      message: `${currentUser.name} commented on: ${post.title}`,
      isRead: false,
      userId: post.userId,
      createdAt: new Date(),
    })
  }

  const toggleComments = (postId: string) => {
    setExpandedComments(prev => ({ ...prev, [postId]: !prev[postId] }))
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Team Hub</h1>
          <p className="text-sm text-text-muted mt-1">
            Share insights, ideas, and updates with the team.
            <span className="ml-2 text-gold font-medium">{posts.length} posts</span>
          </p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="btn-primary">
          <Plus className="w-4 h-4" />
          New Post
        </button>
      </div>

      {/* Search & Filter */}
      <div className="space-y-3">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              placeholder="Search posts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field pl-10 w-full"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'btn-secondary gap-2',
              showFilters && 'border-gold/30 text-gold'
            )}
          >
            Filters
            {showFilters ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
        {showFilters && (
          <div className="flex gap-2 flex-wrap">
            {filterOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setFilter(opt.value)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  filter === opt.value
                    ? 'bg-gold/15 text-gold border border-gold/20'
                    : 'bg-white/[0.03] text-text-muted border border-border hover:border-border-light'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Posts Feed */}
      {sortedPosts.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <MessageSquare className="w-12 h-12 text-text-muted mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-text-primary mb-2">No posts yet</h3>
          <p className="text-sm text-text-muted mb-6">
            {filter !== 'ALL' ? 'No posts match this filter.' : 'Be the first to share something with the team.'}
          </p>
          {filter === 'ALL' && (
            <button onClick={() => setShowCreateModal(true)} className="btn-primary">
              <Plus className="w-4 h-4" />
              Create First Post
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {sortedPosts.map((post) => {
            const config = postTypeConfig[post.type]
            const Icon = config.icon
            const author = getUserById(post.userId)
            const isOwn = currentUser?.id === post.userId
            const isBookmarked = currentUser ? post.bookmarks.includes(currentUser.id) : false
            const showComments = expandedComments[post.id]

            return (
              <div key={post.id} className="glass-card p-6">
                {/* Post Header */}
                <div className="flex items-start gap-3 mb-4">
                  <div className="avatar">
                    <span className="text-sm">{author.name.charAt(0)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-text-primary">{author.name}</span>
                      <span className={cn('badge text-[9px]', config.bgColor, config.color)}>
                        <Icon className="w-3 h-3 mr-1" />
                        {config.label}
                      </span>
                    </div>
                    <p className="text-[11px] text-text-muted mt-0.5">
                      {timeAgo(new Date(post.createdAt))}
                      {post.updatedAt && <span className="ml-1">(edited)</span>}
                    </p>
                  </div>
                  {isOwn && (
                    <div className="relative">
                      <button
                        onClick={() => setOpenMenu(openMenu === post.id ? null : post.id)}
                        className="p-1.5 rounded-lg hover:bg-white/[0.05] text-text-muted hover:text-text-secondary transition-colors"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                      {openMenu === post.id && (
                        <div className="absolute right-0 top-8 z-10 w-36 rounded-xl bg-surface border border-border shadow-xl py-1">
                          <button
                            onClick={() => { setEditingPost(post); setOpenMenu(null) }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-secondary hover:text-text-primary hover:bg-white/[0.05] transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            Edit Post
                          </button>
                          <button
                            onClick={() => handleDeletePost(post.id)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-danger hover:bg-danger/10 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete Post
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Post Content */}
                <h3 className="text-base font-semibold text-text-primary mb-2">{post.title}</h3>
                <p className="text-sm text-text-secondary leading-relaxed mb-3 whitespace-pre-wrap">{post.content}</p>

                {/* Links */}
                {post.links && post.links.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {post.links.map((link, i) => (
                      <a
                        key={i}
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gold/5 text-gold text-xs border border-gold/10 hover:bg-gold/10 transition-colors"
                      >
                        <Link2 className="w-3 h-3" />
                        {new URL(link).hostname}
                      </a>
                    ))}
                  </div>
                )}

                {/* Reactions + Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-border">
                  <div className="flex items-center gap-2 flex-wrap">
                    {post.reactions.map((reaction) => {
                      const isActive = currentUser ? reaction.users.includes(currentUser.id) : false
                      return (
                        <button
                          key={reaction.emoji}
                          onClick={() => handleReaction(post, reaction.emoji)}
                          className={cn(
                            'flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-all',
                            isActive
                              ? 'bg-gold/15 border border-gold/25 text-gold'
                              : 'bg-white/[0.03] border border-border hover:border-border-light text-text-muted'
                          )}
                        >
                          <span>{reaction.emoji}</span>
                          <span>{reaction.users.length}</span>
                        </button>
                      )
                    })}
                    <div className="group relative">
                      <button className="p-1.5 rounded-lg hover:bg-white/[0.05] transition-colors text-text-muted hover:text-gold">
                        <Plus className="w-4 h-4" />
                      </button>
                      <div className="absolute left-0 top-full mt-1 z-10 hidden group-hover:flex gap-1 p-2 rounded-xl bg-surface border border-border shadow-xl">
                        {reactionEmojis.map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => handleReaction(post, emoji)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/[0.05] transition-colors text-lg"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleComments(post.id)}
                      className={cn(
                        'flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs transition-colors',
                        showComments ? 'text-gold bg-gold/10' : 'text-text-muted hover:text-text-secondary hover:bg-white/[0.05]'
                      )}
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      {post.comments.length}
                    </button>
                    <button
                      onClick={() => handleBookmark(post)}
                      className={cn(
                        'p-1.5 rounded-lg transition-colors',
                        isBookmarked ? 'text-gold' : 'text-text-muted hover:text-text-secondary hover:bg-white/[0.05]'
                      )}
                    >
                      {isBookmarked ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Comments Section */}
                {showComments && (
                  <div className="mt-4 space-y-3 border-t border-border pt-4">
                    {post.comments.map((comment) => {
                      const commenter = getUserById(comment.userId)
                      return (
                        <div key={comment.id} className="flex items-start gap-2 p-3 rounded-lg bg-white/[0.02] border border-border/50">
                          <div className="avatar avatar-sm flex-shrink-0">
                            <span className="text-[10px]">{commenter.name.charAt(0)}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-text-primary">{commenter.name}</span>
                              <span className="text-[10px] text-text-muted">{timeAgo(new Date(comment.createdAt))}</span>
                            </div>
                            <p className="text-xs text-text-secondary mt-1 whitespace-pre-wrap">{comment.content}</p>
                          </div>
                        </div>
                      )
                    })}

                    {/* Comment Input */}
                    <div className="flex items-start gap-2">
                      <div className="avatar avatar-sm flex-shrink-0">
                        <span className="text-[10px]">{currentUser?.name.charAt(0) || '?'}</span>
                      </div>
                      <div className="flex-1 relative">
                        <input
                          type="text"
                          placeholder="Write a comment..."
                          value={commentInputs[post.id] || ''}
                          onChange={(e) => setCommentInputs(prev => ({ ...prev, [post.id]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault()
                              handleAddComment(post.id)
                            }
                          }}
                          className="input-field w-full pr-10 text-xs"
                        />
                        <button
                          onClick={() => handleAddComment(post.id)}
                          disabled={!(commentInputs[post.id] || '').trim()}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-lg text-gold hover:bg-gold/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Create/Edit Post Modal */}
      {(showCreateModal || editingPost) && (
        <PostModal
          post={editingPost}
          products={products}
          onClose={() => { setShowCreateModal(false); setEditingPost(null) }}
          onSubmit={editingPost
            ? (data) => handleUpdatePost(editingPost, data)
            : handleCreatePost
          }
        />
      )}
    </div>
  )
}

function PostModal({
  post,
  products,
  onClose,
  onSubmit,
}: {
  post: Post | null
  products: { id: string; name: string }[]
  onClose: () => void
  onSubmit: (data: { title: string; content: string; type: PostType; links: string[]; productId?: string }) => void
}) {
  const [title, setTitle] = useState(post?.title || '')
  const [content, setContent] = useState(post?.content || '')
  const [type, setType] = useState<PostType>(post?.type || 'GENERAL')
  const [links, setLinks] = useState<string[]>(post?.links || [])
  const [linkInput, setLinkInput] = useState('')
  const [productId, setProductId] = useState(post?.productId || '')

  const isEditing = !!post

  const handleSubmit = () => {
    if (!title.trim() || !content.trim()) return
    onSubmit({
      title: title.trim(),
      content: content.trim(),
      type,
      links: links.filter(l => l.trim()),
      productId: productId || undefined,
    })
  }

  const addLink = () => {
    const trimmed = linkInput.trim()
    if (!trimmed) return
    try {
      new URL(trimmed)
      setLinks(prev => [...prev, trimmed])
      setLinkInput('')
    } catch {
      setLinks(prev => [...prev, trimmed])
      setLinkInput('')
    }
  }

  const removeLink = (index: number) => {
    setLinks(prev => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg mx-4 rounded-2xl bg-surface border border-border shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-lg font-bold text-text-primary">{isEditing ? 'Edit Post' : 'Create Post'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/[0.05] text-text-muted hover:text-text-secondary transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          {/* Post Type */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-2">Post Type</label>
            <div className="grid grid-cols-5 gap-1.5">
              {allPostTypes.map((pt) => {
                const cfg = postTypeConfig[pt]
                const TypeIcon = cfg.icon
                return (
                  <button
                    key={pt}
                    onClick={() => setType(pt)}
                    className={cn(
                      'flex flex-col items-center gap-1 p-2 rounded-lg text-[10px] font-medium transition-all border',
                      type === pt
                        ? `${cfg.bgColor} ${cfg.color} border-current`
                        : 'bg-white/[0.02] text-text-muted border-border hover:border-border-light'
                    )}
                  >
                    <TypeIcon className="w-3.5 h-3.5" />
                    {cfg.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-2">Title</label>
            <input
              type="text"
              placeholder="Enter post title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input-field w-full"
              maxLength={120}
            />
            <p className="text-[10px] text-text-muted mt-1 text-right">{title.length}/120</p>
          </div>

          {/* Content */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-2">Content</label>
            <textarea
              placeholder="Write your post content..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="textarea-field w-full min-h-[120px] resize-y"
              rows={5}
            />
          </div>

          {/* Product Association */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-2">
              Link to Product <span className="text-text-muted">(optional)</span>
            </label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="select-field w-full"
            >
              <option value="">No product</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Links */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-2">
              Attach Links <span className="text-text-muted">(optional)</span>
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                placeholder="https://..."
                value={linkInput}
                onChange={(e) => setLinkInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink() } }}
                className="input-field flex-1"
              />
              <button onClick={addLink} className="btn-secondary px-3">
                <Link2 className="w-4 h-4" />
              </button>
            </div>
            {links.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {links.map((link, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gold/5 text-gold text-xs border border-gold/10">
                    <Link2 className="w-3 h-3" />
                    {link}
                    <button onClick={() => removeLink(i)} className="hover:text-danger transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 p-5 border-t border-border">
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim() || !content.trim()}
            className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isEditing ? 'Save Changes' : 'Publish Post'}
          </button>
        </div>
      </div>
    </div>
  )
}
