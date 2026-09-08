import { useState, useRef, useMemo } from 'react'
import {
  FolderOpen,
  File,
  Image,
  Video,
  FileText,
  Upload,
  Search,
  Download,
  Trash2,
  Eye,
  Grid,
  List,
  X,
  ArrowUpDown,
  Tag,
  FileSpreadsheet,
  Presentation,
} from 'lucide-react'
import { useAppState } from '@/stores/AppState'
import { cn } from '@/lib/utils'
import type { FileFolder, VaultFile } from '@/types'

const folderConfig: Record<FileFolder, { label: string; icon: typeof FolderOpen; description: string }> = {
  PRODUCTS: { label: 'Products', icon: FolderOpen, description: 'Product images, specs, and assets' },
  CREATIVES: { label: 'Creatives', icon: Image, description: 'Ad creatives and design files' },
  VIDEOS: { label: 'Videos', icon: Video, description: 'Video content and recordings' },
  IMAGES: { label: 'Images', icon: Image, description: 'General images and photos' },
  SUPPLIERS: { label: 'Suppliers', icon: FileText, description: 'Supplier documents and contacts' },
  DOCUMENTS: { label: 'Documents', icon: FileText, description: 'Policies, reports, and paperwork' },
  MARKETING: { label: 'Marketing', icon: Presentation, description: 'Marketing materials and campaigns' },
  OPERATIONS: { label: 'Operations', icon: FileSpreadsheet, description: 'Operational docs and spreadsheets' },
}

const mimeToIcon = (mimeType: string) => {
  if (mimeType.startsWith('image/')) return Image
  if (mimeType.startsWith('video/')) return Video
  if (mimeType.includes('pdf')) return FileText
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) return FileSpreadsheet
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return Presentation
  if (mimeType.includes('document') || mimeType.includes('word') || mimeType.includes('text')) return FileText
  return File
}

const mimeToLabel = (mimeType: string) => {
  if (mimeType.startsWith('image/')) return 'Image'
  if (mimeType.startsWith('video/')) return 'Video'
  if (mimeType.includes('pdf')) return 'PDF'
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) return 'Spreadsheet'
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'Presentation'
  if (mimeType.includes('document') || mimeType.includes('word')) return 'Document'
  if (mimeType.includes('text')) return 'Text'
  return 'File'
}

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

const formatDate = (date: Date) => {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

type SortField = 'name' | 'createdAt' | 'size'
type SortDir = 'asc' | 'desc'

export function Files() {
  const { files, addFile, deleteFile, products, currentUser, addActivityLog, addNotification } = useAppState()

  const [selectedFolder, setSelectedFolder] = useState<FileFolder | 'ALL'>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [sortField, setSortField] = useState<SortField>('createdAt')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadFolder, setUploadFolder] = useState<FileFolder>('DOCUMENTS')
  const [uploadTags, setUploadTags] = useState('')
  const [uploadProductId, setUploadProductId] = useState<string>('')
  const [pendingFiles, setPendingFiles] = useState<{ file: File; preview: string }[]>([])
  const [isUploading, setIsUploading] = useState(false)

  const [previewFile, setPreviewFile] = useState<VaultFile | null>(null)

  const [deleteConfirmFile, setDeleteConfirmFile] = useState<VaultFile | null>(null)

  const [infoFile, setInfoFile] = useState<VaultFile | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const filteredFiles = useMemo(() => {
    let result = files.filter(f => {
      const matchesFolder = selectedFolder === 'ALL' || f.folder === selectedFolder
      const matchesSearch = !searchQuery ||
        f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.originalName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
      return matchesFolder && matchesSearch
    })

    result.sort((a, b) => {
      let comparison = 0
      if (sortField === 'name') {
        comparison = a.name.localeCompare(b.name)
      } else if (sortField === 'createdAt') {
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      } else if (sortField === 'size') {
        comparison = a.size - b.size
      }
      return sortDir === 'asc' ? comparison : -comparison
    })

    return result
  }, [files, selectedFolder, searchQuery, sortField, sortDir])

  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: files.length }
    for (const f of files) {
      counts[f.folder] = (counts[f.folder] || 0) + 1
    }
    return counts
  }, [files])

  const getProductById = (id: string) => products.find(p => p.id === id)

  const handleFileInputClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputFiles = e.target.files
    if (!inputFiles) return

    const newPending: { file: File; preview: string }[] = []
    let loaded = 0

    for (let i = 0; i < inputFiles.length; i++) {
      const file = inputFiles[i]
      const reader = new FileReader()
      reader.onload = (ev) => {
        newPending.push({ file, preview: ev.target?.result as string })
        loaded++
        if (loaded === inputFiles.length) {
          setPendingFiles(prev => [...prev, ...newPending])
        }
      }
      reader.readAsDataURL(file)
    }

    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleUpload = async () => {
    if (pendingFiles.length === 0) return

    setIsUploading(true)
    const tags = uploadTags
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0)

    for (const pending of pendingFiles) {
      const vaultFile: VaultFile = {
        id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: pending.file.name,
        originalName: pending.file.name,
        mimeType: pending.file.type || 'application/octet-stream',
        size: pending.file.size,
        url: pending.preview,
        thumbnailUrl: pending.file.type.startsWith('image/') ? pending.preview : undefined,
        folder: uploadFolder,
        tags,
        productId: uploadProductId || undefined,
        uploadedBy: currentUser?.id || 'unknown',
        createdAt: new Date(),
      }

      addFile(vaultFile)

      addActivityLog({
        id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        userId: currentUser?.id || 'unknown',
        action: 'FILE_UPLOADED',
        entityType: 'FILE',
        entityId: vaultFile.id,
        entityName: vaultFile.name,
        details: `Uploaded "${pending.file.name}" to ${folderConfig[uploadFolder].label}`,
        createdAt: new Date(),
      })

      addNotification({
        id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        userId: currentUser?.id || 'unknown',
        title: 'File Uploaded',
        message: `"${pending.file.name}" was added to ${folderConfig[uploadFolder].label}`,
        type: 'GENERAL',
        isRead: false,
        createdAt: new Date(),
      })
    }

    setPendingFiles([])
    setUploadTags('')
    setUploadProductId('')
    setIsUploading(false)
    setShowUploadModal(false)
  }

  const handleDownload = (file: VaultFile) => {
    const link = document.createElement('a')
    link.href = file.url
    link.download = file.originalName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleDeleteConfirm = () => {
    if (!deleteConfirmFile) return

    addActivityLog({
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      userId: currentUser?.id || 'unknown',
      action: 'FILE_UPLOADED',
      entityType: 'FILE',
      entityId: deleteConfirmFile.id,
      entityName: deleteConfirmFile.name,
      details: `Deleted "${deleteConfirmFile.name}" from ${folderConfig[deleteConfirmFile.folder].label}`,
      createdAt: new Date(),
    })

    deleteFile(deleteConfirmFile.id)
    setDeleteConfirmFile(null)
    if (previewFile?.id === deleteConfirmFile.id) setPreviewFile(null)
    if (infoFile?.id === deleteConfirmFile.id) setInfoFile(null)
  }

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  return (
    <div className="space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Files & Media Vault</h1>
          <p className="text-sm text-text-muted mt-1">Centralized storage for all team files.</p>
        </div>
        <button
          onClick={() => {
            setUploadFolder(selectedFolder === 'ALL' ? 'DOCUMENTS' : selectedFolder)
            setShowUploadModal(true)
          }}
          className="btn-primary"
        >
          <Upload className="w-4 h-4" />
          Upload File
        </button>
      </div>

      {/* Search + Sort + View Toggle */}
      <div className="flex items-center gap-4">
        <div className="header-search flex items-center gap-3 px-4 py-2.5 flex-1 max-w-md">
          <Search className="w-4 h-4 text-text-muted" />
          <input
            type="text"
            placeholder="Search files by name or tag..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent border-none outline-none text-sm text-text-primary placeholder:text-text-muted w-full"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-text-muted hover:text-text-secondary">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={`${sortField}-${sortDir}`}
              onChange={(e) => {
                const [field, dir] = e.target.value.split('-') as [SortField, SortDir]
                setSortField(field)
                setSortDir(dir)
              }}
              className="select-field text-xs py-2 pl-3 pr-8 appearance-none cursor-pointer"
            >
              <option value="createdAt-desc">Newest First</option>
              <option value="createdAt-asc">Oldest First</option>
              <option value="name-asc">Name A-Z</option>
              <option value="name-desc">Name Z-A</option>
              <option value="size-desc">Largest First</option>
              <option value="size-asc">Smallest First</option>
            </select>
            <ArrowUpDown className="w-3 h-3 text-text-muted absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        <div className="flex items-center gap-1 bg-white/[0.03] border border-border rounded-lg p-1">
          <button
            onClick={() => setViewMode('grid')}
            className={cn('p-2 rounded-md transition-colors', viewMode === 'grid' ? 'bg-gold/15 text-gold' : 'text-text-muted')}
          >
            <Grid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={cn('p-2 rounded-md transition-colors', viewMode === 'list' ? 'bg-gold/15 text-gold' : 'text-text-muted')}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Folder Tabs */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setSelectedFolder('ALL')}
          className={cn(
            'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
            selectedFolder === 'ALL' ? 'bg-gold/15 text-gold border border-gold/20' : 'bg-white/[0.03] text-text-muted border border-border hover:border-border-light'
          )}
        >
          All Files ({folderCounts.ALL || 0})
        </button>
        {(Object.keys(folderConfig) as FileFolder[]).map((folder) => {
          const count = folderCounts[folder] || 0
          const config = folderConfig[folder]
          return (
            <button
              key={folder}
              onClick={() => setSelectedFolder(folder)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5',
                selectedFolder === folder ? 'bg-gold/15 text-gold border border-gold/20' : 'bg-white/[0.03] text-text-muted border border-border hover:border-border-light'
              )}
            >
              <config.icon className="w-3 h-3" />
              {config.label} ({count})
            </button>
          )
        })}
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-muted">
          Showing {filteredFiles.length} of {files.length} files
          {selectedFolder !== 'ALL' && ` in ${folderConfig[selectedFolder].label}`}
          {searchQuery && ` matching "${searchQuery}"`}
        </p>
      </div>

      {/* Files Grid/List */}
      {filteredFiles.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <FolderOpen className="w-6 h-6" />
          </div>
          <p className="text-sm text-text-muted">
            {searchQuery
              ? 'No files match your search.'
              : selectedFolder === 'ALL'
                ? 'No files uploaded yet. Click "Upload File" to get started.'
                : `No files in ${folderConfig[selectedFolder].label} yet.`
            }
          </p>
          {!searchQuery && (
            <button
              onClick={() => {
                setUploadFolder(selectedFolder === 'ALL' ? 'DOCUMENTS' : selectedFolder)
                setShowUploadModal(true)
              }}
              className="btn-secondary text-xs mt-2"
            >
              <Upload className="w-3.5 h-3.5" />
              Upload Files
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredFiles.map((file) => {
            const Icon = mimeToIcon(file.mimeType)
            const product = file.productId ? getProductById(file.productId) : null
            return (
              <div key={file.id} className="glass-card p-3 group cursor-pointer hover:border-gold/20 transition-all">
                <div
                  className="w-full aspect-[4/3] rounded-lg bg-white/[0.03] border border-border flex items-center justify-center mb-3 overflow-hidden"
                  onClick={() => setPreviewFile(file)}
                >
                  {file.thumbnailUrl || file.mimeType.startsWith('image/') ? (
                    <img
                      src={file.thumbnailUrl || file.url}
                      alt={file.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Icon className="w-8 h-8 text-text-muted" />
                      <span className="text-[10px] text-text-muted">{mimeToLabel(file.mimeType)}</span>
                    </div>
                  )}
                </div>
                <h4 className="text-sm font-medium truncate mb-1 text-text-primary" title={file.name}>{file.name}</h4>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] text-text-muted">{formatFileSize(file.size)}</span>
                  <span className="text-[11px] text-text-muted">{formatDate(file.createdAt)}</span>
                </div>
                {product && (
                  <div className="text-[10px] text-gold truncate mb-1">{product.name}</div>
                )}
                {file.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {file.tags.slice(0, 2).map(tag => (
                      <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded bg-gold/10 text-gold/80">{tag}</span>
                    ))}
                    {file.tags.length > 2 && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.05] text-text-muted">+{file.tags.length - 2}</span>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => { e.stopPropagation(); setPreviewFile(file) }}
                    className="p-1.5 rounded bg-white/[0.05] text-text-muted hover:text-gold transition-colors"
                    title="Preview"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDownload(file) }}
                    className="p-1.5 rounded bg-white/[0.05] text-text-muted hover:text-gold transition-colors"
                    title="Download"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setInfoFile(file) }}
                    className="p-1.5 rounded bg-white/[0.05] text-text-muted hover:text-gold transition-colors"
                    title="Info"
                  >
                    <FileText className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteConfirmFile(file) }}
                    className="p-1.5 rounded bg-white/[0.05] text-text-muted hover:text-danger transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th className="text-left cursor-pointer hover:text-gold transition-colors" onClick={() => toggleSort('name')}>
                  <div className="flex items-center gap-1">
                    Name
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="text-left">Folder</th>
                <th className="text-left">Type</th>
                <th className="text-left cursor-pointer hover:text-gold transition-colors" onClick={() => toggleSort('size')}>
                  <div className="flex items-center gap-1">
                    Size
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="text-left">Product</th>
                <th className="text-left">Tags</th>
                <th className="text-left cursor-pointer hover:text-gold transition-colors" onClick={() => toggleSort('createdAt')}>
                  <div className="flex items-center gap-1">
                    Uploaded
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredFiles.map((file) => {
                const Icon = mimeToIcon(file.mimeType)
                const folder = folderConfig[file.folder]
                const product = file.productId ? getProductById(file.productId) : null
                return (
                  <tr key={file.id} className="group">
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-white/[0.03] border border-border flex items-center justify-center overflow-hidden flex-shrink-0">
                          {file.thumbnailUrl || file.mimeType.startsWith('image/') ? (
                            <img
                              src={file.thumbnailUrl || file.url}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Icon className="w-4 h-4 text-text-muted" />
                          )}
                        </div>
                        <button
                          onClick={() => setPreviewFile(file)}
                          className="font-medium text-text-primary hover:text-gold transition-colors truncate max-w-[200px]"
                          title={file.name}
                        >
                          {file.name}
                        </button>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <folder.icon className="w-3 h-3 text-text-muted" />
                        <span className="text-xs text-text-muted">{folder.label}</span>
                      </div>
                    </td>
                    <td>
                      <span className="text-xs text-text-muted">{mimeToLabel(file.mimeType)}</span>
                    </td>
                    <td>
                      <span className="text-xs text-text-muted">{formatFileSize(file.size)}</span>
                    </td>
                    <td>
                      {product ? (
                        <span className="text-xs text-gold">{product.name}</span>
                      ) : (
                        <span className="text-xs text-text-muted">-</span>
                      )}
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {file.tags.slice(0, 2).map(tag => (
                          <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-gold/10 text-gold/80">{tag}</span>
                        ))}
                        {file.tags.length > 2 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.05] text-text-muted">+{file.tags.length - 2}</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className="text-xs text-text-muted">{formatDate(file.createdAt)}</span>
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setPreviewFile(file)}
                          className="p-1.5 rounded hover:bg-white/[0.05] text-text-muted hover:text-gold transition-colors"
                          title="Preview"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDownload(file)}
                          className="p-1.5 rounded hover:bg-white/[0.05] text-text-muted hover:text-gold transition-colors"
                          title="Download"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setInfoFile(file)}
                          className="p-1.5 rounded hover:bg-white/[0.05] text-text-muted hover:text-gold transition-colors"
                          title="Info"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmFile(file)}
                          className="p-1.5 rounded hover:bg-white/[0.05] text-text-muted hover:text-danger transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => { setShowUploadModal(false); setPendingFiles([]) }}>
          <div
            className="w-full max-w-lg mx-4 rounded-2xl bg-surface border border-border shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="text-lg font-bold text-text-primary">Upload Files</h2>
              <button onClick={() => { setShowUploadModal(false); setPendingFiles([]) }} className="p-1.5 rounded-lg hover:bg-white/[0.05] text-text-muted hover:text-text-secondary transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Drop zone / select */}
              <div
                onClick={handleFileInputClick}
                className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-gold/30 hover:bg-gold/[0.02] transition-all"
              >
                <Upload className="w-8 h-8 text-text-muted mx-auto mb-3" />
                <p className="text-sm text-text-secondary mb-1">Click to select files</p>
                <p className="text-xs text-text-muted">Images, videos, PDFs, documents, spreadsheets</p>
              </div>

              {/* Pending files list */}
              {pendingFiles.length > 0 && (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {pendingFiles.map((pending, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-2 rounded-lg bg-white/[0.03] border border-border">
                      {pending.file.type.startsWith('image/') ? (
                        <img src={pending.preview} alt="" className="w-10 h-10 rounded object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded bg-white/[0.05] flex items-center justify-center">
                          {(() => {
                            const PIcon = mimeToIcon(pending.file.type)
                            return <PIcon className="w-5 h-5 text-text-muted" />
                          })()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-text-primary truncate">{pending.file.name}</p>
                        <p className="text-[11px] text-text-muted">{formatFileSize(pending.file.size)}</p>
                      </div>
                      <button
                        onClick={() => removePendingFile(idx)}
                        className="p-1 rounded hover:bg-white/[0.05] text-text-muted hover:text-danger transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Folder select */}
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-2">Upload to Folder</label>
                <select
                  value={uploadFolder}
                  onChange={(e) => setUploadFolder(e.target.value as FileFolder)}
                  className="select-field w-full"
                >
                  {(Object.keys(folderConfig) as FileFolder[]).map(f => (
                    <option key={f} value={f}>{folderConfig[f].label}</option>
                  ))}
                </select>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-2">
                  <Tag className="w-3 h-3 inline mr-1" />
                  Tags (comma separated)
                </label>
                <input
                  type="text"
                  value={uploadTags}
                  onChange={(e) => setUploadTags(e.target.value)}
                  placeholder="e.g. brand, campaign, urgent"
                  className="input-field w-full"
                />
              </div>

              {/* Product association */}
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-2">Associate with Product (optional)</label>
                <select
                  value={uploadProductId}
                  onChange={(e) => setUploadProductId(e.target.value)}
                  className="select-field w-full"
                >
                  <option value="">None</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-5 border-t border-border">
              <button
                onClick={() => { setShowUploadModal(false); setPendingFiles([]) }}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={pendingFiles.length === 0 || isUploading}
                className={cn('btn-primary', pendingFiles.length === 0 || isUploading ? 'opacity-50 cursor-not-allowed' : '')}
              >
                {isUploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Upload {pendingFiles.length > 0 ? `${pendingFiles.length} File${pendingFiles.length > 1 ? 's' : ''}` : ''}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setPreviewFile(null)}>
          <div
            className="relative w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col rounded-2xl bg-surface border border-border shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-3 min-w-0">
                {(() => {
                  const Icon = mimeToIcon(previewFile.mimeType)
                  return <Icon className="w-5 h-5 text-gold flex-shrink-0" />
                })()}
                <h3 className="text-sm font-bold text-text-primary truncate">{previewFile.name}</h3>
                <span className="text-xs text-text-muted flex-shrink-0">{formatFileSize(previewFile.size)}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => handleDownload(previewFile)}
                  className="btn-secondary text-xs py-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                </button>
                <button onClick={() => setPreviewFile(null)} className="p-1.5 rounded-lg hover:bg-white/[0.05] text-text-muted hover:text-text-secondary transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-6 flex items-center justify-center min-h-[300px]">
              {previewFile.mimeType.startsWith('image/') ? (
                <img
                  src={previewFile.url}
                  alt={previewFile.name}
                  className="max-w-full max-h-[60vh] object-contain rounded-lg"
                />
              ) : previewFile.mimeType.startsWith('video/') ? (
                <video
                  src={previewFile.url}
                  controls
                  className="max-w-full max-h-[60vh] rounded-lg"
                />
              ) : previewFile.mimeType === 'application/pdf' ? (
                <iframe
                  src={previewFile.url}
                  className="w-full h-[60vh] rounded-lg border border-border"
                  title={previewFile.name}
                />
              ) : (
                <div className="flex flex-col items-center gap-4">
                  {(() => {
                    const Icon = mimeToIcon(previewFile.mimeType)
                    return <Icon className="w-20 h-20 text-text-muted" />
                  })()}
                  <p className="text-sm text-text-muted">Preview not available for this file type</p>
                  <button onClick={() => handleDownload(previewFile)} className="btn-primary">
                    <Download className="w-4 h-4" />
                    Download to View
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Info Modal */}
      {infoFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setInfoFile(null)}>
          <div
            className="w-full max-w-md mx-4 rounded-2xl bg-surface border border-border shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="text-lg font-bold text-text-primary">File Information</h2>
              <button onClick={() => setInfoFile(null)} className="p-1.5 rounded-lg hover:bg-white/[0.05] text-text-muted hover:text-text-secondary transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Preview */}
              <div className="w-full aspect-video rounded-xl bg-white/[0.03] border border-border overflow-hidden flex items-center justify-center">
                {infoFile.thumbnailUrl || infoFile.mimeType.startsWith('image/') ? (
                  <img src={infoFile.thumbnailUrl || infoFile.url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    {(() => {
                      const Icon = mimeToIcon(infoFile.mimeType)
                      return <Icon className="w-12 h-12 text-text-muted" />
                    })()}
                    <span className="text-xs text-text-muted">{mimeToLabel(infoFile.mimeType)}</span>
                  </div>
                )}
              </div>

              {/* Details */}
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-xs text-text-muted">Name</span>
                  <span className="text-sm text-text-primary font-medium text-right max-w-[200px] truncate">{infoFile.name}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-xs text-text-muted">Type</span>
                  <span className="text-sm text-text-primary">{mimeToLabel(infoFile.mimeType)} ({infoFile.mimeType})</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-xs text-text-muted">Size</span>
                  <span className="text-sm text-text-primary">{formatFileSize(infoFile.size)}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-xs text-text-muted">Folder</span>
                  <div className="flex items-center gap-1.5">
                    {(() => {
                      const FolderIcon = folderConfig[infoFile.folder].icon
                      return <FolderIcon className="w-3 h-3 text-gold" />
                    })()}
                    <span className="text-sm text-gold">{folderConfig[infoFile.folder].label}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-xs text-text-muted">Uploaded By</span>
                  <span className="text-sm text-text-primary">{infoFile.uploadedBy}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-xs text-text-muted">Date</span>
                  <span className="text-sm text-text-primary">{formatDate(infoFile.createdAt)}</span>
                </div>
                {infoFile.productId && (
                  <div className="flex items-center justify-between py-2 border-b border-border">
                    <span className="text-xs text-text-muted">Product</span>
                    <span className="text-sm text-gold">{getProductById(infoFile.productId)?.name || 'Unknown'}</span>
                  </div>
                )}
                {infoFile.tags.length > 0 && (
                  <div className="py-2">
                    <span className="text-xs text-text-muted block mb-2">Tags</span>
                    <div className="flex flex-wrap gap-1.5">
                      {infoFile.tags.map(tag => (
                        <span key={tag} className="text-xs px-2 py-1 rounded-lg bg-gold/10 text-gold">{tag}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-5 border-t border-border">
              <button
                onClick={() => { setInfoFile(null); setDeleteConfirmFile(infoFile) }}
                className="btn-secondary text-danger hover:text-danger"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
              <button onClick={() => setInfoFile(null)} className="btn-primary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setDeleteConfirmFile(null)}>
          <div
            className="w-full max-w-sm mx-4 rounded-2xl bg-surface border border-border shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-danger/10 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-danger" />
              </div>
              <h3 className="text-lg font-bold text-text-primary mb-2">Delete File?</h3>
              <p className="text-sm text-text-muted mb-1">Are you sure you want to delete</p>
              <p className="text-sm font-medium text-text-primary mb-4">"{deleteConfirmFile.name}"?</p>
              <p className="text-xs text-text-muted">This action cannot be undone.</p>
            </div>
            <div className="flex items-center gap-3 p-5 border-t border-border">
              <button
                onClick={() => setDeleteConfirmFile(null)}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="btn-primary flex-1 bg-danger hover:bg-danger/80 border-danger/20"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
