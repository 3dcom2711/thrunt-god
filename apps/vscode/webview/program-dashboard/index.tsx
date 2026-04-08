import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import type {
  HostToProgramDashboardMessage,
  ProgramDashboardToHostMessage,
  ProgramDashboardViewModel,
  CaseCard as CaseCardType,
} from '../../shared/program-dashboard';
import { Panel, StatCard, GhostButton, Badge } from '../shared/components';
import { useTheme, useHostMessage, createVsCodeApi } from '../shared/hooks';
import '../shared/tokens.css';

const vscode = createVsCodeApi<unknown, ProgramDashboardToHostMessage>();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusVariant(status: CaseCardType['status']): 'success' | 'default' | 'warning' {
  switch (status) {
    case 'active':
      return 'success';
    case 'closed':
      return 'default';
    case 'stale':
      return 'warning';
  }
}

function statusLabel(status: CaseCardType['status']): string {
  switch (status) {
    case 'active':
      return 'Active';
    case 'closed':
      return 'Closed';
    case 'stale':
      return 'Stale';
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CaseCardComponent({ card }: { card: CaseCardType }) {
  return (
    <Panel>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: '8px',
        }}
      >
        <strong style={{ fontSize: '15px' }}>{card.name}</strong>
        <Badge variant={statusVariant(card.status)}>{statusLabel(card.status)}</Badge>
      </div>
      <div style={{ marginTop: '6px', fontSize: '13px', color: 'var(--hunt-text-muted)' }}>
        {card.signal}
      </div>
      <div
        style={{
          marginTop: '10px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          fontSize: '12px',
          color: 'var(--hunt-text-muted)',
        }}
      >
        <span>
          <span
            style={{
              display: 'block',
              fontSize: '11px',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            Opened
          </span>
          <span style={{ display: 'block', marginTop: '2px' }}>{card.openedAt}</span>
        </span>
        <span>
          <span
            style={{
              display: 'block',
              fontSize: '11px',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            Phase
          </span>
          <span style={{ display: 'block', marginTop: '2px' }}>
            {card.totalPhases > 0
              ? `${card.currentPhase}/${card.totalPhases}`
              : 'N/A'}
            {card.phaseName ? ` - ${card.phaseName}` : ''}
          </span>
        </span>
        <span>
          <span
            style={{
              display: 'block',
              fontSize: '11px',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            Techniques
          </span>
          <span style={{ display: 'block', marginTop: '2px' }}>{card.techniqueCount}</span>
        </span>
        <span>
          <span
            style={{
              display: 'block',
              fontSize: '11px',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            Last Activity
          </span>
          <span style={{ display: 'block', marginTop: '2px' }}>{card.lastActivity}</span>
        </span>
      </div>
      <div style={{ marginTop: '12px' }}>
        <GhostButton
          onClick={() => vscode.postMessage({ type: 'case:open', slug: card.slug })}
          ariaLabel={`Open case ${card.name}`}
        >
          Open Case
        </GhostButton>
      </div>
    </Panel>
  );
}

function AggregateStats({ aggregates }: { aggregates: ProgramDashboardViewModel['aggregates'] }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: '10px',
      }}
    >
      <StatCard label="Total Cases" value={String(aggregates.total)} />
      <StatCard label="Active" value={String(aggregates.active)} />
      <StatCard label="Closed" value={String(aggregates.closed)} />
      <StatCard label="Stale" value={String(aggregates.stale)} />
      <StatCard label="Techniques" value={String(aggregates.uniqueTechniques)} />
    </div>
  );
}

function TimelineSection({ timeline }: { timeline: ProgramDashboardViewModel['timeline'] }) {
  if (timeline.length === 0) {
    return null;
  }

  return (
    <Panel>
      <p class="hunt-section-heading">Timeline</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {timeline.map((entry, index) => (
          <div
            key={index}
            style={{
              display: 'flex',
              gap: '12px',
              fontSize: '13px',
              padding: '4px 0',
              borderBottom: '1px solid var(--hunt-border)',
            }}
          >
            <span style={{ color: 'var(--hunt-text-muted)', minWidth: '90px' }}>
              {entry.date}
            </span>
            <span>{entry.event}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Main App
// ---------------------------------------------------------------------------

function ProgramDashboard() {
  const { setIsDark } = useTheme();
  const [viewModel, setViewModel] = useState<ProgramDashboardViewModel | null>(null);

  useEffect(() => {
    vscode.postMessage({ type: 'webview:ready' });
  }, []);

  useHostMessage<HostToProgramDashboardMessage>((message) => {
    switch (message.type) {
      case 'init':
        setViewModel(message.viewModel);
        setIsDark(message.isDark);
        break;
      case 'update':
        setViewModel(message.viewModel);
        break;
      case 'theme':
        setIsDark(message.isDark);
        break;
    }
  });

  return (
    <main
      class="hunt-surface"
      style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '24px 18px',
        color: 'var(--hunt-text)',
      }}
    >
      {viewModel === null ? (
        <Panel>
          <p style={{ color: 'var(--hunt-text-muted)', margin: 0 }}>
            Connecting to extension host...
          </p>
        </Panel>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          {/* Header: program name + mission snippet */}
          <div>
            <h1
              style={{
                fontSize: 'clamp(1.3rem, 2.2vw, 2rem)',
                lineHeight: 1.15,
                margin: 0,
              }}
            >
              {viewModel.programName}
            </h1>
            {viewModel.missionSnippet && (
              <p
                style={{
                  marginTop: '8px',
                  color: 'var(--hunt-text-muted)',
                  fontSize: '14px',
                  lineHeight: 1.5,
                }}
              >
                {viewModel.missionSnippet}
              </p>
            )}
          </div>

          {/* Aggregate stats row */}
          <AggregateStats aggregates={viewModel.aggregates} />

          {/* Cases grid or empty state */}
          {viewModel.cases.length === 0 ? (
            <Panel>
              <p style={{ color: 'var(--hunt-text-muted)', margin: 0 }}>
                No cases yet. Create one with <code>thrunt case new &lt;name&gt;</code>.
              </p>
            </Panel>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
                gap: '14px',
              }}
            >
              {viewModel.cases.map((card) => (
                <CaseCardComponent key={card.slug} card={card} />
              ))}
            </div>
          )}

          {/* Timeline section */}
          <TimelineSection timeline={viewModel.timeline} />
        </div>
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------
// Mount
// ---------------------------------------------------------------------------

const root = document.getElementById('root');
if (root) {
  render(<ProgramDashboard />, root);
}
