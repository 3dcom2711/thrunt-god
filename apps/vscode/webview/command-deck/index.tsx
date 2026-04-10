import { render } from 'preact';
import { useEffect, useState, useCallback } from 'preact/hooks';
import type {
  HostToCommandDeckMessage,
  CommandDeckToHostMessage,
  CommandDef,
  CommandTemplate,
  CommandCategory,
  RecentCommandEntry,
  CommandDeckContext,
} from '../../shared/command-deck';
import { Badge, GhostButton } from '../shared/components';
import { useTheme, useHostMessage, createVsCodeApi } from '../shared/hooks';
import '../shared/tokens.css';

const vscode = createVsCodeApi<unknown, CommandDeckToHostMessage>();

function getRelevantIdsFromContext(context: CommandDeckContext | null): string[] {
  if (!context) return [];
  switch (context.nodeType) {
    case 'phase': return ['run-hunt-phase', 'analyze-huntmap'];
    case 'case': return ['close-case', 'open-evidence-board', 'open-query-analysis'];
    case 'query': return ['open-query-analysis', 'open-evidence-board'];
    case 'receipt': return ['open-evidence-board', 'open-query-analysis'];
    case 'hypothesis': return ['analyze-huntmap', 'open-query-analysis'];
    case 'mission': return ['open-program-dashboard', 'runtime-doctor'];
    case 'huntmap': return ['analyze-huntmap', 'run-hunt-phase'];
    default: return [];
  }
}

function CommandDeckApp() {
  const { setIsDark } = useTheme();
  const [commands, setCommands] = useState<CommandDef[]>([]);
  const [templates, setTemplates] = useState<CommandTemplate[]>([]);
  const [pinned, setPinned] = useState<string[]>([]);
  const [recent, setRecent] = useState<RecentCommandEntry[]>([]);
  const [context, setContext] = useState<CommandDeckContext | null>(null);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [templatePrompt, setTemplatePrompt] = useState<{ templateId: string; placeholders: string[] } | null>(null);

  useEffect(() => {
    vscode.postMessage({ type: 'webview:ready' });
  }, []);

  useHostMessage<HostToCommandDeckMessage>(
    useCallback((message) => {
      switch (message.type) {
        case 'init':
          setCommands(message.commands);
          setTemplates(message.templates);
          setPinned(message.pinned);
          setRecent(message.recent);
          setContext(message.context);
          setIsDark(message.isDark);
          break;
        case 'commands':
          setCommands(message.commands);
          setPinned(message.pinned);
          setRecent(message.recent);
          break;
        case 'context':
          setContext(message.context);
          break;
        case 'templates':
          setTemplates(message.templates);
          break;
        case 'templatePrompt':
          setTemplatePrompt({ templateId: message.templateId, placeholders: message.placeholders });
          break;
        case 'execResult':
          // Brief flash or update recent -- handled by subsequent 'commands' message
          break;
        case 'theme':
          setIsDark(message.isDark);
          break;
      }
    }, [setIsDark])
  );

  const relevantIds = getRelevantIdsFromContext(context);

  if (commands.length === 0) {
    return (
      <main class="cd-root">
        <div class="cd-connecting">
          <span class="cd-connecting__dot" />
          Loading command deck...
        </div>
      </main>
    );
  }

  // Group commands by category
  const categories = ['Investigation', 'Execution', 'Intelligence', 'Maintenance'] as const;
  const pinnedCommands = commands.filter(c => pinned.includes(c.id));

  return (
    <main class="cd-root">
      <header class="cd-header">
        <h1 class="cd-title">Command Deck</h1>
      </header>

      {pinnedCommands.length > 0 && (
        <section class="cd-section">
          <h2 class="cd-section-title">Pinned</h2>
          <div class="cd-grid">
            {pinnedCommands.map(cmd => (
              <CommandCard
                key={cmd.id}
                cmd={cmd}
                isPinned={true}
                isContextRelevant={relevantIds.includes(cmd.id)}
                onExec={() => vscode.postMessage({ type: 'command:exec', commandId: cmd.id })}
                onTogglePin={() => vscode.postMessage({ type: 'command:unpin', commandId: cmd.id })}
              />
            ))}
          </div>
        </section>
      )}

      {categories.map(cat => {
        const catCommands = commands.filter(c => c.category === cat);
        if (catCommands.length === 0) return null;
        return (
          <section key={cat} class="cd-section">
            <h2 class="cd-section-title">{cat}</h2>
            <div class="cd-grid">
              {catCommands.map(cmd => (
                <CommandCard
                  key={cmd.id}
                  cmd={cmd}
                  isPinned={pinned.includes(cmd.id)}
                  isContextRelevant={relevantIds.includes(cmd.id)}
                  onExec={() => vscode.postMessage({ type: 'command:exec', commandId: cmd.id })}
                  onTogglePin={() =>
                    vscode.postMessage(
                      pinned.includes(cmd.id)
                        ? { type: 'command:unpin', commandId: cmd.id }
                        : { type: 'command:pin', commandId: cmd.id }
                    )
                  }
                />
              ))}
            </div>
          </section>
        );
      })}

      {/* Templates section */}
      {templates.length > 0 && (
        <section class="cd-section">
          <h2 class="cd-section-title">Templates</h2>
          <div class="cd-grid">
            {templates.map(tmpl => (
              <div key={tmpl.id} class="cd-card">
                <div class="cd-card__header">
                  <span class="cd-card__label">{tmpl.label}</span>
                  <Badge variant={tmpl.mutating ? 'warning' : 'success'}>
                    {tmpl.mutating ? 'mutating' : 'read-only'}
                  </Badge>
                </div>
                <p class="cd-card__desc">{tmpl.description}</p>
                {tmpl.placeholders.length > 0 && (
                  <p class="cd-card__placeholders">
                    Params: {tmpl.placeholders.map(p => `{${p}}`).join(', ')}
                  </p>
                )}
                <div class="cd-card__actions">
                  <GhostButton
                    onClick={() => {
                      if (tmpl.placeholders.length > 0) {
                        setTemplatePrompt({ templateId: tmpl.id, placeholders: tmpl.placeholders });
                      } else {
                        vscode.postMessage({ type: 'template:exec', templateId: tmpl.id, values: {} });
                      }
                    }}
                    ariaLabel={`Run ${tmpl.label}`}
                  >
                    Run
                  </GhostButton>
                  <GhostButton
                    onClick={() => vscode.postMessage({ type: 'template:delete', templateId: tmpl.id })}
                    ariaLabel={`Delete ${tmpl.label}`}
                  >
                    Delete
                  </GhostButton>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* New Template button */}
      <section class="cd-section">
        <GhostButton onClick={() => setShowTemplateForm(true)} ariaLabel="Create new template">
          + New Template
        </GhostButton>
      </section>

      {showTemplateForm && (
        <TemplateForm onClose={() => setShowTemplateForm(false)} />
      )}

      {templatePrompt && (
        <PlaceholderPrompt
          placeholders={templatePrompt.placeholders}
          onSubmit={(values) => {
            vscode.postMessage({ type: 'template:exec', templateId: templatePrompt.templateId, values });
            setTemplatePrompt(null);
          }}
          onCancel={() => setTemplatePrompt(null)}
        />
      )}

      {recent.length > 0 && (
        <section class="cd-section">
          <h2 class="cd-section-title">Recent</h2>
          <div class="cd-recent-list">
            {recent.map((entry, i) => (
              <div key={i} class="cd-recent-entry">
                <Badge variant={entry.success ? 'success' : 'default'}>
                  {entry.success ? 'OK' : 'FAIL'}
                </Badge>
                <span class="cd-recent-label">{entry.label}</span>
                <span class="cd-recent-time">
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function CommandCard({
  cmd,
  isPinned,
  isContextRelevant,
  onExec,
  onTogglePin,
}: {
  cmd: CommandDef;
  isPinned: boolean;
  isContextRelevant: boolean;
  onExec: () => void;
  onTogglePin: () => void;
}) {
  return (
    <div class={`cd-card${isContextRelevant ? ' cd-card--highlight' : ''}`}>
      <div class="cd-card__header">
        <span class="cd-card__label">{cmd.label}</span>
        <Badge variant={cmd.mutating ? 'warning' : 'success'}>
          {cmd.mutating ? 'mutating' : 'read-only'}
        </Badge>
      </div>
      <p class="cd-card__desc">{cmd.description}</p>
      <div class="cd-card__actions">
        <GhostButton onClick={onExec} ariaLabel={`Run ${cmd.label}`}>
          Run
        </GhostButton>
        <GhostButton onClick={onTogglePin} ariaLabel={isPinned ? `Unpin ${cmd.label}` : `Pin ${cmd.label}`}>
          {isPinned ? 'Unpin' : 'Pin'}
        </GhostButton>
      </div>
    </div>
  );
}

function TemplateForm({ onClose }: { onClose: () => void }) {
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<CommandCategory>('Execution');
  const [cliArgsStr, setCli] = useState('');
  const [mutating, setMutating] = useState(false);

  const handleSave = useCallback(() => {
    if (!label.trim() || !cliArgsStr.trim()) return;
    const args = cliArgsStr.split(/\s+/).filter(Boolean);
    const placeholders: string[] = [];
    const seen = new Set<string>();
    for (const arg of args) {
      const matches = arg.match(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g);
      if (matches) {
        for (const m of matches) {
          const name = m.slice(1, -1);
          if (!seen.has(name)) {
            seen.add(name);
            placeholders.push(name);
          }
        }
      }
    }
    const id = 'tpl-' + label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
    vscode.postMessage({
      type: 'template:save',
      template: { id, label: label.trim(), description: description.trim(), category, mutating, cliArgs: args, placeholders },
    });
    onClose();
  }, [label, description, category, cliArgsStr, mutating, onClose]);

  return (
    <section class="cd-template-form">
      <div class="cd-template-form__header">
        <h2 class="cd-section-title">New Template</h2>
        <GhostButton onClick={onClose} ariaLabel="Cancel">Cancel</GhostButton>
      </div>
      <div class="cd-form-field">
        <label class="cd-form-label">Label</label>
        <input class="cd-form-input" value={label} onInput={e => setLabel((e.target as HTMLInputElement).value)} placeholder="e.g. Run specific pack" />
      </div>
      <div class="cd-form-field">
        <label class="cd-form-label">Description</label>
        <input class="cd-form-input" value={description} onInput={e => setDescription((e.target as HTMLInputElement).value)} placeholder="What this template does" />
      </div>
      <div class="cd-form-field">
        <label class="cd-form-label">CLI Args (use {'{placeholder}'} syntax)</label>
        <input class="cd-form-input" value={cliArgsStr} onInput={e => setCli((e.target as HTMLInputElement).value)} placeholder="runtime execute --pack {packId}" />
      </div>
      <div class="cd-form-field">
        <label class="cd-form-label">Category</label>
        <select class="cd-form-select" value={category} onChange={e => setCategory((e.target as HTMLSelectElement).value as CommandCategory)}>
          <option value="Investigation">Investigation</option>
          <option value="Execution">Execution</option>
          <option value="Intelligence">Intelligence</option>
          <option value="Maintenance">Maintenance</option>
        </select>
      </div>
      <div class="cd-form-field">
        <label>
          <input type="checkbox" checked={mutating} onChange={e => setMutating((e.target as HTMLInputElement).checked)} />
          {' '}Mutating (changes state)
        </label>
      </div>
      <GhostButton onClick={handleSave} ariaLabel="Save template">Save Template</GhostButton>
    </section>
  );
}

function PlaceholderPrompt({
  placeholders,
  onSubmit,
  onCancel,
}: {
  placeholders: string[];
  onSubmit: (values: Record<string, string>) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(placeholders.map(p => [p, '']))
  );

  return (
    <section class="cd-placeholder-prompt">
      <h2 class="cd-section-title">Fill Parameters</h2>
      {placeholders.map(ph => (
        <div key={ph} class="cd-form-field">
          <label class="cd-form-label">{ph}</label>
          <input
            class="cd-form-input"
            value={values[ph] || ''}
            onInput={e => setValues(v => ({ ...v, [ph]: (e.target as HTMLInputElement).value }))}
            placeholder={`Enter ${ph}...`}
          />
        </div>
      ))}
      <div class="cd-action-row">
        <GhostButton onClick={() => onSubmit(values)} ariaLabel="Execute with values">Execute</GhostButton>
        <GhostButton onClick={onCancel} ariaLabel="Cancel">Cancel</GhostButton>
      </div>
    </section>
  );
}

// Styles - follows mcp-control-panel pattern with cd- prefix
const styles = `
.cd-root {
  padding: 16px;
  max-width: 960px;
  margin: 0 auto;
}
.cd-header { margin-bottom: 16px; }
.cd-title {
  font-size: 1.4em;
  font-weight: 600;
  margin: 0 0 4px 0;
  color: var(--vscode-editor-foreground);
}
.cd-section { margin-bottom: 20px; }
.cd-section-title {
  font-size: 1.1em;
  font-weight: 600;
  margin: 0 0 8px 0;
  color: var(--vscode-editor-foreground);
}
.cd-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}
@media (max-width: 600px) {
  .cd-grid { grid-template-columns: 1fr; }
}
.cd-card {
  background: var(--vscode-editor-background);
  border: 1px solid var(--vscode-panel-border, var(--vscode-editorWidget-border, #444));
  border-radius: 6px;
  padding: 12px 16px;
}
.cd-card--highlight {
  border-color: var(--vscode-focusBorder, #007fd4);
  box-shadow: 0 0 0 1px var(--vscode-focusBorder, #007fd4);
}
.cd-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}
.cd-card__label {
  font-weight: 600;
  color: var(--vscode-editor-foreground);
}
.cd-card__desc {
  font-size: 0.9em;
  color: var(--vscode-descriptionForeground);
  margin: 0 0 8px 0;
}
.cd-card__actions {
  display: flex;
  gap: 8px;
}
.cd-recent-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.cd-recent-entry {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9em;
}
.cd-recent-label {
  flex: 1;
  color: var(--vscode-editor-foreground);
}
.cd-recent-time {
  color: var(--vscode-descriptionForeground);
  font-size: 0.85em;
}
.cd-connecting {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 32px;
  justify-content: center;
  color: var(--vscode-descriptionForeground);
}
.cd-connecting__dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--vscode-charts-blue, #007fd4);
  animation: cd-pulse 1.4s ease-in-out infinite;
}
@keyframes cd-pulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
}
.cd-template-form,
.cd-placeholder-prompt {
  background: var(--vscode-editor-background);
  border: 1px solid var(--vscode-panel-border, var(--vscode-editorWidget-border, #444));
  border-radius: 6px;
  padding: 12px 16px;
  margin-bottom: 16px;
}
.cd-template-form__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.cd-form-field {
  margin-bottom: 8px;
}
.cd-form-label {
  display: block;
  font-weight: 500;
  color: var(--vscode-descriptionForeground);
  margin-bottom: 4px;
  font-size: 0.9em;
}
.cd-form-input,
.cd-form-select {
  width: 100%;
  box-sizing: border-box;
  padding: 4px 8px;
  font-size: 0.9em;
  border: 1px solid var(--vscode-input-border, #555);
  background: var(--vscode-input-background, #1e1e1e);
  color: var(--vscode-input-foreground, #ccc);
  border-radius: 4px;
  font-family: var(--vscode-font-family);
}
.cd-form-input:focus,
.cd-form-select:focus {
  outline: 1px solid var(--vscode-focusBorder, #007fd4);
  border-color: var(--vscode-focusBorder, #007fd4);
}
.cd-action-row {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}
.cd-card__placeholders {
  font-size: 0.85em;
  color: var(--vscode-textPreformat-foreground, #ce9178);
  margin: 0 0 8px 0;
  font-family: var(--vscode-editor-fontFamily, monospace);
}
`;

const styleEl = document.createElement('style');
styleEl.textContent = styles;
document.head.appendChild(styleEl);

const root = document.getElementById('root');
if (root) {
  render(<CommandDeckApp />, root);
}
