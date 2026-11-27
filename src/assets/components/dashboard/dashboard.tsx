import React, { useEffect, useMemo, useRef, useState } from 'react';
import './dashboard.css';
import { logout } from '../services/authApi';
import brandMark from '../../../Logos/pagelogo2.png';

type AgentType = 'Coding' | 'Research' | 'Image';

interface StarterTemplate {
  id: string;
  label: string;
  dotColor: 'indigo' | 'sky' | 'emerald';
  agent: AgentType;
  sampleText: string;
}

interface AnatomySignal {
  key: 'role' | 'task' | 'context' | 'format';
  label: string;
  detected: boolean;
  detail: string;
  quickFix?: string;
}

const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: 'coding',
    label: 'Coding',
    dotColor: 'indigo',
    agent: 'Coding',
    sampleText:
      'I want to build a clean, modern landing page for my new budgeting app. It should explain the value clearly, show pricing, and feel trustworthy. I also want it to work really well on mobile.',
  },
  {
    id: 'research',
    label: 'Research',
    dotColor: 'sky',
    agent: 'Research',
    sampleText:
      'Act as a principal product strategist. Synthesize the top five competitive advantages of local-first web applications in 2026, comparing latency, offline reliability, and privacy in a structured executive brief.',
  },
  {
    id: 'image',
    label: 'Image idea',
    dotColor: 'emerald',
    agent: 'Image',
    sampleText:
      'Editorial architectural photography of a sunlit minimalist study with warm walnut shelving, raw linen textures, and soft morning shadows, shot on 35mm medium format film.',
  },
];

const AGENT_SUGGESTIONS: Record<AgentType, { subtitle: string; badge: string }> = {
  Coding: {
    subtitle: 'Best suited for UI architecture, components & responsive code',
    badge: 'Frontend & Systems',
  },
  Research: {
    subtitle: 'Best suited for synthesis, trade-off matrices & deep briefs',
    badge: 'Analysis & Strategy',
  },
  Image: {
    subtitle: 'Best suited for art direction, lighting & composition prompts',
    badge: 'Visual Direction',
  },
};

type DashboardProps = {
  username?: string;
  onLogout?: () => void;
  onOpenSettings?: () => void;
  onOpenDashboard?: () => void;
  profilePicture?: string;
};

export const PromptPilotDashboard: React.FC<DashboardProps> = ({ username = 'there', onLogout, onOpenSettings, profilePicture = '' }) => {
  const [activeNav, setActiveNav] = useState<string>('new-prompt');
  const [showAccountMenu, setShowAccountMenu] = useState<boolean>(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const [ideaText, setIdeaText] = useState<string>(STARTER_TEMPLATES[0].sampleText);
  const [previousDraft, setPreviousDraft] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState<boolean>(false);
  const [selectedAgentOverride, setSelectedAgentOverride] = useState<AgentType | null>(null);
  const [generatedPrompt, setGeneratedPrompt] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (!showAccountMenu) return

    const handlePointerDown = (event: PointerEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) {
        setShowAccountMenu(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowAccountMenu(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [showAccountMenu])

  // Live Prompt Anatomy & Agent Detection
  const { signals, detectedAgent, readinessCount } = useMemo(() => {
    const normalized = ideaText.trim().toLowerCase();

    const hasRole =
      /\b(act as|you are|as a|role:|designer|engineer|developer|strategist|copywriter|architect|photographer|expert|analyst)\b/.test(
        normalized
      );
    const hasTask =
      normalized.length > 12 &&
      /\b(build|create|write|design|synthesize|explain|generate|make|draft|audit|compare|show|develop|photograph)\b/.test(
        normalized
      );
    const hasContext =
      normalized.length > 35 &&
      /\b(for|because|app|product|audience|users|trustworthy|pricing|2026|latency|privacy|study|minimalist|value|budgeting)\b/.test(
        normalized
      );
    const hasFormat =
      /\b(landing page|mobile|brief|table|list|json|code|component|photography|photograph|shot on|35mm|essay|markdown|step-by-step|summary)\b/.test(
        normalized
      );

    let inferredAgent: AgentType = 'Coding';
    if (
      /\b(photograph|photo|illustration|render|lighting|sunlit|editorial|35mm|film|visual|portrait|3d|cinematic|textures)\b/.test(
        normalized
      )
    ) {
      inferredAgent = 'Image';
    } else if (
      /\b(synthesize|analyze|compare|advantages|study|market|trends|report|strategist|brief|research)\b/.test(
        normalized
      )
    ) {
      inferredAgent = 'Research';
    }

    const items: AnatomySignal[] = [
      {
        key: 'role',
        label: 'Role',
        detected: hasRole,
        detail: hasRole ? 'Persona & perspective defined' : 'Optional · Sharpen voice with a persona',
        quickFix: 'Act as a senior product designer and conversion copywriter. ',
      },
      {
        key: 'task',
        label: 'Task',
        detected: hasTask,
        detail: hasTask ? 'Core deliverable identified' : 'Describe what you want created',
      },
      {
        key: 'context',
        label: 'Context',
        detected: hasContext,
        detail: hasContext ? 'Audience, tone & intent captured' : 'Add who this is for or why it matters',
      },
      {
        key: 'format',
        label: 'Format',
        detected: hasFormat,
        detail: hasFormat ? 'Medium & constraints specified' : 'Specify layout, length, or medium',
      },
    ];

    return {
      signals: items,
      detectedAgent: inferredAgent,
      readinessCount: items.filter((i) => i.detected).length,
    };
  }, [ideaText]);

  const activeAgent = selectedAgentOverride ?? detectedAgent;

  const handleTemplateSelect = (template: StarterTemplate) => {
    const isCustomUserText =
      ideaText.trim().length > 0 &&
      !STARTER_TEMPLATES.some((t) => t.sampleText.trim() === ideaText.trim());

    if (isCustomUserText) {
      setPreviousDraft(ideaText);
    } else {
      setPreviousDraft(null);
    }

    setIdeaText(template.sampleText);
    setSelectedAgentOverride(null);
    setGeneratedPrompt(null);
  };

  const handleUndoTemplate = () => {
    if (previousDraft !== null) {
      setIdeaText(previousDraft);
      setPreviousDraft(null);
    }
  };

  const handleApplyQuickRole = (prefix: string) => {
    setIdeaText((prev) => `${prefix}${prev.trimStart()}`);
  };

  const handleClear = () => {
    setPreviousDraft(ideaText.trim() ? ideaText : null);
    setIdeaText('');
    setGeneratedPrompt(null);
    setSelectedAgentOverride(null);
  };

  const handleGenerate = () => {
    const raw = ideaText.trim();
    if (!raw) return;

    setIsGenerating(true);
    setCopied(false);

    setTimeout(() => {
      const roleLine = signals.find((s) => s.key === 'role')?.detected
        ? 'Derived directly from your specified persona.'
        : activeAgent === 'Coding'
          ? 'Act as a senior frontend architect and product designer.'
          : activeAgent === 'Research'
            ? 'Act as a principal research analyst and executive strategist.'
            : 'Act as an editorial art director and commercial photographer.';

      const structured = [
        `### ROLE`,
        roleLine,
        ``,
        `### OBJECTIVE & CONTEXT`,
        raw,
        ``,
        `### EXECUTION REQUIREMENTS (${activeAgent.toUpperCase()} AGENT)`,
        activeAgent === 'Coding'
          ? `- Deliver clean, semantic, responsive code with clear visual hierarchy.\n- Prioritize mobile ergonomics, scannable value propositions, and trustworthy UI patterns.`
          : activeAgent === 'Research'
            ? `- Structure findings with clear headings, evidence-backed trade-offs, and concise takeaways.\n- Avoid filler; highlight actionable strategic implications.`
            : `- Specify lens choice, natural lighting direction, material textures, and color palette.\n- Maintain editorial restraint and realistic depth of field.`,
      ].join('\n');

      setGeneratedPrompt(structured);
      setIsGenerating(false);
    }, 320);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleGenerate();
    }
  };

  const handleCopyPrompt = async () => {
    if (!generatedPrompt) return;
    try {
      await navigator.clipboard.writeText(generatedPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSaveTxt = () => {
    if (!generatedPrompt) return;
    const blob = new Blob([generatedPrompt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `promptpilot-${activeAgent.toLowerCase()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="pp-layout">
      {/* Left Navigation Rail */}
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
              onClick={() => setActiveNav('new-prompt')}
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

        {/* Bottom Account Trigger + Popover Menu (Matched with Settings) */}
        <div className="pp-sidebar-bottom" ref={accountMenuRef}>
          {showAccountMenu && (
            <div className="pp-account-popover" role="menu" aria-label="Account options">
              <button
                type="button"
                role="menuitem"
                className="pp-popover-item"
                onClick={() => {
                  setActiveNav('settings')
                  setShowAccountMenu(false)
                  onOpenSettings?.()
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
            className={`pp-account-trigger ${showAccountMenu ? 'is-open' : ''}`}
            aria-expanded={showAccountMenu}
            aria-haspopup="menu"
            onClick={() => setShowAccountMenu((visible) => !visible)}
          >
            <span className="pp-account-badge">
              {profilePicture ? <img src={profilePicture} alt="" /> : <img src={brandMark} alt="" />}
            </span>
            <span className="pp-account-meta">
              <strong className="pp-account-name">{username}</strong>
              <small className="pp-account-sub">PromptPilot account</small>
            </span>
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

      {/* Main Warm Editorial Canvas */}
      <div className="pp-workspace">
        <main className="pp-main">
          {/* Streamlined Header Row */}
          <header className="pp-header-row">
            <div>
              <h1 className="pp-greeting">Good morning, {username}</h1>
              <p className="pp-subtitle">What would you like to make clearer today?</p>
            </div>

            <div className="pp-header-controls">
              <div className="pp-help-wrap">
                <button
                  type="button"
                  className="pp-help-btn"
                  onClick={() => setShowHelp(!showHelp)}
                  aria-expanded={showHelp}
                  aria-label="Workspace shortcuts and tips"
                >
                  ?
                </button>
                {showHelp && (
                  <div className="pp-help-popover">
                    <div className="pp-help-title">Studio Shortcuts</div>
                    <ul className="pp-help-list">
                      <li>
                        <span>Structure prompt</span>
                        <kbd>⌘ + Enter</kbd>
                      </li>
                      <li>
                        <span>Live anatomy</span>
                        <span>Updates as you type</span>
                      </li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* Two-Column Studio Grid */}
          <div className="pp-grid">
            {/* Left Composer Column */}
            <div className="pp-primary-column">
              <section className="pp-card pp-editor-card" aria-labelledby="editor-heading">
                <div className="pp-card-top">
                  <div>
                    <span className="pp-eyebrow">YOUR IDEA</span>
                    <h2 id="editor-heading" className="pp-card-title">
                      Start with what is on your mind.
                    </h2>
                    <p className="pp-card-desc">
                      No special format needed. Describe your rough intent and let PromptPilot structure it.
                    </p>
                  </div>
                </div>

                <div className="pp-textarea-shell">
                  <div className="pp-textarea-bar">
                    <span className="pp-textarea-label">RAW BRIEF</span>
                    {ideaText.length > 0 && (
                      <button type="button" className="pp-clear-btn" onClick={handleClear}>
                        Clear
                      </button>
                    )}
                  </div>

                  <textarea
                    className="pp-textarea"
                    value={ideaText}
                    onChange={(e) => setIdeaText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Describe the outcome you want, who it is for, or any constraints..."
                    rows={6}
                  />

                  <div className="pp-textarea-footer">
                    <span>Your rough thoughts are enough.</span>
                    <span className="pp-char-count">{ideaText.trim().length} chars</span>
                  </div>
                </div>

                {/* Starter Chips & Primary CTA */}
                <div className="pp-controls-row">
                  <div className="pp-starters">
                    <div className="pp-starters-header">
                      <span className="pp-eyebrow-muted">TRY A STARTING POINT</span>
                      {previousDraft !== null && (
                        <button type="button" className="pp-undo-link" onClick={handleUndoTemplate}>
                          Undo overwrite
                        </button>
                      )}
                    </div>
                    <div className="pp-chip-group">
                      {STARTER_TEMPLATES.map((tpl) => {
                        const isCurrent = ideaText.trim() === tpl.sampleText.trim();
                        return (
                          <button
                            key={tpl.id}
                            type="button"
                            className={`pp-chip ${isCurrent ? 'is-selected' : ''}`}
                            onClick={() => handleTemplateSelect(tpl)}
                          >
                            <span className={`pp-chip-dot pp-chip-dot--${tpl.dotColor}`} />
                            <span>{tpl.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    type="button"
                    className="pp-primary-btn"
                    onClick={handleGenerate}
                    disabled={isGenerating || !ideaText.trim()}
                  >
                    <span>{isGenerating ? 'Structuring...' : 'Generate prompt'}</span>
                    <kbd className="pp-btn-kbd">⌘↵</kbd>
                  </button>
                </div>
              </section>

              {/* Tactile Output Card (Revealed on Generate) */}
              {generatedPrompt && (
                <section className="pp-card pp-output-card" aria-label="Structured Prompt Output">
                  <div className="pp-output-header">
                    <div>
                      <span className="pp-eyebrow">STRUCTURED PROMPT</span>
                      <h3 className="pp-output-title">Ready for {activeAgent}</h3>
                    </div>

                    <div className="pp-output-actions">
                      <button type="button" className="pp-secondary-btn" onClick={handleSaveTxt}>
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                          <path
                            d="M8 2.5v7.5m0 0L5 7m3 3 3-3M3 12.5h10"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        <span>Save .txt</span>
                      </button>

                      <button type="button" className="pp-secondary-btn is-accent" onClick={handleCopyPrompt}>
                        <span>{copied ? 'Copied ✓' : 'Copy prompt'}</span>
                      </button>
                    </div>
                  </div>

                  <pre className="pp-output-pre">{generatedPrompt}</pre>
                </section>
              )}
            </div>

            {/* Right Live Prompt Anatomy Card */}
            <aside className="pp-card pp-anatomy-card" aria-labelledby="anatomy-heading">
              <div className="pp-anatomy-header">
                <div>
                  <span className="pp-eyebrow-muted">LIVE PROMPT ANATOMY</span>
                  <h2 id="anatomy-heading" className="pp-guide-title">
                    Structure readiness
                  </h2>
                </div>
                <span className="pp-readiness-badge">{readinessCount}/4 signals</span>
              </div>

              <p className="pp-card-desc">
                Detected automatically as you write so nothing important gets left out.
              </p>

              {/* Live 4-Part Signal Checklist */}
              <ul className="pp-anatomy-list">
                {signals.map((item) => (
                  <li
                    key={item.key}
                    className={`pp-anatomy-item ${item.detected ? 'is-detected' : 'is-missing'}`}
                  >
                    <div className="pp-anatomy-indicator" aria-hidden="true">
                      {item.detected ? '✓' : '○'}
                    </div>
                    <div className="pp-anatomy-body">
                      <div className="pp-anatomy-row">
                        <span className="pp-anatomy-label">{item.label}</span>
                        {!item.detected && item.quickFix && (
                          <button
                            type="button"
                            className="pp-quickfix-btn"
                            onClick={() => handleApplyQuickRole(item.quickFix!)}
                          >
                            + Add role
                          </button>
                        )}
                      </div>
                      <p className="pp-anatomy-detail">{item.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>

              {/* Recommended Target Agent Selector */}
              <div className="pp-agent-box">
                <div className="pp-agent-top">
                  <span className="pp-eyebrow-muted">RECOMMENDED AGENT</span>
                  <span className="pp-agent-tag">{AGENT_SUGGESTIONS[activeAgent].badge}</span>
                </div>

                <div className="pp-agent-pills" role="group" aria-label="Target agent">
                  {(['Coding', 'Research', 'Image'] as AgentType[]).map((agent) => (
                    <button
                      key={agent}
                      type="button"
                      className={`pp-agent-pill ${activeAgent === agent ? 'is-active' : ''}`}
                      onClick={() => setSelectedAgentOverride(agent)}
                    >
                      {agent}
                    </button>
                  ))}
                </div>

                <p className="pp-agent-desc">{AGENT_SUGGESTIONS[activeAgent].subtitle}</p>
              </div>

              {/* Recent Conversation Quick Link */}
              <div className="pp-anatomy-footer">
                <span className="pp-eyebrow-muted">CONTINUE RECENT</span>
                <button
                  type="button"
                  className="pp-recent-link"
                  onClick={() => handleTemplateSelect(STARTER_TEMPLATES[0])}
                >
                  <span>Budgeting app landing page</span>
                  <span className="pp-open-tag">Load →</span>
                </button>
              </div>
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
};

export default PromptPilotDashboard;