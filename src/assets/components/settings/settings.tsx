import React, { useState, useRef, useEffect, useMemo } from 'react';
import './settings.css';
import brandMark from '../../../Logos/pagelogo2.png';
import {
  changePassword,
  deleteAccount,
  getMe,
  getSessions,
  logout,
  revokeOtherSessions,
  revokeSession,
  updatePromptHistory,
  updateUsername,
} from '../services/authApi';

interface SessionDevice {
  id: string;
  badge: string;
  name: string;
  subtitle: string;
  isCurrent: boolean;
  expiresIn: string;
}

const INITIAL_SESSIONS: SessionDevice[] = [
  {
    id: 'macos-chrome',
    badge: 'M',
    name: 'Chrome on macOS',
    subtitle: 'This device',
    isCurrent: true,
    expiresIn: 'Expires in 7 days',
  },
  {
    id: 'iphone-safari',
    badge: 'I',
    name: 'Safari on iPhone',
    subtitle: 'Another signed-in device',
    isCurrent: false,
    expiresIn: 'Expires in 2 days',
  },
];

type SettingsProps = {
  username?: string;
  onUsernameChanged?: (username: string) => void;
  onLogout?: () => void;
  onOpenDashboard?: () => void;
  profilePicture?: string;
  onProfilePictureChanged?: (picture: string) => void;
  theme?: 'light' | 'dark' | 'system';
  onThemeChanged?: (theme: 'light' | 'dark' | 'system', origin?: { x: number; y: number }) => void;
};

export const PromptPilotSettings: React.FC<SettingsProps> = ({
  username: initialUsername = 'there',
  onUsernameChanged,
  onLogout,
  onOpenDashboard,
  profilePicture = '',
  onProfilePictureChanged,
  theme = 'system',
  onThemeChanged,
}) => {
  // Navigation & Account Menu State (Consistent with PromptPilot Dashboard)
  const [activeNav, setActiveNav] = useState<string>('settings');
  const [accountMenuOpen, setAccountMenuOpen] = useState<boolean>(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  // Settings Search Filter
  const [searchQuery, setSearchQuery] = useState<string>('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Account & Profile Picture State
  const [username, setUsername] = useState<string>(initialUsername);
  const [picture, setPicture] = useState<string>(profilePicture);
  const pictureInputRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState<string>('');
  const [isChangingUsername, setIsChangingUsername] = useState<boolean>(false);
  const [usernameInput, setUsernameInput] = useState<string>(initialUsername);
  const [deletePassword, setDeletePassword] = useState<string>('');
  const [confirmDelete, setConfirmDelete] = useState<boolean>(false);
  const [isChangingPassword, setIsChangingPassword] = useState<boolean>(false);
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [passwordSavedToast, setPasswordSavedToast] = useState<boolean>(false);

  // Image Cropper / Resizer State
  const [cropDraftSrc, setCropDraftSrc] = useState<string | null>(null);
  const [cropNaturalSize, setCropNaturalSize] = useState<{ w: number; h: number }>({ w: 1, h: 1 });
  const [cropZoom, setCropZoom] = useState<number>(1);
  const [cropOffset, setCropOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragOriginRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const cropImageRef = useRef<HTMLImageElement | null>(null);

  // Active Sessions State
  const [sessions, setSessions] = useState<SessionDevice[]>(INITIAL_SESSIONS);

  // Privacy & History State
  const [historyEnabled, setHistoryEnabled] = useState<boolean>(true);
  const [retentionDays, setRetentionDays] = useState<string>('30');
  const [confirmClearHistory, setConfirmClearHistory] = useState<boolean>(false);
  const [historyClearedToast, setHistoryClearedToast] = useState<boolean>(false);

  // Close bottom account menu on outside click or Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setAccountMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setAccountMenuOpen(false);
        setConfirmClearHistory(false);
        setCropDraftSrc(null);
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    void getMe().then((result) => {
      setUsername(result.user.username)
      setUsernameInput(result.user.username)
      setEmail(result.user.email)
      setHistoryEnabled(result.user.promptHistoryEnabled)
      setRetentionDays(String(result.user.promptRetentionDays || 30))
    }).catch(() => undefined)

    void getSessions().then((result) => {
      setSessions(result.sessions.map((session: {
        id: string
        isCurrent: boolean
        userAgent?: string
        ipAddress?: string
        expiresAt: string
      }) => ({
        id: session.id,
        badge: session.isCurrent ? 'T' : 'D',
        name: session.userAgent?.slice(0, 42) || 'Browser session',
        subtitle: session.ipAddress ? `IP: ${session.ipAddress}` : 'Signed-in device',
        isCurrent: session.isCurrent,
        expiresIn: `Expires ${new Date(session.expiresAt).toLocaleDateString()}`,
      })))
    }).catch(() => undefined)
  }, [])

  // Live section filtering when user searches settings
  const visibility = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return { account: true, sessions: true, privacy: true };
    }
    return {
      account:
        'account email address password security profile picture avatar username delete resize crop'.includes(q) ||
        q.includes('email') ||
        q.includes('pass') ||
        q.includes('picture') ||
        q.includes('avatar') ||
        q.includes('account'),
      sessions:
        'active sessions devices chrome macos safari iphone sign out'.includes(q) ||
        q.includes('session') ||
        q.includes('device') ||
        q.includes('mac') ||
        q.includes('iphone'),
      privacy:
        'privacy history retention 30 days saved prompt files clear cookies tokens theme appearance dark light system'.includes(q) ||
        q.includes('priv') ||
        q.includes('hist') ||
        q.includes('reten') ||
        q.includes('clear') ||
        q.includes('txt') ||
        q.includes('theme'),
    };
  }, [searchQuery]);

  const noResults = !visibility.account && !visibility.sessions && !visibility.privacy;

  const frequentSettings = useMemo(() => {
    const saved = JSON.parse(localStorage.getItem('promptpilot_frequent_settings') || '[]') as string[]
    return saved.slice(0, 3)
  }, [searchQuery])

  const recordFrequentSetting = (setting: string) => {
    const saved = JSON.parse(localStorage.getItem('promptpilot_frequent_settings') || '[]') as string[]
    const next = [setting, ...saved.filter((item) => item !== setting)].slice(0, 5)
    localStorage.setItem('promptpilot_frequent_settings', JSON.stringify(next))
  }

  const handleSelectPictureFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      window.alert('Please choose an image smaller than 5 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result || '');
      const img = new Image();
      img.onload = () => {
        setCropNaturalSize({ w: img.naturalWidth || 1, h: img.naturalHeight || 1 });
        setCropZoom(1);
        setCropOffset({ x: 0, y: 0 });
        setCropDraftSrc(src);
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  };

  const clampCropOffset = (x: number, y: number, zoom: number) => {
    const frame = 200;
    const baseScale = Math.max(frame / cropNaturalSize.w, frame / cropNaturalSize.h);
    const renderedW = cropNaturalSize.w * baseScale * zoom;
    const renderedH = cropNaturalSize.h * baseScale * zoom;
    const maxX = Math.max(0, (renderedW - frame) / 2);
    const maxY = Math.max(0, (renderedH - frame) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, x)),
      y: Math.min(maxY, Math.max(-maxY, y)),
    };
  };

  const handleApplyCroppedPicture = () => {
    const img = cropImageRef.current;
    if (!img) return;
    const frame = 200;
    const outputSize = 256;
    const canvas = document.createElement('canvas');
    canvas.width = outputSize;
    canvas.height = outputSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const naturalW = img.naturalWidth || cropNaturalSize.w;
    const naturalH = img.naturalHeight || cropNaturalSize.h;
    const baseScale = Math.max(frame / naturalW, frame / naturalH);
    const totalScale = baseScale * cropZoom;
    const renderedW = naturalW * totalScale;
    const renderedH = naturalH * totalScale;
    const ratio = outputSize / frame;

    const drawX = ((frame - renderedW) / 2 + cropOffset.x) * ratio;
    const drawY = ((frame - renderedH) / 2 + cropOffset.y) * ratio;

    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, drawX, drawY, renderedW * ratio, renderedH * ratio);

    const resizedDataUrl = canvas.toDataURL('image/webp', 0.9);
    setPicture(resizedDataUrl);
    onProfilePictureChanged?.(resizedDataUrl);
    setCropDraftSrc(null);
    recordFrequentSetting('Profile picture');
  };

  const handleRemovePicture = () => {
    setPicture('');
    onProfilePictureChanged?.('');
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword.trim() || !newPassword.trim()) return;
    try {
      await changePassword(currentPassword, newPassword, newPassword)
      setIsChangingPassword(false)
      setCurrentPassword('')
      setNewPassword('')
      setPasswordSavedToast(true)
      setTimeout(() => setPasswordSavedToast(false), 2600)
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Password could not be changed.')
    }
  };

  const handleRevokeSession = async (id: string) => {
    await revokeSession(id).catch(() => undefined)
    setSessions((prev) => prev.filter((session) => session.id !== id));
  };

  const handleSignOutOthers = async () => {
    await revokeOtherSessions().catch(() => undefined)
    setSessions((prev) => prev.filter((session) => session.isCurrent));
  };

  const handleClearRecentHistory = () => {
    if (!confirmClearHistory) {
      setConfirmClearHistory(true);
      return;
    }
    localStorage.removeItem('promptpilot_prompt_history')
    setConfirmClearHistory(false);
    setHistoryClearedToast(true);
    setTimeout(() => setHistoryClearedToast(false), 2600);
  };

  const handleDownloadHistory = () => {
    const history = JSON.parse(localStorage.getItem('promptpilot_prompt_history') || '[]') as string[]
    const blob = new Blob([history.join('\n\n')], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'promptpilot-history.txt'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  };

  const cropBaseScale = Math.max(200 / cropNaturalSize.w, 200 / cropNaturalSize.h);
  const themeIndex = theme === 'light' ? 0 : theme === 'dark' ? 1 : 2;

  return (
    <div className="pp-layout">
      {/* Left Navigation Rail (Matched to Updated Dashboard) */}
      <aside className="pp-sidebar" aria-label="Workspace Navigation">
        <div className="pp-sidebar-top">
          <div className="pp-brand">
            <img className="pp-brand-mark" src={brandMark} alt="" />
            <span className="pp-brand-name">PromptPilot</span>
          </div>

          <nav className="pp-nav-group" aria-label="Workspace">
            <span className="pp-nav-label">WORKSPACE</span>
            <button
              type="button"
              className={`pp-nav-item ${activeNav === 'new-prompt' ? 'is-active' : ''}`}
              onClick={() => {
                setActiveNav('new-prompt')
                onOpenDashboard?.()
              }}
            >
              <svg className="pp-nav-svg" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span>New Prompt</span>
            </button>
            <button
              type="button"
              className={`pp-nav-item ${activeNav === 'recent' ? 'is-active' : ''}`}
              onClick={() => setActiveNav('recent')}
            >
              <svg className="pp-nav-svg" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <rect x="2.5" y="3" width="11" height="10" rx="2" stroke="currentColor" strokeWidth="1.4" />
                <path d="M5.5 6.5h5M5.5 9.5h3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              <span>Recent Conversations</span>
            </button>
            <button
              type="button"
              className={`pp-nav-item ${activeNav === 'saved' ? 'is-active' : ''}`}
              onClick={() => setActiveNav('saved')}
            >
              <svg className="pp-nav-svg" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d="M4 2.5h8a1 1 0 0 1 1 1v10l-5-3-5 3v-10a1 1 0 0 1 1-1Z"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinejoin="round"
                />
              </svg>
              <span>Saved Prompts</span>
            </button>
          </nav>

          <nav className="pp-nav-group" aria-label="Account">
            <span className="pp-nav-label">ACCOUNT</span>
            <button
              type="button"
              className={`pp-nav-item ${activeNav === 'history' ? 'is-active' : ''}`}
              onClick={() => setActiveNav('history')}
            >
              <svg className="pp-nav-svg" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d="M3 8a5 5 0 1 1 1.46 3.54M3 8V5m0 3h3"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>Prompt History</span>
            </button>
          </nav>
        </div>

        {/* Bottom Account Trigger + Popover Menu (Settings & Sign out) */}
        <div className="pp-sidebar-bottom" ref={accountMenuRef}>
          {accountMenuOpen && (
            <div className="pp-account-popover" role="menu" aria-label="Account options">
              <button
                type="button"
                role="menuitem"
                className={`pp-popover-item ${activeNav === 'settings' ? 'is-current' : ''}`}
                onClick={() => {
                  setActiveNav('settings');
                  setAccountMenuOpen(false);
                }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.4" />
                  <path
                    d="M8 2v1.5M8 12.5V14M2 8h1.5M12.5 8H14M3.8 3.8l1 1M11.2 11.2l1 1M12.2 3.8l-1 1M4.8 11.2l-1 1"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  />
                </svg>
                <span>Settings</span>
              </button>

              <div className="pp-popover-divider" />

              <button
                type="button"
                role="menuitem"
                className="pp-popover-item is-danger"
                onClick={async () => {
                  await logout().catch(() => undefined)
                  setAccountMenuOpen(false)
                  onLogout?.()
                }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path
                    d="M6 2.5H4a1.5 1.5 0 0 0-1.5 1.5v8A1.5 1.5 0 0 0 4 13.5h2M10.5 11l3-3-3-3M13.5 8h-7"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span>Sign out</span>
              </button>
            </div>
          )}

          <button
            type="button"
            className={`pp-account-trigger ${accountMenuOpen ? 'is-open' : ''}`}
            onClick={() => setAccountMenuOpen((prev) => !prev)}
            aria-expanded={accountMenuOpen}
            aria-haspopup="menu"
          >
            <div className="pp-account-badge" aria-hidden="true">
              {picture
                ? <img src={picture} alt="" />
                : <img src={brandMark} alt="" />}
            </div>
            <div className="pp-account-meta">
              <span className="pp-account-name">{username}</span>
              <span className="pp-account-sub">PromptPilot account</span>
            </div>
            <svg
              className="pp-account-chevron"
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M4 10l4-4 4 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </aside>

      {/* Main Content Workspace */}
      <div className="pp-workspace">
        {/* Top Utility Search Bar */}
        <header className="pp-settings-topbar">
          <div className="pp-search-box">
            <svg
              className="pp-search-icon"
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M10.5 10.5L13.5 13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              ref={searchInputRef}
              type="search"
              className="pp-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search your favourite settings..."
              aria-label="Search settings"
            />
            {searchQuery ? (
              <button
                type="button"
                className="pp-search-clear"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
              >
                ×
              </button>
            ) : (
              <kbd className="pp-search-kbd">⌘K</kbd>
            )}
          </div>

          {frequentSettings.length > 0 && !searchQuery && (
            <div className="pp-frequent-settings" aria-label="Frequently accessed settings">
              {frequentSettings.map((setting) => (
                <button
                  key={setting}
                  type="button"
                  onClick={() => setSearchQuery(setting)}
                >
                  {setting}
                </button>
              ))}
            </div>
          )}

          <button type="button" className="pp-help-btn" aria-label="Security and privacy documentation">
            ?
          </button>
        </header>

        {/* Scrollable White Space Body */}
        <div className="pp-settings-scroll">
          <main className="pp-main">
            {/* Editorial Page Header */}
            <div className="pp-page-header">
              <h1 className="pp-page-title">Account &amp; security</h1>
              <p className="pp-page-subtitle">
                Manage your profile, appearance, prompt history, and signed-in devices.
              </p>
            </div>

            {noResults ? (
              <div className="pp-empty-search">
                <p>No settings match “{searchQuery}”.</p>
                <button type="button" className="pp-link-btn" onClick={() => setSearchQuery('')}>
                  Reset filter
                </button>
              </div>
            ) : (
              <div className="pp-settings-grid">
                {/* Left Column: Account & Active Sessions */}
                <div className="pp-settings-left">
                  {/* Account Card */}
                  {visibility.account && (
                    <section className="pp-card" aria-labelledby="account-card-heading">
                      <span id="account-card-heading" className="pp-eyebrow">
                        ACCOUNT
                      </span>

                      <div className="pp-setting-row">
                        <div className="pp-setting-info">
                          <span className="pp-field-label">Email address</span>
                          <div className="pp-field-value">{email || 'Signed-in account'}</div>
                        </div>
                        <span className="pp-verified-tag">Verified</span>
                      </div>

                      <div className="pp-divider" />

                      <div className="pp-setting-row">
                        <div className="pp-setting-info">
                          <span className="pp-field-label">Username</span>
                          <div className="pp-field-value">{username}</div>
                        </div>
                        <button
                          type="button"
                          className="pp-pill-btn"
                          onClick={() => {
                            setUsernameInput(username)
                            setIsChangingUsername((prev) => !prev)
                            recordFrequentSetting('Username')
                          }}
                        >
                          {isChangingUsername ? 'Cancel' : 'Edit'}
                        </button>
                      </div>

                      {isChangingUsername && (
                        <form
                          className="pp-password-drawer"
                          onSubmit={async (event) => {
                            event.preventDefault()
                            try {
                              const result = await updateUsername(usernameInput)
                              setUsername(result.user.username)
                              onUsernameChanged?.(result.user.username)
                              setIsChangingUsername(false)
                            } catch (error) {
                              window.alert(error instanceof Error ? error.message : 'Username could not be changed.')
                            }
                          }}
                        >
                          <label className="pp-input-label">
                            <span>New username</span>
                            <input
                              type="text"
                              className="pp-text-input"
                              value={usernameInput}
                              minLength={3}
                              maxLength={50}
                              onChange={(event) => setUsernameInput(event.target.value)}
                              required
                            />
                          </label>
                          <div className="pp-drawer-actions">
                            <button type="submit" className="pp-dark-btn">Save username</button>
                          </div>
                        </form>
                      )}

                      <div className="pp-divider" />

                      {/* Profile Picture Row with Upload, Resize & Delete */}
                      <div className="pp-profile-picture-row">
                        <div className="pp-profile-picture-preview">
                          {picture
                            ? <img src={picture} alt="Current profile" />
                            : <img src={brandMark} alt="" />}
                        </div>
                        <div className="pp-setting-info">
                          <span className="pp-field-label">Profile picture</span>
                          <strong className="pp-field-value-sm">
                            {picture ? 'Custom avatar active' : 'Default workspace mark'}
                          </strong>
                          <span className="pp-field-hint">PNG, JPG or WebP · Resize &amp; crop before saving</span>
                        </div>
                        <input
                          ref={pictureInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          hidden
                          onChange={handleSelectPictureFile}
                        />
                        <div className="pp-picture-actions">
                          <button
                            type="button"
                            className="pp-pill-btn"
                            onClick={() => pictureInputRef.current?.click()}
                          >
                            {picture ? 'Change' : 'Upload'}
                          </button>
                          {picture && (
                            <button
                              type="button"
                              className="pp-pill-btn is-danger"
                              onClick={handleRemovePicture}
                              aria-label="Remove profile picture"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="pp-divider" />

                      <div className="pp-setting-row">
                        <div className="pp-setting-info">
                          <span className="pp-field-label">Password</span>
                          <span className="pp-password-dots" aria-label="Password hidden">
                            ••••••••••••
                          </span>
                        </div>
                        <button
                          type="button"
                          className="pp-pill-btn"
                          onClick={() => setIsChangingPassword((prev) => !prev)}
                        >
                          {isChangingPassword ? 'Cancel' : 'Change'}
                        </button>
                      </div>

                      {passwordSavedToast && (
                        <div className="pp-inline-notice is-success" role="status">
                          Password updated successfully.
                        </div>
                      )}

                      {isChangingPassword && (
                        <form className="pp-password-drawer" onSubmit={handlePasswordSubmit}>
                          <div className="pp-drawer-fields">
                            <label className="pp-input-label">
                              <span>Current password</span>
                              <input
                                type="password"
                                className="pp-text-input"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                placeholder="Enter current password"
                                required
                              />
                            </label>
                            <label className="pp-input-label">
                              <span>New password</span>
                              <input
                                type="password"
                                className="pp-text-input"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Minimum 10 characters"
                                minLength={8}
                                required
                              />
                            </label>
                          </div>
                          <div className="pp-drawer-actions">
                            <button type="submit" className="pp-dark-btn">
                              Update password
                            </button>
                          </div>
                        </form>
                      )}
                    </section>
                  )}

                  {/* Active Sessions Card */}
                  {visibility.sessions && (
                    <section className="pp-card" aria-labelledby="sessions-card-heading">
                      <span id="sessions-card-heading" className="pp-eyebrow">
                        ACTIVE SESSIONS
                      </span>
                      <p className="pp-card-lead">Devices currently signed in to your account.</p>

                      <ul className="pp-session-list">
                        {sessions.map((device) => (
                          <li key={device.id} className="pp-session-row">
                            <div className="pp-session-left">
                              <div
                                className={`pp-device-badge ${device.isCurrent ? 'is-primary' : 'is-secondary'}`}
                                aria-hidden="true"
                              >
                                {device.badge}
                              </div>
                              <div>
                                <div className="pp-device-name">{device.name}</div>
                                <div className="pp-device-sub">{device.subtitle}</div>
                              </div>
                            </div>

                            <div className="pp-session-right">
                              <span className="pp-active-pill">ACTIVE</span>
                              <span className="pp-expiry-text">{device.expiresIn}</span>
                              {!device.isCurrent && (
                                <button
                                  type="button"
                                  className="pp-revoke-btn"
                                  onClick={() => handleRevokeSession(device.id)}
                                  title={`Sign out ${device.name}`}
                                >
                                  End
                                </button>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>

                      <div className="pp-session-footer">
                        <span className="pp-muted-caption">
                          End individual sessions or sign out everywhere.
                        </span>
                        {sessions.length > 1 && (
                          <button
                            type="button"
                            className="pp-subtle-text-btn"
                            onClick={handleSignOutOthers}
                          >
                            Sign out other devices
                          </button>
                        )}
                      </div>
                    </section>
                  )}
                </div>

                {/* Right Column: Appearance, Privacy & History Card */}
                {visibility.privacy && (
                  <aside className="pp-card pp-privacy-card" aria-labelledby="privacy-card-heading">
                    <span id="privacy-card-heading" className="pp-eyebrow">
                      APPEARANCE &amp; PRIVACY
                    </span>

                    <div className="pp-theme-block">
                      <div>
                        <h2 className="pp-section-heading">Theme</h2>
                        <p className="pp-body-copy">Choose how PromptPilot looks on this device.</p>
                      </div>

                      <div className="pp-theme-segmented" role="radiogroup" aria-label="Theme">
                        <span
                          className="pp-theme-glider"
                          style={{ transform: `translateX(${themeIndex * 100}%)` }}
                          aria-hidden="true"
                        />
                        {([
                          { id: 'light', label: 'Light' },
                          { id: 'dark', label: 'Dark' },
                          { id: 'system', label: 'System' },
                        ] as const).map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            role="radio"
                            aria-checked={theme === option.id}
                            className={`pp-theme-option ${theme === option.id ? 'is-selected' : ''}`}
                            onClick={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              onThemeChanged?.(option.id, {
                                x: rect.left + rect.width / 2,
                                y: rect.top + rect.height / 2,
                              });
                            }}
                          >
                            {option.id === 'light' && (
                              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                                <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.4" />
                                <path d="M8 1.8v1.4M8 12.8v1.4M1.8 8h1.4M12.8 8h1.4M3.6 3.6l1 1M11.4 11.4l1 1M12.4 3.6l-1 1M4.6 11.4l-1 1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                              </svg>
                            )}
                            {option.id === 'dark' && (
                              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                                <path d="M13.2 10.2A5.5 5.5 0 0 1 5.8 2.8a5.5 5.5 0 1 0 7.4 7.4Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                              </svg>
                            )}
                            {option.id === 'system' && (
                              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                                <rect x="2.2" y="3" width="11.6" height="7.8" rx="1.6" stroke="currentColor" strokeWidth="1.4" />
                                <path d="M5.5 13h5M8 10.8V13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                              </svg>
                            )}
                            <span>{option.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="pp-privacy-title-row">
                      <h2 className="pp-section-heading">Prompt history</h2>
                      <button
                        type="button"
                        className={`pp-state-pill ${historyEnabled ? 'is-on' : 'is-off'}`}
                        onClick={() => {
                          const enabled = !historyEnabled
                          setHistoryEnabled(enabled)
                          recordFrequentSetting('Prompt history')
                          void updatePromptHistory(enabled, Number(retentionDays)).catch(() => setHistoryEnabled(!enabled))
                        }}
                        aria-pressed={historyEnabled}
                      >
                        {historyEnabled ? 'ON' : 'OFF'}
                      </button>
                    </div>

                    <p className="pp-body-copy">
                      Recent prompts and conversations sync to your account while history is enabled.
                    </p>

                    <div className="pp-retention-block">
                      <label htmlFor="retention-select" className="pp-eyebrow-muted">
                        RETENTION
                      </label>
                      <div className="pp-select-wrap">
                        <select
                          id="retention-select"
                          className="pp-select"
                          value={retentionDays}
                          onChange={(e) => {
                            setRetentionDays(e.target.value)
                            recordFrequentSetting('Retention')
                            void updatePromptHistory(historyEnabled, Number(e.target.value)).catch(() => undefined)
                          }}
                          disabled={!historyEnabled}
                        >
                          <option value="7">7 days</option>
                          <option value="30">30 days</option>
                          <option value="90">90 days</option>
                        </select>
                        <svg
                          className="pp-select-chevron"
                          width="14"
                          height="14"
                          viewBox="0 0 16 16"
                          fill="none"
                          aria-hidden="true"
                        >
                          <path
                            d="M4 6l4 4 4-4"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                    </div>

                    <div className="pp-saved-files-block">
                      <h3 className="pp-sub-heading">Saved prompt files</h3>
                      <p className="pp-body-copy">
                        Saved <code>.txt</code> files stay in your library until you delete them.
                      </p>
                    </div>

                    <div className="pp-privacy-actions">
                      <button
                        type="button"
                        className="pp-outline-action-btn"
                        onClick={() => {
                          const enabled = !historyEnabled
                          setHistoryEnabled(enabled)
                          recordFrequentSetting('Prompt history')
                          void updatePromptHistory(enabled, Number(retentionDays)).catch(() => setHistoryEnabled(!enabled))
                        }}
                      >
                        {historyEnabled ? 'Turn off prompt history' : 'Turn on prompt history'}
                      </button>

                      <button
                        type="button"
                        className={`pp-danger-soft-btn ${confirmClearHistory ? 'is-confirming' : ''}`}
                        onClick={handleClearRecentHistory}
                      >
                        {confirmClearHistory ? 'Click again to confirm clear' : 'Clear recent history'}
                      </button>

                      <button type="button" className="pp-outline-action-btn" onClick={handleDownloadHistory}>
                        Download history as .txt
                      </button>

                      {confirmDelete ? (
                        <form
                          className="pp-password-drawer"
                          onSubmit={async (event) => {
                            event.preventDefault()
                            try {
                              await deleteAccount(deletePassword)
                              onLogout?.()
                            } catch (error) {
                              window.alert(error instanceof Error ? error.message : 'Account could not be deleted.')
                            }
                          }}
                        >
                          <label className="pp-input-label">
                            <span>Enter password to confirm deletion</span>
                            <input
                              type="password"
                              className="pp-text-input"
                              value={deletePassword}
                              onChange={(event) => setDeletePassword(event.target.value)}
                              required
                            />
                          </label>
                          <div className="pp-drawer-actions">
                            <button type="submit" className="pp-danger-soft-btn">Delete account permanently</button>
                          </div>
                        </form>
                      ) : (
                        <button
                          type="button"
                          className="pp-danger-soft-btn"
                          onClick={() => setConfirmDelete(true)}
                        >
                          Delete account
                        </button>
                      )}
                    </div>

                    {historyClearedToast && (
                      <div className="pp-inline-notice is-neutral" role="status">
                        Recent prompt history cleared.
                      </div>
                    )}

                    <div className="pp-security-footnotes">
                      <p>
                        Access tokens refresh silently when valid.
                        <br />
                        Refresh cookies remain HttpOnly and Secure.
                      </p>
                      <p className="pp-footnote-secondary">Manage sign-out from Active Sessions.</p>
                    </div>
                  </aside>
                )}
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Interactive Image Crop & Resize Modal */}
      {cropDraftSrc && (
        <div
          className="pp-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="crop-modal-title"
          onClick={() => setCropDraftSrc(null)}
        >
          <div className="pp-crop-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pp-crop-header">
              <div>
                <span className="pp-eyebrow">ADJUST AVATAR</span>
                <h2 id="crop-modal-title" className="pp-section-heading">Resize &amp; frame your photo</h2>
              </div>
              <button
                type="button"
                className="pp-help-btn"
                onClick={() => setCropDraftSrc(null)}
                aria-label="Close image editor"
              >
                ×
              </button>
            </div>

            <div
              className="pp-crop-stage"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                dragOriginRef.current = {
                  startX: e.clientX,
                  startY: e.clientY,
                  origX: cropOffset.x,
                  origY: cropOffset.y,
                };
              }}
              onPointerMove={(e) => {
                if (!dragOriginRef.current) return;
                const nextX = dragOriginRef.current.origX + (e.clientX - dragOriginRef.current.startX);
                const nextY = dragOriginRef.current.origY + (e.clientY - dragOriginRef.current.startY);
                setCropOffset(clampCropOffset(nextX, nextY, cropZoom));
              }}
              onPointerUp={() => {
                dragOriginRef.current = null;
              }}
            >
              <img
                ref={cropImageRef}
                src={cropDraftSrc}
                alt="Crop preview"
                draggable={false}
                style={{
                  width: `${cropNaturalSize.w * cropBaseScale * cropZoom}px`,
                  height: `${cropNaturalSize.h * cropBaseScale * cropZoom}px`,
                  transform: `translate(calc(-50% + ${cropOffset.x}px), calc(-50% + ${cropOffset.y}px))`,
                }}
              />
              <div className="pp-crop-frame-ring" aria-hidden="true" />
            </div>

            <p className="pp-crop-hint">Drag image to reposition · Use slider to zoom</p>

            <label className="pp-zoom-control">
              <span>Zoom</span>
              <input
                type="range"
                min={1}
                max={2.6}
                step={0.02}
                value={cropZoom}
                onChange={(e) => {
                  const nextZoom = Number(e.target.value);
                  setCropZoom(nextZoom);
                  setCropOffset((prev) => clampCropOffset(prev.x, prev.y, nextZoom));
                }}
              />
              <span className="pp-zoom-value">{Math.round(cropZoom * 100)}%</span>
            </label>

            <div className="pp-crop-actions">
              <button
                type="button"
                className="pp-pill-btn"
                onClick={() => setCropDraftSrc(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="pp-dark-btn"
                onClick={handleApplyCroppedPicture}
              >
                Save picture
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PromptPilotSettings;