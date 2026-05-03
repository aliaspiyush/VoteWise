import { useState } from 'react';
import { useApp } from '../context';
import ElectionTimeline from '../components/ElectionTimeline';
import ChatPanel from '../components/ChatPanel';
import VoterChecklist from '../components/VoterChecklist';
import './Dashboard.css';

type Tab = 'timeline' | 'chat' | 'checklist';
type RightTab = 'chat' | 'checklist';

const MOBILE_TABS: { id: Tab; label: string }[] = [
  { id: 'timeline',  label: 'Timeline'  },
  { id: 'chat',      label: 'Ask AI'    },
  { id: 'checklist', label: 'Checklist' },
];

export default function Dashboard() {
  const { session } = useApp();
  const [mobileTab, setMobileTab] = useState<Tab>('timeline');
  const [rightTab, setRightTab] = useState<RightTab>('chat');

  // Desktop: right panel driven by rightTab
  // Mobile:  right panel driven by mobileTab ('chat' or 'checklist')
  const showChat      = mobileTab === 'chat'      || (mobileTab === 'timeline' && rightTab === 'chat');
  const showChecklist = mobileTab === 'checklist' || (mobileTab === 'timeline' && rightTab === 'checklist');

  return (
    <main className="dashboard" aria-label="VoteWise Dashboard">

      {/* ── Mobile tabs ─────────────────────────────────────────── */}
      <nav className="mobile-tabs" aria-label="Dashboard sections">
        {MOBILE_TABS.map(tab => (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            className={`tab-btn ${mobileTab === tab.id ? 'active' : ''}`}
            onClick={() => setMobileTab(tab.id)}
            aria-selected={mobileTab === tab.id}
            role="tab"
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* ── Desktop split / mobile single ───────────────────────── */}
      <div className="dashboard-layout">

        {/* Left: Timeline */}
        <aside
          className={`timeline-col ${mobileTab !== 'timeline' ? 'mobile-hide' : ''}`}
          aria-label="Election timeline"
        >
          <ElectionTimeline state={session?.userState || 'General'} />
        </aside>

        {/* Right: Chat + Checklist */}
        <section
          className={`right-col ${mobileTab === 'timeline' ? 'mobile-hide' : ''}`}
          aria-label="Chat and tools"
        >
          {/* Desktop tab switcher */}
          <div className="right-tab-row">
            <button
              id="right-tab-chat"
              className={`right-tab ${rightTab === 'chat' ? 'active' : ''}`}
              onClick={() => { setRightTab('chat'); setMobileTab('chat'); }}
            >
              Ask VoteWise
            </button>
            <button
              id="right-tab-checklist"
              className={`right-tab ${rightTab === 'checklist' ? 'active' : ''}`}
              onClick={() => { setRightTab('checklist'); setMobileTab('checklist'); }}
            >
              My Checklist
            </button>
          </div>

          {/* Panels — always mounted so chat history survives tab switches */}
          <div className="right-panel-body">
            <div className={`panel-slot ${showChat ? 'panel-visible' : 'panel-hidden'}`}>
              <ChatPanel
                userState={session?.userState}
                isFirstTime={session?.isFirstTime}
              />
            </div>
            <div className={`panel-slot ${showChecklist ? 'panel-visible' : 'panel-hidden'}`}>
              <VoterChecklist
                state={session?.userState || ''}
                voterType={session?.isFirstTime ? 'first-time' : 'regular'}
              />
            </div>
          </div>
        </section>

      </div>
    </main>
  );
}
