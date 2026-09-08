import { useState, useMemo, useCallback, useRef } from 'react'
import {
  Plus,
  LayoutGrid,
  List,
  Calendar,
  CheckSquare,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  History,
  Trash2,
  Edit3,
  User,
  Send,
  AlertTriangle,
  Filter,
} from 'lucide-react'
import { useAppState } from '@/stores/AppState'
import { cn } from '@/lib/utils'
import type { Task, TaskStatus, TaskPriority, TaskComment } from '@/types'

const statusConfig: Record<TaskStatus, { label: string; color: string; bgColor: string; dotColor: string }> = {
  TODO: { label: 'To Do', color: 'text-text-muted', bgColor: 'bg-text-muted/15', dotColor: 'bg-text-muted' },
  IN_PROGRESS: { label: 'In Progress', color: 'text-info', bgColor: 'bg-info/12', dotColor: 'bg-info' },
  REVIEW: { label: 'Review', color: 'text-warning', bgColor: 'bg-warning/12', dotColor: 'bg-warning' },
  DONE: { label: 'Done', color: 'text-success', bgColor: 'bg-success/12', dotColor: 'bg-success' },
}

const priorityConfig: Record<TaskPriority, { label: string; color: string; bgColor: string; borderClass: string }> = {
  LOW: { label: 'Low', color: 'text-text-muted', bgColor: 'bg-text-muted/15', borderClass: 'priority-low' },
  MEDIUM: { label: 'Medium', color: 'text-warning', bgColor: 'bg-warning/12', borderClass: 'priority-medium' },
  HIGH: { label: 'High', color: 'text-orange', bgColor: 'bg-orange/12', borderClass: 'priority-high' },
  URGENT: { label: 'Urgent', color: 'text-danger', bgColor: 'bg-danger/12', borderClass: 'priority-urgent' },
}

const statusColumns: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE']

type ViewMode = 'kanban' | 'list' | 'my-tasks' | 'calendar'

interface TaskFormData {
  title: string
  description: string
  assigneeId: string
  priority: TaskPriority
  status: TaskStatus
  dueDate: string
  tags: string
  productId: string
}

const emptyForm: TaskFormData = {
  title: '',
  description: '',
  assigneeId: '',
  priority: 'MEDIUM',
  status: 'TODO',
  dueDate: '',
  tags: '',
  productId: '',
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9)
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay()
}

export function Tasks() {
  const {
    tasks, addTask, updateTask, deleteTask,
    addTaskComment, addTaskActivity,
    users: teamUsers, currentUser, products,
    addActivityLog, addNotification,
  } = useAppState()

  const [view, setView] = useState<ViewMode>('kanban')
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'ALL'>('ALL')
  const [filterPriority, setFilterPriority] = useState<TaskPriority | 'ALL'>('ALL')
  const [filterAssignee, setFilterAssignee] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [deletingTask, setDeletingTask] = useState<Task | null>(null)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [taskDetailTab, setTaskDetailTab] = useState<'details' | 'comments' | 'activity'>('details')
  const [commentText, setCommentText] = useState('')
  const [formData, setFormData] = useState<TaskFormData>(emptyForm)
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth())
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear())
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const commentInputRef = useRef<HTMLInputElement>(null)

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }, [])

  const getUserById = useCallback((id: string) => teamUsers.find(u => u.id === id), [teamUsers])
  const getProductById = useCallback((id: string) => products.find(p => p.id === id), [products])

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      if (filterStatus !== 'ALL' && task.status !== filterStatus) return false
      if (filterPriority !== 'ALL' && task.priority !== filterPriority) return false
      if (filterAssignee !== 'ALL' && task.assigneeId !== filterAssignee) return false
      if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) return false
      return true
    })
  }, [tasks, filterStatus, filterPriority, filterAssignee, searchQuery])

  const myTasks = useMemo(() => {
    if (!currentUser) return []
    return tasks.filter(t => t.assigneeId === currentUser.id)
  }, [tasks, currentUser])

  const taskCounts = useMemo(() => ({
    total: tasks.length,
    TODO: tasks.filter(t => t.status === 'TODO').length,
    IN_PROGRESS: tasks.filter(t => t.status === 'IN_PROGRESS').length,
    REVIEW: tasks.filter(t => t.status === 'REVIEW').length,
    DONE: tasks.filter(t => t.status === 'DONE').length,
  }), [tasks])

  const openCreateModal = useCallback(() => {
    setFormData({
      ...emptyForm,
      assigneeId: currentUser?.id || '',
    })
    setEditingTask(null)
    setShowCreateModal(true)
  }, [currentUser])

  const openEditModal = useCallback((task: Task) => {
    setFormData({
      title: task.title,
      description: task.description,
      assigneeId: task.assigneeId,
      priority: task.priority,
      status: task.status,
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
      tags: task.tags.join(', '),
      productId: task.productId || '',
    })
    setEditingTask(task)
    setShowCreateModal(true)
    setSelectedTask(null)
  }, [])

  const handleFormChange = useCallback((field: keyof TaskFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }, [])

  const handleSaveTask = useCallback(() => {
    if (!formData.title.trim()) {
      showToast('Title is required', 'error')
      return
    }
    if (!formData.assigneeId) {
      showToast('Assignee is required', 'error')
      return
    }

    const now = new Date()
    const tags = formData.tags.split(',').map(t => t.trim()).filter(Boolean)

    if (editingTask) {
      const updated: Task = {
        ...editingTask,
        title: formData.title.trim(),
        description: formData.description.trim(),
        assigneeId: formData.assigneeId,
        priority: formData.priority,
        status: formData.status,
        dueDate: formData.dueDate ? new Date(formData.dueDate) : undefined,
        tags,
        productId: formData.productId || undefined,
        updatedAt: now,
      }
      updateTask(updated)

      addTaskActivity(editingTask.id, {
        id: generateId(),
        taskId: editingTask.id,
        userId: currentUser?.id || '',
        action: 'updated',
        details: `Task edited by ${currentUser?.name || 'Unknown'}`,
        createdAt: now,
      })

      if (editingTask.status !== updated.status) {
        addTaskActivity(editingTask.id, {
          id: generateId(),
          taskId: editingTask.id,
          userId: currentUser?.id || '',
          action: 'status_changed',
          details: `Status changed from ${statusConfig[editingTask.status].label} to ${statusConfig[updated.status].label}`,
          createdAt: now,
        })
      }

      addActivityLog({
        id: generateId(),
        action: 'STATUS_CHANGED',
        userId: currentUser?.id || '',
        entityType: 'TASK',
        entityId: editingTask.id,
        entityName: updated.title,
        details: `Task updated`,
        createdAt: now,
      })

      showToast('Task updated successfully')
    } else {
      const newTask: Task = {
        id: generateId(),
        title: formData.title.trim(),
        description: formData.description.trim(),
        assigneeId: formData.assigneeId,
        creatorId: currentUser?.id || '',
        priority: formData.priority,
        status: formData.status,
        dueDate: formData.dueDate ? new Date(formData.dueDate) : undefined,
        tags,
        productId: formData.productId || undefined,
        attachments: [],
        comments: [],
        activity: [{
          id: generateId(),
          taskId: '',
          userId: currentUser?.id || '',
          action: 'created',
          details: `Task created by ${currentUser?.name || 'Unknown'}`,
          createdAt: now,
        }],
        createdAt: now,
        updatedAt: now,
      }
      addTask(newTask)

      if (formData.assigneeId !== currentUser?.id) {
        addNotification({
          id: generateId(),
          type: 'TASK_ASSIGNED',
          title: 'New Task Assigned',
          message: `You have been assigned "${newTask.title}" by ${currentUser?.name || 'Unknown'}`,
          isRead: false,
          userId: formData.assigneeId,
          createdAt: now,
        })
      }

      addActivityLog({
        id: generateId(),
        action: 'TASK_CREATED',
        userId: currentUser?.id || '',
        entityType: 'TASK',
        entityId: newTask.id,
        entityName: newTask.title,
        details: `Task created and assigned to ${getUserById(newTask.assigneeId)?.name || 'Unknown'}`,
        createdAt: now,
      })

      showToast('Task created successfully')
    }

    setShowCreateModal(false)
    setEditingTask(null)
    setFormData(emptyForm)
  }, [formData, editingTask, currentUser, updateTask, addTask, addTaskActivity, addActivityLog, addNotification, getUserById, showToast])

  const handleDeleteTask = useCallback(() => {
    if (!deletingTask) return
    const taskTitle = deletingTask.title
    deleteTask(deletingTask.id)

    addActivityLog({
      id: generateId(),
      action: 'TASK_COMPLETED',
      userId: currentUser?.id || '',
      entityType: 'TASK',
      entityId: deletingTask.id,
      entityName: taskTitle,
      details: `Task deleted by ${currentUser?.name || 'Unknown'}`,
      createdAt: new Date(),
    })

    setDeletingTask(null)
    setSelectedTask(null)
    showToast('Task deleted')
  }, [deletingTask, deleteTask, currentUser, addActivityLog, showToast])

  const handleStatusChange = useCallback((taskId: string, newStatus: TaskStatus) => {
    const task = tasks.find(t => t.id === taskId)
    if (!task || task.status === newStatus) return

    const now = new Date()
    const updated = { ...task, status: newStatus, updatedAt: now }
    updateTask(updated)

    addTaskActivity(taskId, {
      id: generateId(),
      taskId,
      userId: currentUser?.id || '',
      action: 'status_changed',
      details: `Status changed from ${statusConfig[task.status].label} to ${statusConfig[newStatus].label}`,
      createdAt: now,
    })

    if (newStatus === 'DONE') {
      addActivityLog({
        id: generateId(),
        action: 'TASK_COMPLETED',
        userId: currentUser?.id || '',
        entityType: 'TASK',
        entityId: taskId,
        entityName: task.title,
        details: `Task completed`,
        createdAt: now,
      })
    }

    setSelectedTask(prev => prev?.id === taskId ? updated : prev)
  }, [tasks, updateTask, currentUser, addTaskActivity, addActivityLog])

  const handleDragStart = useCallback((e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', taskId)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverColumn(status)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragOverColumn(null)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent, targetStatus: TaskStatus) => {
    e.preventDefault()
    const taskId = e.dataTransfer.getData('text/plain')
    if (taskId) {
      handleStatusChange(taskId, targetStatus)
    }
    setDraggedTaskId(null)
    setDragOverColumn(null)
  }, [handleStatusChange])

  const handleAddComment = useCallback(() => {
    if (!selectedTask || !commentText.trim() || !currentUser) return

    const comment: TaskComment = {
      id: generateId(),
      taskId: selectedTask.id,
      userId: currentUser.id,
      content: commentText.trim(),
      createdAt: new Date(),
    }

    addTaskComment(selectedTask.id, comment)
    addTaskActivity(selectedTask.id, {
      id: generateId(),
      taskId: selectedTask.id,
      userId: currentUser.id,
      action: 'commented',
      details: commentText.trim(),
      createdAt: new Date(),
    })

    setSelectedTask(prev => {
      if (!prev) return null
      return {
        ...prev,
        comments: [...prev.comments, comment],
      }
    })

    setCommentText('')
    showToast('Comment added')
  }, [selectedTask, commentText, currentUser, addTaskComment, addTaskActivity, showToast])

  const calendarDays = useMemo(() => {
    const daysInMonth = getDaysInMonth(calendarYear, calendarMonth)
    const firstDay = getFirstDayOfMonth(calendarYear, calendarMonth)
    const days: (number | null)[] = []
    for (let i = 0; i < firstDay; i++) days.push(null)
    for (let i = 1; i <= daysInMonth; i++) days.push(i)
    return days
  }, [calendarYear, calendarMonth])

  const tasksByDate = useMemo(() => {
    const map: Record<string, Task[]> = {}
    filteredTasks.forEach(task => {
      if (task.dueDate) {
        const d = new Date(task.dueDate)
        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
        if (!map[key]) map[key] = []
        map[key].push(task)
      }
    })
    return map
  }, [filteredTasks])

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

  const renderEmptyState = () => (
    <div className="empty-state">
      <div className="empty-state-icon">
        <CheckSquare className="w-8 h-8" />
      </div>
      <h3 className="text-lg font-semibold text-text-primary mb-2">No tasks found</h3>
      <p className="text-sm text-text-muted mb-6 max-w-sm">
        {tasks.length === 0
          ? 'Create your first task to get started with task management.'
          : 'Try adjusting your filters or search query.'}
      </p>
      {tasks.length === 0 && (
        <button className="btn-primary" onClick={openCreateModal}>
          <Plus className="w-4 h-4" />
          Create Task
        </button>
      )}
    </div>
  )

  const renderKanbanCard = (task: Task) => {
    const assignee = getUserById(task.assigneeId)
    const priority = priorityConfig[task.priority]
    const product = task.productId ? getProductById(task.productId) : null
    return (
      <div
        key={task.id}
        draggable
        onDragStart={(e) => handleDragStart(e, task.id)}
        onDragEnd={() => { setDraggedTaskId(null); setDragOverColumn(null) }}
        className={cn(
          'kanban-card',
          priority.borderClass,
          draggedTaskId === task.id && 'opacity-50'
        )}
        onClick={() => { setSelectedTask(task); setTaskDetailTab('details') }}
      >
        <div className="flex items-start justify-between mb-2">
          <span className={cn('badge text-[9px]', priority.bgColor, priority.color)}>
            {priority.label}
          </span>
          <button
            className="p-1 rounded hover:bg-white/[0.05] text-text-muted"
            onClick={(e) => { e.stopPropagation(); openEditModal(task) }}
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
        </div>
        <h4 className="text-sm font-medium mb-2 text-text-primary">{task.title}</h4>
        {task.description && (
          <p className="text-[11px] text-text-muted mb-2 line-clamp-2">{task.description}</p>
        )}
        {product && (
          <p className="text-[11px] text-gold mb-2 truncate">Product: {product.name}</p>
        )}
        {task.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {task.tags.slice(0, 3).map(tag => (
              <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.05] text-text-muted">
                {tag}
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between mt-3 pt-2 border-t border-border">
          <div className="flex items-center gap-2">
            <div className="avatar avatar-sm">
              <span>{assignee?.name?.charAt(0) || '?'}</span>
            </div>
            <span className="text-[11px] text-text-muted">{assignee?.name || 'Unassigned'}</span>
          </div>
          <div className="flex items-center gap-2">
            {task.comments.length > 0 && (
              <span className="text-[10px] text-text-muted flex items-center gap-0.5">
                <MessageSquare className="w-3 h-3" />
                {task.comments.length}
              </span>
            )}
            {task.dueDate && (
              <span className="text-[10px] text-text-muted flex items-center gap-0.5">
                <Calendar className="w-3 h-3" />
                {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            )}
          </div>
        </div>
      </div>
    )
  }

  const renderKanbanView = () => (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {statusColumns.map((status) => {
        const columnTasks = filteredTasks.filter(t => t.status === status)
        const config = statusConfig[status]
        return (
          <div
            key={status}
            className={cn(
              'kanban-column flex-shrink-0 w-[300px]',
              dragOverColumn === status && 'border-gold/40 bg-gold/[0.03]'
            )}
            onDragOver={(e) => handleDragOver(e, status)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, status)}
          >
            <div className="kanban-column-header">
              <div className="flex items-center gap-2">
                <div className={cn('w-2.5 h-2.5 rounded-full', config.dotColor)} />
                <span className="text-sm font-semibold text-text-primary">{config.label}</span>
                <span className="text-xs text-text-muted bg-white/[0.05] px-2 py-0.5 rounded-full">
                  {columnTasks.length}
                </span>
              </div>
            </div>
            <div className="p-2 space-y-0 min-h-[200px]">
              {columnTasks.length === 0 ? (
                <div className="text-center py-8 text-text-muted text-xs">
                  Drop tasks here
                </div>
              ) : (
                columnTasks.map(renderKanbanCard)
              )}
            </div>
          </div>
        )
      })}
    </div>
  )

  const renderListView = () => (
    <div className="glass-card overflow-hidden">
      <table className="data-table">
        <thead>
          <tr>
            <th>Task</th>
            <th>Assignee</th>
            <th>Priority</th>
            <th>Status</th>
            <th>Due Date</th>
            <th>Product</th>
            <th className="w-12"></th>
          </tr>
        </thead>
        <tbody>
          {filteredTasks.map((task) => {
            const assignee = getUserById(task.assigneeId)
            const priority = priorityConfig[task.priority]
            const status = statusConfig[task.status]
            const product = task.productId ? getProductById(task.productId) : null
            return (
              <tr
                key={task.id}
                className="cursor-pointer"
                onClick={() => { setSelectedTask(task); setTaskDetailTab('details') }}
              >
                <td>
                  <div className="flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-text-muted flex-shrink-0" />
                    <div className="min-w-0">
                      <span className="font-medium text-text-primary block truncate">{task.title}</span>
                      {task.description && (
                        <span className="text-[11px] text-text-muted block truncate">{task.description}</span>
                      )}
                    </div>
                  </div>
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    <div className="avatar avatar-sm">
                      <span>{assignee?.name?.charAt(0) || '?'}</span>
                    </div>
                    <span className="text-xs">{assignee?.name || 'Unassigned'}</span>
                  </div>
                </td>
                <td>
                  <span className={cn('badge text-[9px]', priority.bgColor, priority.color)}>
                    {priority.label}
                  </span>
                </td>
                <td>
                  <span className={cn('status-badge text-[9px]', `status-${task.status.toLowerCase()}`)}>
                    {status.label}
                  </span>
                </td>
                <td>
                  <span className="text-xs text-text-muted">
                    {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '-'}
                  </span>
                </td>
                <td>
                  {product ? (
                    <span className="text-xs text-gold">{product.name}</span>
                  ) : (
                    <span className="text-xs text-text-muted">-</span>
                  )}
                </td>
                <td>
                  <button
                    className="p-1 rounded hover:bg-white/[0.05] text-text-muted"
                    onClick={(e) => { e.stopPropagation(); openEditModal(task) }}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {filteredTasks.length === 0 && renderEmptyState()}
    </div>
  )

  const renderMyTasksView = () => {
    const myFilteredTasks = myTasks.filter(t => {
      if (filterStatus !== 'ALL' && t.status !== filterStatus) return false
      if (filterPriority !== 'ALL' && t.priority !== filterPriority) return false
      if (searchQuery && !t.title.toLowerCase().includes(searchQuery.toLowerCase())) return false
      return true
    })

    if (myFilteredTasks.length === 0) {
      return renderEmptyState()
    }

    return (
      <div className="space-y-3">
        {statusColumns.map(status => {
          const statusTasks = myFilteredTasks.filter(t => t.status === status)
          if (statusTasks.length === 0) return null
          const config = statusConfig[status]
          return (
            <div key={status} className="glass-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className={cn('w-2.5 h-2.5 rounded-full', config.dotColor)} />
                <span className="text-sm font-semibold text-text-primary">{config.label}</span>
                <span className="text-xs text-text-muted">({statusTasks.length})</span>
              </div>
              <div className="space-y-2">
                {statusTasks.map(task => {
                  const priority = priorityConfig[task.priority]
                  const product = task.productId ? getProductById(task.productId) : null
                  return (
                    <div
                      key={task.id}
                      className={cn('kanban-card', priority.borderClass)}
                      onClick={() => { setSelectedTask(task); setTaskDetailTab('details') }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <span className={cn('badge text-[9px] flex-shrink-0', priority.bgColor, priority.color)}>
                            {priority.label}
                          </span>
                          <div className="min-w-0 flex-1">
                            <h4 className="text-sm font-medium text-text-primary truncate">{task.title}</h4>
                            {product && (
                              <p className="text-[11px] text-gold truncate">Product: {product.name}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {task.status !== 'DONE' && (
                            <select
                              className="select-field text-[10px] py-1 px-2 w-auto"
                              value={task.status}
                              onClick={e => e.stopPropagation()}
                              onChange={e => { e.stopPropagation(); handleStatusChange(task.id, e.target.value as TaskStatus) }}
                            >
                              {statusColumns.map(s => (
                                <option key={s} value={s}>{statusConfig[s].label}</option>
                              ))}
                            </select>
                          )}
                          {task.dueDate && (
                            <span className="text-[10px] text-text-muted flex items-center gap-0.5">
                              <Calendar className="w-3 h-3" />
                              {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const renderCalendarView = () => (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-6">
        <button
          className="btn-ghost"
          onClick={() => {
            if (calendarMonth === 0) { setCalendarMonth(11); setCalendarYear(y => y - 1) }
            else setCalendarMonth(m => m - 1)
          }}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <h3 className="text-lg font-semibold text-text-primary">
          {monthNames[calendarMonth]} {calendarYear}
        </h3>
        <button
          className="btn-ghost"
          onClick={() => {
            if (calendarMonth === 11) { setCalendarMonth(0); setCalendarYear(y => y + 1) }
            else setCalendarMonth(m => m + 1)
          }}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-center text-[11px] font-semibold text-text-muted py-2">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day, idx) => {
          if (day === null) return <div key={`empty-${idx}`} />
          const key = `${calendarYear}-${calendarMonth}-${day}`
          const dayTasks = tasksByDate[key] || []
          const isToday = new Date().getDate() === day && new Date().getMonth() === calendarMonth && new Date().getFullYear() === calendarYear
          return (
            <div
              key={key}
              className={cn(
                'min-h-[80px] p-1.5 rounded-lg border border-border/50 transition-colors',
                isToday && 'border-gold/30 bg-gold/[0.03]',
                dayTasks.length > 0 && 'hover:border-border-light'
              )}
            >
              <div className={cn(
                'text-xs font-medium mb-1',
                isToday ? 'text-gold' : 'text-text-muted'
              )}>
                {day}
              </div>
              <div className="space-y-0.5">
                {dayTasks.slice(0, 3).map(task => {
                  const p = priorityConfig[task.priority]
                  return (
                    <div
                      key={task.id}
                      className={cn(
                        'text-[9px] px-1.5 py-0.5 rounded truncate cursor-pointer',
                        p.bgColor, p.color
                      )}
                      onClick={() => { setSelectedTask(task); setTaskDetailTab('details') }}
                      title={task.title}
                    >
                      {task.title}
                    </div>
                  )
                })}
                {dayTasks.length > 3 && (
                  <div className="text-[9px] text-text-muted text-center">+{dayTasks.length - 3}</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )

  const renderCreateModal = () => (
    <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-text-primary">
            {editingTask ? 'Edit Task' : 'Create New Task'}
          </h2>
          <button
            className="p-2 rounded-lg hover:bg-white/[0.05] text-text-muted transition-colors"
            onClick={() => { setShowCreateModal(false); setEditingTask(null) }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Title *</label>
            <input
              type="text"
              className="input-field"
              placeholder="Enter task title..."
              value={formData.title}
              onChange={e => handleFormChange('title', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Description</label>
            <textarea
              className="textarea-field"
              placeholder="Describe the task..."
              rows={3}
              value={formData.description}
              onChange={e => handleFormChange('description', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Assignee *</label>
              <select
                className="select-field"
                value={formData.assigneeId}
                onChange={e => handleFormChange('assigneeId', e.target.value)}
              >
                <option value="">Select assignee...</option>
                {teamUsers.map(user => (
                  <option key={user.id} value={user.id}>{user.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Priority</label>
              <select
                className="select-field"
                value={formData.priority}
                onChange={e => handleFormChange('priority', e.target.value)}
              >
                {Object.entries(priorityConfig).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Status</label>
              <select
                className="select-field"
                value={formData.status}
                onChange={e => handleFormChange('status', e.target.value)}
              >
                {Object.entries(statusConfig).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Due Date</label>
              <input
                type="date"
                className="input-field"
                value={formData.dueDate}
                onChange={e => handleFormChange('dueDate', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Product</label>
              <select
                className="select-field"
                value={formData.productId}
                onChange={e => handleFormChange('productId', e.target.value)}
              >
                <option value="">No product</option>
                {products.map(product => (
                  <option key={product.id} value={product.id}>{product.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Tags</label>
              <input
                type="text"
                className="input-field"
                placeholder="Comma-separated tags..."
                value={formData.tags}
                onChange={e => handleFormChange('tags', e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border">
          <button
            className="btn-secondary"
            onClick={() => { setShowCreateModal(false); setEditingTask(null) }}
          >
            Cancel
          </button>
          <button className="btn-primary" onClick={handleSaveTask}>
            {editingTask ? 'Update Task' : 'Create Task'}
          </button>
        </div>
      </div>
    </div>
  )

  const renderDeleteConfirm = () => {
    if (!deletingTask) return null
    return (
      <div className="modal-overlay" onClick={() => setDeletingTask(null)}>
        <div className="modal-content max-w-sm" onClick={e => e.stopPropagation()}>
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-danger/12 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6 text-danger" />
            </div>
            <h3 className="text-lg font-semibold text-text-primary mb-2">Delete Task</h3>
            <p className="text-sm text-text-muted mb-6">
              Are you sure you want to delete <span className="text-text-primary font-medium">"{deletingTask.title}"</span>? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-center">
              <button className="btn-secondary" onClick={() => setDeletingTask(null)}>
                Cancel
              </button>
              <button className="btn-danger" onClick={handleDeleteTask}>
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderTaskDetail = () => {
    if (!selectedTask) return null
    const assignee = getUserById(selectedTask.assigneeId)
    const creator = getUserById(selectedTask.creatorId)
    const product = selectedTask.productId ? getProductById(selectedTask.productId) : null
    const priority = priorityConfig[selectedTask.priority]
    const status = statusConfig[selectedTask.status]

    return (
      <div className="drawer" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-6">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className={cn('badge text-[9px]', priority.bgColor, priority.color)}>
                {priority.label}
              </span>
              <span className={cn('status-badge text-[9px]', `status-${selectedTask.status.toLowerCase()}`)}>
                {status.label}
              </span>
            </div>
            <h2 className="text-lg font-semibold text-text-primary">{selectedTask.title}</h2>
          </div>
          <button
            className="p-2 rounded-lg hover:bg-white/[0.05] text-text-muted transition-colors flex-shrink-0"
            onClick={() => setSelectedTask(null)}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex gap-1 mb-6 border-b border-border">
          {(['details', 'comments', 'activity'] as const).map(tab => (
            <button
              key={tab}
              className={cn(
                'px-3 py-2 text-xs font-medium capitalize transition-colors border-b-2 -mb-px',
                taskDetailTab === tab
                  ? 'text-gold border-gold'
                  : 'text-text-muted border-transparent hover:text-text-secondary'
              )}
              onClick={() => setTaskDetailTab(tab)}
            >
              {tab}
              {tab === 'comments' && ` (${selectedTask.comments.length})`}
              {tab === 'activity' && ` (${selectedTask.activity.length})`}
            </button>
          ))}
        </div>

        {taskDetailTab === 'details' && (
          <div className="space-y-4">
            {selectedTask.description && (
              <div>
                <label className="block text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1">Description</label>
                <p className="text-sm text-text-secondary whitespace-pre-wrap">{selectedTask.description}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="glass-card p-3">
                <label className="block text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1">Assignee</label>
                <div className="flex items-center gap-2">
                  <div className="avatar avatar-sm">
                    <span>{assignee?.name?.charAt(0) || '?'}</span>
                  </div>
                  <span className="text-sm text-text-primary">{assignee?.name || 'Unassigned'}</span>
                </div>
              </div>

              <div className="glass-card p-3">
                <label className="block text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1">Creator</label>
                <div className="flex items-center gap-2">
                  <div className="avatar avatar-sm">
                    <span>{creator?.name?.charAt(0) || '?'}</span>
                  </div>
                  <span className="text-sm text-text-primary">{creator?.name || 'Unknown'}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="glass-card p-3">
                <label className="block text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1">Due Date</label>
                <p className="text-sm text-text-primary">
                  {selectedTask.dueDate
                    ? new Date(selectedTask.dueDate).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })
                    : <span className="text-text-muted">No due date</span>
                  }
                </p>
              </div>

              <div className="glass-card p-3">
                <label className="block text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1">Product</label>
                <p className="text-sm text-text-primary">
                  {product ? <span className="text-gold">{product.name}</span> : <span className="text-text-muted">None</span>}
                </p>
              </div>
            </div>

            {selectedTask.tags.length > 0 && (
              <div className="glass-card p-3">
                <label className="block text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2">Tags</label>
                <div className="flex flex-wrap gap-1.5">
                  {selectedTask.tags.map(tag => (
                    <span key={tag} className="text-xs px-2.5 py-1 rounded-md bg-white/[0.05] text-text-secondary border border-border">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="glass-card p-3">
              <label className="block text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2">Status</label>
              <div className="flex gap-2">
                {statusColumns.map(s => (
                  <button
                    key={s}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                      selectedTask.status === s
                        ? 'bg-gold/15 text-gold border border-gold/20'
                        : 'bg-white/[0.03] text-text-muted border border-border hover:text-text-secondary'
                    )}
                    onClick={() => handleStatusChange(selectedTask.id, s)}
                  >
                    {statusConfig[s].label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button className="btn-secondary flex-1" onClick={() => openEditModal(selectedTask)}>
                <Edit3 className="w-4 h-4" />
                Edit
              </button>
              <button className="btn-danger" onClick={() => setDeletingTask(selectedTask)}>
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>

            <div className="text-[10px] text-text-muted pt-2 border-t border-border">
              Created: {new Date(selectedTask.createdAt).toLocaleString()} &middot;
              Updated: {new Date(selectedTask.updatedAt).toLocaleString()}
            </div>
          </div>
        )}

        {taskDetailTab === 'comments' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <input
                ref={commentInputRef}
                type="text"
                className="input-field flex-1"
                placeholder="Write a comment..."
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddComment()}
              />
              <button
                className="btn-primary px-3"
                onClick={handleAddComment}
                disabled={!commentText.trim()}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>

            {selectedTask.comments.length === 0 ? (
              <div className="text-center py-8">
                <MessageSquare className="w-8 h-8 text-text-muted mx-auto mb-2" />
                <p className="text-sm text-text-muted">No comments yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {[...selectedTask.comments].reverse().map(comment => {
                  const author = getUserById(comment.userId)
                  return (
                    <div key={comment.id} className="glass-card p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="avatar avatar-sm">
                          <span>{author?.name?.charAt(0) || '?'}</span>
                        </div>
                        <span className="text-xs font-medium text-text-primary">{author?.name || 'Unknown'}</span>
                        <span className="text-[10px] text-text-muted ml-auto">
                          {new Date(comment.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-text-secondary pl-8">{comment.content}</p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {taskDetailTab === 'activity' && (
          <div className="space-y-1">
            {selectedTask.activity.length === 0 ? (
              <div className="text-center py-8">
                <History className="w-8 h-8 text-text-muted mx-auto mb-2" />
                <p className="text-sm text-text-muted">No activity yet</p>
              </div>
            ) : (
              <div className="relative">
                <div className="absolute left-[15px] top-0 bottom-0 w-px bg-border" />
                {[...selectedTask.activity].reverse().map((activity) => {
                  const actor = getUserById(activity.userId)
                  return (
                    <div key={activity.id} className="relative flex items-start gap-3 py-3">
                      <div className="w-[30px] h-[30px] rounded-full bg-surface border border-border flex items-center justify-center z-10 flex-shrink-0">
                        <span className="text-[10px] font-semibold text-text-muted">
                          {actor?.name?.charAt(0) || '?'}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-xs font-medium text-text-primary">{actor?.name || 'Unknown'}</span>
                          <span className="text-xs text-text-muted">{activity.action}</span>
                        </div>
                        {activity.details && (
                          <p className="text-xs text-text-secondary mt-0.5">{activity.details}</p>
                        )}
                        <span className="text-[10px] text-text-muted mt-1 block">
                          {new Date(activity.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div className={cn('toast', toast.type === 'success' ? 'toast-success' : 'toast-error')}>
          {toast.type === 'success' ? <CheckSquare className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {toast.message}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Tasks</h1>
          <p className="text-sm text-text-muted mt-1">Manage and track team tasks.</p>
        </div>
        <button className="btn-primary" onClick={openCreateModal}>
          <Plus className="w-4 h-4" />
          New Task
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-1 bg-white/[0.03] border border-border rounded-lg p-1">
          {([
            { mode: 'kanban' as ViewMode, icon: LayoutGrid, label: 'Kanban' },
            { mode: 'list' as ViewMode, icon: List, label: 'List' },
            { mode: 'my-tasks' as ViewMode, icon: User, label: 'My Tasks' },
            { mode: 'calendar' as ViewMode, icon: Calendar, label: 'Calendar' },
          ]).map(({ mode, icon: Icon, label }) => (
            <button
              key={mode}
              onClick={() => setView(mode)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5',
                view === mode ? 'bg-gold/15 text-gold' : 'text-text-muted hover:text-text-secondary'
              )}
              title={label}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 max-w-xs relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            className="input-field pl-9 py-2 text-xs"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <button
          className={cn(
            'btn-ghost text-xs flex items-center gap-1.5',
            showFilters && 'text-gold'
          )}
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter className="w-3.5 h-3.5" />
          Filters
        </button>

        <div className="flex items-center gap-3 ml-auto">
          {[
            { label: 'Total', count: taskCounts.total, color: 'text-text-primary' },
            { label: 'To Do', count: taskCounts.TODO, color: 'text-text-muted' },
            { label: 'In Progress', count: taskCounts.IN_PROGRESS, color: 'text-info' },
            { label: 'Review', count: taskCounts.REVIEW, color: 'text-warning' },
            { label: 'Done', count: taskCounts.DONE, color: 'text-success' },
          ].map(stat => (
            <div key={stat.label} className="text-center">
              <div className={cn('text-lg font-bold', stat.color)}>{stat.count}</div>
              <div className="text-[10px] text-text-muted uppercase tracking-wider">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {showFilters && (
        <div className="flex flex-wrap gap-2 p-3 glass-card">
          <select
            className="select-field text-xs py-1.5 w-auto"
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value as TaskStatus | 'ALL')}
          >
            <option value="ALL">All Status</option>
            {statusColumns.map(s => (
              <option key={s} value={s}>{statusConfig[s].label}</option>
            ))}
          </select>

          <select
            className="select-field text-xs py-1.5 w-auto"
            value={filterPriority}
            onChange={e => setFilterPriority(e.target.value as TaskPriority | 'ALL')}
          >
            <option value="ALL">All Priority</option>
            {Object.entries(priorityConfig).map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </select>

          <select
            className="select-field text-xs py-1.5 w-auto"
            value={filterAssignee}
            onChange={e => setFilterAssignee(e.target.value)}
          >
            <option value="ALL">All Assignees</option>
            {teamUsers.map(user => (
              <option key={user.id} value={user.id}>{user.name}</option>
            ))}
          </select>

          {(filterStatus !== 'ALL' || filterPriority !== 'ALL' || filterAssignee !== 'ALL') && (
            <button
              className="btn-ghost text-xs text-danger"
              onClick={() => { setFilterStatus('ALL'); setFilterPriority('ALL'); setFilterAssignee('ALL') }}
            >
              <X className="w-3 h-3" />
              Clear
            </button>
          )}
        </div>
      )}

      {view === 'kanban' && (filteredTasks.length === 0 ? renderEmptyState() : renderKanbanView())}
      {view === 'list' && (filteredTasks.length === 0 ? renderEmptyState() : renderListView())}
      {view === 'my-tasks' && renderMyTasksView()}
      {view === 'calendar' && renderCalendarView()}

      {showCreateModal && renderCreateModal()}
      {renderDeleteConfirm()}

      {selectedTask && (
        <div className="fixed inset-0 z-40" onClick={() => setSelectedTask(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="absolute right-0 top-0 bottom-0" onClick={e => e.stopPropagation()}>
            {renderTaskDetail()}
          </div>
        </div>
      )}
    </div>
  )
}
