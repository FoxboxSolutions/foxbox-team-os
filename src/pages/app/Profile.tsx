import { useState, useRef } from 'react'
import { Camera, Save, Lock, ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAppState } from '@/stores/AppState'
import { UserAvatar } from '@/components/auth/UserAvatar'
import { getRoleDisplayName } from '@/lib/auth'
import type { AuthRole } from '@/types'

export function Profile() {
  const { authUser, updateProfile, changePassword } = useAppState()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [fullName, setFullName] = useState(authUser?.fullName || '')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [changingPassword, setChangingPassword] = useState(false)

  if (!authUser) return null

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setSaveMsg({ type: 'error', text: 'Please select an image file.' })
      return
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setSaveMsg({ type: 'error', text: 'Image must be under 2MB.' })
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      updateProfile({ avatar: result })
      setSaveMsg({ type: 'success', text: 'Avatar updated.' })
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveAvatar = () => {
    updateProfile({ avatar: null })
    setSaveMsg({ type: 'success', text: 'Avatar removed.' })
  }

  const handleSaveProfile = async () => {
    if (!fullName.trim()) {
      setSaveMsg({ type: 'error', text: 'Name cannot be empty.' })
      return
    }
    setSaving(true)
    setSaveMsg(null)
    try {
      updateProfile({ fullName: fullName.trim() })
      setSaveMsg({ type: 'success', text: 'Profile updated successfully.' })
    } catch {
      setSaveMsg({ type: 'error', text: 'Failed to update profile.' })
    }
    setSaving(false)
  }

  const handleChangePassword = async () => {
    setPasswordMsg(null)
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'All fields are required.' })
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'New passwords do not match.' })
      return
    }
    if (newPassword.length < 8) {
      setPasswordMsg({ type: 'error', text: 'Password must be at least 8 characters.' })
      return
    }
    setChangingPassword(true)
    const result = await changePassword(currentPassword, newPassword)
    if (result.success) {
      setPasswordMsg({ type: 'success', text: 'Password changed successfully.' })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setShowPasswordForm(false)
    } else {
      setPasswordMsg({ type: 'error', text: result.error || 'Failed to change password.' })
    }
    setChangingPassword(false)
  }

  return (
    <div className="max-w-2xl mx-auto p-8">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-text-muted hover:text-text-secondary mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <h1 className="text-2xl font-serif font-bold text-text-primary mb-8">My Profile</h1>

      {/* Avatar Section */}
      <div className="glass-card rounded-xl p-6 mb-6">
        <div className="flex items-center gap-6">
          <div className="relative group">
            <UserAvatar name={authUser.fullName} avatar={authUser.avatar} size="xl" />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer"
            >
              <Camera className="w-6 h-6 text-white" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-text-primary">{authUser.fullName}</h3>
            <p className="text-sm text-text-muted">{authUser.email}</p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-xs px-3 py-1.5 rounded-lg bg-gold/10 text-gold hover:bg-gold/20 transition-colors"
              >
                Change Avatar
              </button>
              {authUser.avatar && (
                <button
                  onClick={handleRemoveAvatar}
                  className="text-xs px-3 py-1.5 rounded-lg bg-danger/10 text-danger hover:bg-danger/20 transition-colors"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Profile Info */}
      <div className="glass-card rounded-xl p-6 mb-6">
        <h2 className="text-lg font-serif font-bold text-text-primary mb-4">Profile Information</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="input-field w-full"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5">Email</label>
            <input
              type="email"
              value={authUser.email}
              disabled
              className="input-field w-full opacity-60 cursor-not-allowed"
            />
            <p className="text-[11px] text-text-muted mt-1">Email cannot be changed.</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5">Position</label>
            <div className="input-field w-full opacity-60">
              {getRoleDisplayName(authUser.role as AuthRole)}
            </div>
            <p className="text-[11px] text-text-muted mt-1">Contact an administrator to change your role.</p>
          </div>
        </div>

        {saveMsg && (
          <div className={`mt-4 text-sm ${saveMsg.type === 'success' ? 'text-success' : 'text-danger'}`}>
            {saveMsg.text}
          </div>
        )}

        <button
          onClick={handleSaveProfile}
          disabled={saving || fullName === authUser.fullName}
          className="btn-primary mt-4 flex items-center gap-2 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {/* Password Section */}
      <div className="glass-card rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-serif font-bold text-text-primary">Security</h2>
          {!showPasswordForm && (
            <button
              onClick={() => setShowPasswordForm(true)}
              className="text-sm px-4 py-2 rounded-lg bg-gold/10 text-gold hover:bg-gold/20 transition-colors flex items-center gap-2"
            >
              <Lock className="w-4 h-4" />
              Change Password
            </button>
          )}
        </div>

        {showPasswordForm && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="input-field w-full"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="input-field w-full"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input-field w-full"
              />
            </div>

            {passwordMsg && (
              <div className={`text-sm ${passwordMsg.type === 'success' ? 'text-success' : 'text-danger'}`}>
                {passwordMsg.text}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleChangePassword}
                disabled={changingPassword}
                className="btn-primary flex items-center gap-2 disabled:opacity-50"
              >
                <Lock className="w-4 h-4" />
                {changingPassword ? 'Changing...' : 'Update Password'}
              </button>
              <button
                onClick={() => {
                  setShowPasswordForm(false)
                  setPasswordMsg(null)
                  setCurrentPassword('')
                  setNewPassword('')
                  setConfirmPassword('')
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
