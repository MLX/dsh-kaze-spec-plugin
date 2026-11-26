/** One document-level stylesheet, scoped by the `kaze-` prefix. */

const STYLE_ID = 'kaze-spec-styles'

const CSS = `
.kaze-root {
  --kz-text: var(--dsw-alias-label-primary, var(--vscode-foreground, #1f2328));
  --kz-text-2: var(--dsw-alias-label-secondary, var(--vscode-descriptionForeground, #57606a));
  --kz-text-3: var(--dsw-alias-label-tertiary, #6a737d);
  --kz-border: var(--dsw-alias-border-l1, rgba(127, 127, 127, .18));
  --kz-border-strong: var(--dsw-alias-border-l2, rgba(127, 127, 127, .32));
  --kz-surface: var(--dsw-alias-bg-layer-1, rgba(127, 127, 127, .05));
  --kz-surface-2: var(--dsw-alias-bg-layer-2, rgba(127, 127, 127, .09));
  --kz-hover: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, .09));
  --kz-accent: var(--dsw-alias-state-business-primary, var(--dsw-alias-button-info-fill, #4176e6));
  --kz-accent-soft: color-mix(in srgb, var(--kz-accent) 13%, transparent);
  --kz-danger: var(--dsw-alias-state-error-primary, #d64545);
  --kz-ok: var(--dsw-alias-state-success-primary, #2f9e44);
  --kz-warn: var(--dsw-alias-state-warn-primary, #d9822b);
  --kz-code: var(--dsw-alias-markdown-code-block, rgba(127, 127, 127, .09));
  --kz-mono: var(--ds-font-family-code, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 100%;
  height: 100%;
  padding: 12px 12px 0;
  box-sizing: border-box;
  color: var(--kz-text);
  font-size: 12px;
  line-height: 1.5;
  overflow: hidden;
}
.kaze-root button { font: inherit; color: inherit; }
.kaze-root button:focus-visible,
.kaze-root input:focus-visible,
.kaze-root textarea:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--kz-accent) 60%, transparent);
  outline-offset: 1px;
}
.kaze-lang {
  height: 22px; padding: 0 4px; border-radius: 4px;
  border: 1px solid var(--kz-border); background: var(--kz-surface);
  color: var(--kz-text); font: inherit; font-size: 11px;
}
.kaze-head { display: flex; align-items: flex-start; gap: 8px; }
.kaze-head-main { flex: 1; min-width: 0; }
.kaze-head h2 {
  margin: 0;
  font-size: 14px;
  font-weight: 650;
  letter-spacing: .1px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.kaze-sub {
  margin-top: 2px;
  color: var(--kz-text-3);
  font-size: 10.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.kaze-phases { display: flex; align-items: flex-start; padding: 0 2px; }
.kaze-phase { position: relative; flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 3px; }
.kaze-phase + .kaze-phase::before {
  content: ''; position: absolute; top: 3px; right: 50%; width: 100%; height: 1px;
  background: var(--kz-border);
}
.kaze-phase[data-state="done"]::before,
.kaze-phase[data-state="current"]::before { background: color-mix(in srgb, var(--kz-accent) 45%, var(--kz-border)); }
.kaze-phase-dot {
  position: relative; z-index: 1; width: 7px; height: 7px; border-radius: 50%;
  border: 1px solid var(--kz-border-strong);
  background: var(--dsw-alias-bg-base, var(--kz-surface));
}
.kaze-phase[data-state="done"] .kaze-phase-dot { border-color: var(--kz-accent); background: var(--kz-accent); }
.kaze-phase[data-state="current"] .kaze-phase-dot {
  border-color: var(--kz-accent); background: var(--kz-accent);
  box-shadow: 0 0 0 3px var(--kz-accent-soft);
}
.kaze-phase-label { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 9.5px; color: var(--kz-text-3); }
.kaze-phase[data-state="done"] .kaze-phase-label { color: var(--kz-text-2); }
.kaze-phase[data-state="current"] .kaze-phase-label { color: var(--kz-accent); font-weight: 650; }
.kaze-iconbtn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 24px; height: 24px; flex: none;
  border: 1px solid transparent; border-radius: 6px;
  background: transparent; cursor: pointer;
  color: var(--kz-text-2);
  transition: background .12s ease, color .12s ease;
}
.kaze-iconbtn:hover { background: var(--kz-hover); color: var(--kz-text); }
.kaze-iconbtn[data-spin] svg { animation: kaze-spin .9s linear infinite; }
@keyframes kaze-spin { to { transform: rotate(360deg); } }
.kaze-picker { position: relative; }
.kaze-picker-trigger {
  display: flex; align-items: center; gap: 6px; width: 100%;
  padding: 5px 7px; border: 1px solid var(--kz-border);
  border-radius: 7px; background: var(--kz-surface);
  cursor: pointer; text-align: left;
}
.kaze-picker-trigger:hover { border-color: var(--kz-border-strong); }
.kaze-picker-trigger .kaze-name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.kaze-picker-trigger .kaze-chev { margin-left: auto; color: var(--kz-text-3); display: inline-flex; }
@keyframes kaze-pop { from { opacity: 0; transform: translateY(-3px); } }
.kaze-dialog-layer {
  position: absolute; inset: 0; z-index: 60;
  display: flex; align-items: center; justify-content: center;
  padding: 12px;
}
.kaze-dialog-backdrop {
  position: absolute; inset: 0;
  background: color-mix(in srgb, #000 32%, transparent);
  animation: kaze-fade .12s ease-out;
}
@keyframes kaze-fade { from { opacity: 0; } }
.kaze-dialog {
  position: relative; z-index: 1;
  display: flex; flex-direction: column;
  width: 100%; max-width: 360px; max-height: 100%;
  border: 1px solid var(--kz-border-strong); border-radius: 10px;
  background: var(--dsw-alias-bg-overlay, var(--dsw-alias-bg-layer-3, #fff));
  box-shadow: var(--dsw-elevation-prominent, 0 10px 28px rgba(0,0,0,.18));
  overflow: hidden;
  animation: kaze-dialog-in .14s ease-out;
}
@keyframes kaze-dialog-in { from { opacity: 0; transform: translateY(6px) scale(.99); } }
.kaze-dialog-head {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  padding: 6px 6px 6px 12px; border-bottom: 1px solid var(--kz-border);
}
.kaze-dialog-head strong { font-size: 12px; font-weight: 650; }
.kaze-dialog-body { display: flex; flex-direction: column; gap: 6px; min-height: 0; padding: 8px 12px; overflow: auto; }
.kaze-dialog-body > input {
  width: 100%; box-sizing: border-box; padding: 5px 7px;
  border: 1px solid var(--kz-border); border-radius: 6px;
  background: transparent; color: inherit; font: inherit;
}
.kaze-dialog-foot {
  display: flex; justify-content: flex-end; gap: 6px;
  padding: 8px 12px 10px; border-top: 1px solid var(--kz-border);
}
.kaze-dialog-note { margin: 0; color: var(--kz-text-3); font-size: 10.5px; line-height: 1.5; }
.kaze-dialog-empty { padding: 16px 8px; text-align: center; color: var(--kz-text-3); font-size: 11px; }
.kaze-choice { display: flex; gap: 4px; }
.kaze-choice button {
  flex: 1; min-width: 0; padding: 4px 8px;
  border: 1px solid var(--kz-border); border-radius: 6px;
  background: var(--kz-surface); color: var(--kz-text-2);
  font-size: 11px; cursor: pointer;
}
.kaze-choice button:hover:not(:disabled) { border-color: var(--kz-border-strong); color: var(--kz-text); }
.kaze-choice button[data-selected] {
  border-color: color-mix(in srgb, var(--kz-accent) 55%, transparent);
  background: var(--kz-accent-soft); color: var(--kz-accent); font-weight: 600;
}
.kaze-choice button:disabled { opacity: .45; cursor: default; }
.kaze-menu-list { max-height: 46vh; min-height: 60px; overflow: auto; display: flex; flex-direction: column; gap: 1px; }
.kaze-form { display: flex; flex-direction: column; gap: 5px; }
.kaze-form label { display: flex; flex-direction: column; gap: 2px; font-size: 10.5px; color: var(--kz-text-3); }
.kaze-form input, .kaze-form select, .kaze-form textarea {
  width: 100%; box-sizing: border-box; padding: 4px 6px;
  border: 1px solid var(--kz-border); border-radius: 6px;
  background: var(--dsw-alias-bg-base, transparent); color: var(--kz-text);
  font: inherit; font-size: 11.5px;
}
.kaze-form textarea { resize: vertical; min-height: 42px; }
.kaze-wish-inline {
  display: flex; flex-direction: column; gap: 5px;
  padding: 8px; border: 1px solid color-mix(in srgb, var(--kz-accent) 32%, var(--kz-border));
  border-radius: 8px; background: var(--kz-surface);
  animation: kaze-pop .12s ease-out;
  transition: border-color .12s ease, box-shadow .12s ease;
}
.kaze-wish-inline:focus-within {
  border-color: color-mix(in srgb, var(--kz-accent) 55%, var(--kz-border));
  box-shadow: 0 0 0 2px var(--kz-accent-soft);
}
.kaze-wish-inline textarea {
  width: 100%; box-sizing: border-box; min-height: 56px;
  padding: 2px 4px; border: 0; border-radius: 4px;
  background: transparent; color: var(--kz-text);
  font: inherit; font-size: 11.5px; resize: vertical;
}
.kaze-wish-inline textarea:focus-visible { outline: none; }
.kaze-wish-actions {
  display: flex; align-items: center; gap: 4px; flex-wrap: wrap;
  padding-top: 6px; border-top: 1px solid var(--kz-border);
}
.kaze-wish-error { margin: 0; color: var(--kz-danger); font-size: 10.5px; }
.kaze-create-inline input, .kaze-create-inline textarea {
  width: 100%; box-sizing: border-box; padding: 5px 7px;
  border: 1px solid var(--kz-border); border-radius: 6px;
  background: var(--dsw-alias-bg-base, transparent); color: var(--kz-text);
  font: inherit; font-size: 11.5px;
}
.kaze-create-inline textarea { min-height: 44px; resize: vertical; }
.kaze-create-inline .kaze-choice button { padding: 3px 6px; font-size: 10.5px; }
.kaze-form-row { display: flex; gap: 5px; }
.kaze-form-row label { flex: 1; min-width: 0; }
.kaze-form-actions { display: flex; gap: 4px; margin-top: 2px; }
.kaze-spec-row {
  display: flex; align-items: center; gap: 6px; width: 100%;
  padding: 4px 6px; border: 1px solid transparent; border-radius: 6px;
  background: transparent; cursor: pointer; text-align: left;
}
.kaze-spec-row:hover { background: var(--kz-hover); }
.kaze-spec-row[data-active] { background: var(--kz-accent-soft); border-color: color-mix(in srgb, var(--kz-accent) 30%, transparent); }
.kaze-spec-row[data-picker-active] { outline: 1px solid color-mix(in srgb, var(--kz-accent) 45%, transparent); outline-offset: -1px; }
.kaze-spec-row .kaze-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.kaze-spec-row .kaze-meta { color: var(--kz-text-3); font-size: 10.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 46%; }
.kaze-spec-row .kaze-spec-date { color: var(--kz-text-3); font-size: 10px; white-space: nowrap; }
.kaze-spec-row[data-archived] { cursor: default; }
.kaze-spec-row[data-archived]:hover { background: transparent; }
.kaze-spec-row[data-archived] .kaze-btn { padding: 1px 7px; font-size: 10.5px; }
.kaze-badge {
  display: inline-flex; align-items: center; gap: 3px;
  padding: 0 5px; border-radius: 999px;
  font-size: 10.5px; line-height: 16px; font-weight: 600; letter-spacing: .2px;
  border: 1px solid var(--kz-border); color: var(--kz-text-2); background: var(--kz-surface);
  white-space: nowrap;
}
.kaze-badge[data-tone="info"] { color: var(--kz-accent); border-color: color-mix(in srgb, var(--kz-accent) 35%, transparent); background: var(--kz-accent-soft); }
.kaze-badge[data-tone="ok"] { color: var(--kz-ok); border-color: color-mix(in srgb, var(--kz-ok) 35%, transparent); background: color-mix(in srgb, var(--kz-ok) 10%, transparent); }
.kaze-badge[data-tone="warn"] { color: var(--kz-warn); border-color: color-mix(in srgb, var(--kz-warn) 35%, transparent); background: color-mix(in srgb, var(--kz-warn) 10%, transparent); }
.kaze-badge[data-tone="danger"] { color: var(--kz-danger); border-color: color-mix(in srgb, var(--kz-danger) 35%, transparent); background: color-mix(in srgb, var(--kz-danger) 10%, transparent); }
.kaze-notice {
  padding: 8px 9px; border: 1px solid var(--kz-border); border-radius: 7px;
  background: var(--kz-surface); color: var(--kz-text-2); font-size: 11px;
}
.kaze-notice[data-tone="error"] {
  color: var(--kz-danger);
  border-color: color-mix(in srgb, var(--kz-danger) 40%, transparent);
  background: color-mix(in srgb, var(--kz-danger) 8%, transparent);
}
.kaze-notice .kaze-notice-actions { margin-top: 6px; display: flex; gap: 6px; }
.kaze-doc-tabs { display: flex; align-items: center; gap: 4px; }
.kaze-seg {
  display: flex; gap: 2px; padding: 2px; border-radius: 7px;
  background: var(--kz-surface); border: 1px solid var(--kz-border);
  min-width: 0; overflow: auto;
}
.kaze-tab {
  border: 0; background: transparent; border-radius: 5px;
  padding: 3px 7px; cursor: pointer; color: var(--kz-text-2);
  font-size: 11px; white-space: nowrap; display: inline-flex; align-items: center; gap: 4px;
}
.kaze-tab:hover { background: var(--kz-hover); color: var(--kz-text); }
.kaze-tab[data-active] { background: var(--dsw-alias-bg-base, transparent); color: var(--kz-text); box-shadow: 0 1px 2px rgba(0,0,0,.08); font-weight: 600; }
.kaze-tab:disabled { opacity: .35; cursor: default; }
.kaze-tab .kaze-tab-count { font-size: 10.5px; font-weight: 600; color: var(--kz-accent); }
.kaze-nav { display: flex; gap: 1px; margin-left: auto; }
.kaze-bar { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.kaze-btn {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 7px; border: 1px solid var(--kz-border); border-radius: 6px;
  background: var(--kz-surface); cursor: pointer; font-size: 11px;
  color: var(--kz-text-2); transition: background .12s ease, color .12s ease, border-color .12s ease;
  white-space: nowrap;
}
.kaze-btn:hover:not(:disabled) { background: var(--kz-hover); color: var(--kz-text); border-color: var(--kz-border-strong); }
.kaze-btn:disabled { opacity: .4; cursor: default; }
.kaze-btn[data-active] { color: var(--kz-accent); border-color: color-mix(in srgb, var(--kz-accent) 40%, transparent); background: var(--kz-accent-soft); }
.kaze-btn[data-variant="primary"] {
  background: var(--dsw-alias-button-primary-fill, var(--kz-accent));
  border-color: transparent;
  color: var(--dsw-alias-label-primary-inverted, #fff);
  font-weight: 600;
}
.kaze-btn[data-variant="primary"]:hover:not(:disabled) {
  background: var(--dsw-alias-button-primary-hover, var(--kz-accent));
  color: var(--dsw-alias-label-primary-inverted, #fff);
}
.kaze-btn[data-variant="primary"]:disabled {
  background: var(--kz-surface-2);
  border-color: var(--kz-border);
  color: var(--kz-text-3);
  opacity: 1;
}
.kaze-btn[data-variant="danger"] { color: var(--kz-danger); }
.kaze-btn[data-variant="ghost"] { padding-left: 5px; padding-right: 5px; border-color: transparent; background: transparent; color: var(--kz-text-3); }
.kaze-btn[data-variant="ghost"]:hover:not(:disabled) { border-color: transparent; background: var(--kz-hover); color: var(--kz-text); }
.kaze-btn[data-icon] { padding: 3px 5px; }
.kaze-spacer { flex: 1; }
.kaze-count { color: var(--kz-text-3); font-size: 10.5px; }
.kaze-find {
  display: flex; align-items: center; gap: 4px;
  padding: 4px 6px; border: 1px solid var(--kz-border); border-radius: 7px;
  background: var(--kz-surface); animation: kaze-pop .12s ease-out;
}
.kaze-find input { flex: 1; border: 0; background: transparent; color: inherit; font: inherit; outline: none; min-width: 0; }
.kaze-find .kaze-hits { color: var(--kz-text-3); font-size: 10.5px; white-space: nowrap; }
.kaze-doc {
  position: relative; flex: 1; min-height: 0; overflow: auto;
  border: 1px solid var(--kz-border); border-radius: 8px;
  background: var(--dsw-alias-bg-document-preview, transparent);
  overscroll-behavior: contain;
}
.kaze-doc[hidden], .kaze-bar[hidden] { display: none; }
.kaze-doc[data-review] { border-color: color-mix(in srgb, var(--kz-accent) 28%, var(--kz-border)); }
.kaze-doc-inner { padding: 9px 10px 16px; }
.kaze-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;
  min-height: 180px; padding: 20px; text-align: center; color: var(--kz-text-3);
}
.kaze-empty strong { color: var(--kz-text-2); font-weight: 600; }
.kaze-empty code { font-family: var(--kz-mono); font-size: 10.5px; padding: 1px 4px; border-radius: 4px; background: var(--kz-code); }
.kaze-start { flex: 1 1 auto; align-items: stretch; justify-content: flex-start; min-height: 0; gap: 10px; padding: 12px 10px; text-align: left; overflow-y: auto; }
.kaze-start-head { display: flex; flex-direction: column; gap: 3px; }
.kaze-start-head strong { font-size: 12px; }
.kaze-start-head span { font-size: 10.5px; color: var(--kz-text-3); }
.kaze-start-list { display: flex; flex-direction: column; gap: 4px; }
.kaze-start-row { display: flex; align-items: flex-start; gap: 8px; width: 100%; padding: 7px 8px; text-align: left; border: 1px solid var(--kz-border); border-radius: 6px; background: var(--kz-surface); color: inherit; cursor: pointer; }
.kaze-start-row:hover { background: var(--kz-hover); }
.kaze-start-row[data-open] {
  border-color: color-mix(in srgb, var(--kz-accent) 45%, var(--kz-border));
  background: color-mix(in srgb, var(--kz-accent) 6%, transparent);
  box-shadow: inset 2px 0 0 var(--kz-accent);
}
.kaze-start-row svg { flex: none; margin-top: 2px; color: var(--kz-accent); }
.kaze-start-text { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.kaze-start-title { font-size: 11.5px; font-weight: 600; color: var(--kz-text); }
.kaze-start-desc { font-size: 10.5px; color: var(--kz-text-3); }
.kaze-start-badges { margin-left: auto; padding-left: 6px; font-size: 9.5px; color: var(--kz-text-3); white-space: nowrap; }
@media (max-width: 380px) { .kaze-start-badges { display: none; } }
.kaze-outline { display: flex; flex-direction: column; gap: 1px; margin: 0 0 8px; padding: 6px; border: 1px solid var(--kz-border); border-radius: 7px; background: var(--kz-surface); }
.kaze-outline-row { text-align: left; padding: 2px 6px; border: 0; border-radius: 4px; background: transparent; color: var(--kz-text-2); font-size: 10.8px; cursor: pointer; }
.kaze-outline-row:hover { background: var(--kz-hover); color: var(--kz-text); }
.kaze-outline-row[data-level="1"] { font-weight: 600; color: var(--kz-text); }
.kaze-outline-row[data-level="2"] { padding-left: 14px; }
.kaze-outline-row[data-level="3"] { padding-left: 24px; }
.kaze-outline-row[data-level="4"] { padding-left: 34px; }
.kaze-panel-toggle { display: inline-flex; align-items: center; gap: 4px; padding: 0; border: 0; background: transparent; color: inherit; font: inherit; cursor: pointer; }
.kaze-panel-toggle:hover { color: var(--kz-text); }
.kaze-panel-toggle svg { transition: transform .12s ease; }
.kaze-panel-toggle[aria-expanded="false"] svg { transform: rotate(-90deg); }
.kaze-task-panel[data-collapsed] > :not(.kaze-task-head),
.kaze-idle-panel[data-collapsed] > :not(.kaze-idle-head) { display: none; }
@media (prefers-reduced-motion: reduce) { .kaze-panel-toggle svg { transition: none; } }
.kaze-source { font-family: var(--kz-mono); font-size: 10.8px; line-height: 1.65; padding-left: 10px; }
.kaze-line { display: block; position: relative; padding: 0 4px 0 0; border-radius: 4px; white-space: pre-wrap; word-break: break-word; }
.kaze-line[data-hit] { background: color-mix(in srgb, var(--kz-warn) 16%, transparent); }
.kaze-line[data-current] { background: color-mix(in srgb, var(--kz-accent) 12%, transparent); }
.kaze-line[data-anchor] { background: color-mix(in srgb, var(--kz-accent) 7%, transparent); }
.kaze-line[data-tone="heading"] { color: var(--kz-text); font-weight: 650; background: color-mix(in srgb, var(--kz-accent) 4%, transparent); }
.kaze-line[data-tone="code"], .kaze-line[data-tone="table"] { color: var(--kz-text-2); }
.kaze-line[data-tone="quote"] { color: var(--kz-text-2); box-shadow: inset 2px 0 var(--kz-border-strong); }
.kaze-line[data-tone="task"] { color: var(--kz-text); }
.kaze-line[data-tone="list"] { color: var(--kz-text-2); }
.kaze-line[data-tone="rule"] { color: var(--kz-text-3); }
.kaze-ln {
  display: inline-block; width: 30px; padding-right: 8px; text-align: right;
  color: var(--kz-text-3); opacity: .65; user-select: none;
  font-variant-numeric: tabular-nums;
}
.kaze-line-add {
  position: absolute; left: -11px; top: 50%; transform: translateY(-50%);
  width: 14px; height: 14px; border-radius: 50%; border: 0;
  background: var(--kz-accent); color: #fff; cursor: pointer;
  display: none; align-items: center; justify-content: center; font-size: 12px; line-height: 1;
  padding: 0; z-index: 3;
}
.kaze-line:hover .kaze-line-add { display: inline-flex; }
.kaze-md { font-size: 12px; line-height: 1.6; overflow-wrap: anywhere; }
.kaze-md > *:first-child { margin-top: 0; }
.kaze-md > *:last-child { margin-bottom: 0; }
.kaze-md h1, .kaze-md h2, .kaze-md h3, .kaze-md h4, .kaze-md h5, .kaze-md h6 {
  margin: 14px 0 6px; line-height: 1.35; font-weight: 650; scroll-margin-top: 8px;
}
.kaze-md h1 { font-size: 16px; padding-bottom: 4px; border-bottom: 1px solid var(--kz-border); }
.kaze-md h2 { font-size: 14px; padding-bottom: 3px; border-bottom: 1px solid var(--kz-border); }
.kaze-md h3 { font-size: 12.8px; }
.kaze-md h4, .kaze-md h5, .kaze-md h6 { font-size: 12px; color: var(--kz-text-2); }
.kaze-md p { margin: 7px 0; }
.kaze-md ul, .kaze-md ol { margin: 6px 0; padding-left: 2px; list-style: none; }
.kaze-md li { margin: 2px 0; display: flex; align-items: flex-start; gap: 6px; }
.kaze-md .kaze-bullet { flex: none; min-width: 12px; color: var(--kz-text-3); text-align: right; font-variant-numeric: tabular-nums; }
.kaze-md .kaze-li-text { flex: 1; min-width: 0; }
.kaze-md li.kaze-task-item { display: flex; gap: 6px; align-items: flex-start; }
.kaze-md li.kaze-task-item input { margin: 3px 0 0; accent-color: var(--kz-accent); }
.kaze-md .kaze-task-mark {
  flex: none; display: inline-flex; align-items: center; justify-content: center;
  width: 12px; height: 12px; margin-top: 3px; border-radius: 3px;
  border: 1px solid color-mix(in srgb, var(--kz-accent) 55%, var(--kz-border));
  color: var(--kz-accent); font-size: 10.5px; font-weight: 700; line-height: 1;
}
.kaze-md .kaze-task-mark[data-status="queued"] { color: var(--kz-warn); border-color: color-mix(in srgb, var(--kz-warn) 55%, var(--kz-border)); }
.kaze-md li.kaze-task-item[data-done] { color: var(--kz-text-3); text-decoration: line-through; text-decoration-color: color-mix(in srgb, currentColor 40%, transparent); }
.kaze-md code {
  font-family: var(--kz-mono); font-size: 10.6px;
  padding: 1px 4px; border-radius: 4px;
  background: var(--dsw-alias-markdown-inline-code, var(--kz-code));
}
.kaze-md pre {
  margin: 8px 0; padding: 8px 9px; border-radius: 7px;
  border: 1px solid var(--kz-border); background: var(--kz-code);
  overflow: auto; font-family: var(--kz-mono); font-size: 10.5px; line-height: 1.55;
}
.kaze-md pre code { padding: 0; background: transparent; font-size: inherit; }
.kaze-md blockquote {
  margin: 8px 0; padding: 4px 9px; border-left: 3px solid color-mix(in srgb, var(--kz-accent) 45%, var(--kz-border));
  color: var(--kz-text-2); background: color-mix(in srgb, var(--kz-accent) 4%, transparent);
}
.kaze-md table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 11px; display: block; overflow-x: auto; }
.kaze-md > * { content-visibility: auto; contain-intrinsic-size: auto 48px; }
.kaze-md th, .kaze-md td { border: 1px solid var(--kz-border); padding: 4px 6px; text-align: left; vertical-align: top; }
.kaze-md th { background: var(--kz-surface); font-weight: 600; }
.kaze-md hr { border: 0; border-top: 1px solid var(--kz-border); margin: 12px 0; }
.kaze-md a { color: var(--dsw-alias-link, var(--kz-accent)); text-decoration: none; }
.kaze-md a:hover { text-decoration: underline; }
.kaze-md img { display: block; max-width: 100%; height: auto; margin: 8px 0; border-radius: 7px; border: 1px solid var(--kz-border); }
.kaze-mermaid { min-height: 96px; margin: 8px 0; border: 1px solid var(--kz-border); border-radius: 7px; background: var(--kz-surface); overflow: hidden; }
.kaze-mermaid-bar { display: flex; justify-content: flex-end; padding: 2px 4px; border-bottom: 1px solid var(--kz-border); }
.kaze-mermaid-graphic { padding: 6px; overflow: auto; max-height: 520px; }
.kaze-mermaid-graphic svg { display: block; width: auto; max-width: none; height: auto; min-width: 520px; margin: 0 auto; }
.kaze-mermaid-fit { border: 1px solid var(--kz-border); border-radius: 4px; background: var(--kz-surface-2); color: var(--kz-text-2); font: inherit; font-size: 10.5px; padding: 0 5px; cursor: pointer; line-height: 15px; }
.kaze-mermaid-fit:hover { color: var(--kz-accent); border-color: color-mix(in srgb, var(--kz-accent) 40%, transparent); }
.kaze-mermaid-loading { padding: 12px; text-align: center; color: var(--kz-text-3); font-size: 11px; }
.kaze-mermaid-error { margin: 8px 0; padding: 8px; border: 1px solid color-mix(in srgb, var(--kz-danger) 35%, var(--kz-border)); border-radius: 7px; background: color-mix(in srgb, var(--kz-danger) 5%, transparent); }
.kaze-mermaid-error strong { display: block; color: var(--kz-danger); font-size: 11px; }
.kaze-mermaid-error pre { margin: 6px 0; padding: 6px; background: var(--kz-code); border-radius: 5px; overflow: auto; font-family: var(--kz-mono); font-size: 10.5px; }
.kaze-mermaid-error span { color: var(--kz-text-3); font-size: 10.5px; }
.kaze-md mark { background: color-mix(in srgb, var(--kz-warn) 35%, transparent); color: inherit; border-radius: 2px; padding: 0 1px; }
.kaze-block { position: relative; border-radius: 4px; }
.kaze-block[data-commented] { background: color-mix(in srgb, var(--kz-accent) 5%, transparent); box-shadow: inset 2px 0 color-mix(in srgb, var(--kz-accent) 60%, transparent); padding-left: 6px; margin-left: -6px; }
.kaze-block-tools { position: absolute; right: -4px; top: -4px; opacity: 0; transition: opacity .12s ease; }
.kaze-block:hover .kaze-block-tools { opacity: 1; }
.kaze-block-tools .kaze-iconbtn { width: 20px; height: 20px; background: var(--kz-surface-2); border: 1px solid var(--kz-border); }
.kaze-comment {
  font-family: inherit;
  margin: 6px 0 8px; border: 1px solid color-mix(in srgb, var(--kz-accent) 30%, var(--kz-border));
  border-left: 3px solid var(--kz-accent);
  border-radius: 7px; background: color-mix(in srgb, var(--kz-accent) 4%, transparent);
  padding: 7px 8px;
}
.kaze-comment[data-resolved] { border-left-color: var(--kz-ok); border-color: color-mix(in srgb, var(--kz-ok) 28%, var(--kz-border)); opacity: .72; }
.kaze-comment[data-stale] { border-left-color: var(--kz-warn); border-color: color-mix(in srgb, var(--kz-warn) 40%, var(--kz-border)); }
.kaze-comment-head { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; }
.kaze-comment-no {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 15px; height: 15px; padding: 0 3px; border-radius: 999px;
  background: var(--kz-accent); color: #fff; font-size: 10.5px; font-weight: 700;
}
.kaze-comment[data-resolved] .kaze-comment-no { background: var(--kz-ok); }
.kaze-comment[data-stale] .kaze-comment-no { background: var(--kz-warn); }
.kaze-comment-section { color: var(--kz-text-3); font-size: 10.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 55%; }
.kaze-comment-quote {
  margin: 5px 0 0; padding-left: 6px; border-left: 2px solid var(--kz-border-strong);
  color: var(--kz-text-3); font-size: 10.5px; font-style: italic;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
  white-space: pre-wrap;
}
.kaze-comment-note { margin: 5px 0 0; white-space: pre-wrap; color: var(--kz-text); font-size: 11.5px; }
.kaze-comment-actions { display: flex; gap: 4px; margin-top: 6px; flex-wrap: wrap; }
.kaze-comment-actions .kaze-btn { padding: 1px 6px; font-size: 10.5px; background: transparent; border-color: transparent; }
.kaze-comment-actions .kaze-btn:hover:not(:disabled) { border-color: var(--kz-border); }
.kaze-comment-edit { width: 100%; box-sizing: border-box; margin-top: 5px; }
.kaze-textarea {
  width: 100%; box-sizing: border-box; margin-top: 6px; padding: 6px 7px;
  border: 1px solid var(--kz-border); border-radius: 6px;
  background: var(--dsw-alias-bg-base, transparent); color: inherit;
  font: inherit; font-size: 11.5px; resize: vertical; min-height: 54px;
}
.kaze-composer {
  font-family: inherit;
  margin: 6px 0 8px; padding: 8px; border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--kz-accent) 35%, var(--kz-border));
  background: color-mix(in srgb, var(--kz-accent) 5%, transparent);
  animation: kaze-pop .12s ease-out;
}
.kaze-composer-head { display: flex; align-items: center; gap: 5px; color: var(--kz-text-2); font-size: 10.5px; }
.kaze-composer-actions { display: flex; gap: 5px; margin-top: 6px; align-items: center; }
.kaze-composer-actions .kaze-hint { margin-left: auto; color: var(--kz-text-3); font-size: 10.5px; }
.kaze-pill {
  position: absolute; z-index: 30; transform: translate(-50%, 4px);
  display: flex; gap: 2px; padding: 3px; border-radius: 7px;
  border: 1px solid var(--kz-border-strong);
  background: var(--dsw-alias-bg-overlay, var(--dsw-alias-bg-layer-3, #fff));
  box-shadow: var(--dsw-elevation-soft, 0 4px 14px rgba(0,0,0,.16));
  animation: kaze-pop .1s ease-out;
}
.kaze-pill .kaze-btn { border-color: transparent; background: transparent; }
.kaze-pill .kaze-btn:hover { background: var(--kz-hover); }
.kaze-footer {
  display: flex; flex-direction: column; gap: 6px;
  padding: 8px 0 10px; border-top: 1px solid var(--kz-border);
  background: var(--dsw-alias-bg-base, transparent);
}
.kaze-footer-row { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; }
.kaze-prompt {
  margin: 4px 0 0; padding: 7px 8px; max-height: 150px; overflow: auto;
  border: 1px solid var(--kz-border); border-radius: 6px; background: var(--kz-code);
  font-family: var(--kz-mono); font-size: 10.5px; line-height: 1.5; white-space: pre-wrap;
}
.kaze-completion {
  border: 1px solid var(--kz-border); border-radius: 8px;
  padding: 6px 8px; background: var(--kz-surface);
  display: flex; flex-direction: column; gap: 5px;
}
.kaze-completion-head { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; }
.kaze-completion-toggle {
  display: inline-flex; align-items: center; gap: 4px; padding: 0;
  border: 0; background: transparent; color: var(--kz-text);
  cursor: pointer; font-size: 11.5px; font-weight: 600;
}
.kaze-completion-toggle svg { color: var(--kz-text-3); transition: transform .12s ease; }
.kaze-completion-toggle[aria-expanded="false"] svg { transform: rotate(-90deg); }
.kaze-completion-toggle:hover svg { color: var(--kz-text); }
.kaze-completion-body { display: flex; flex-direction: column; gap: 5px; }
.kaze-completion-grid { display: flex; flex-direction: column; gap: 2px; }
.kaze-steps { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 1px 0; }
.kaze-step {
  display: inline-flex; align-items: center; gap: 4px;
  color: var(--kz-text-3); font-size: 10.5px; line-height: 15px;
}
.kaze-step::before {
  content: ''; width: 6px; height: 6px; border-radius: 50%;
  border: 1px solid var(--kz-border-strong); background: var(--dsw-alias-bg-base, transparent);
}
.kaze-step[data-state="done"] { color: var(--kz-ok); }
.kaze-step[data-state="done"]::before { border-color: var(--kz-ok); background: var(--kz-ok); }
.kaze-step[data-state="active"] { color: var(--kz-accent); font-weight: 600; }
.kaze-step[data-state="active"]::before {
  border-color: var(--kz-accent); background: var(--kz-accent);
  box-shadow: 0 0 0 2px var(--kz-accent-soft);
}
.kaze-completion-row { display: flex; align-items: baseline; gap: 6px; min-width: 0; font-size: 11.2px; }
.kaze-completion-label { flex: none; width: 64px; color: var(--kz-text-3); font-size: 11px; }
.kaze-completion-value { display: flex; align-items: center; flex-wrap: wrap; gap: 4px; min-width: 0; flex: 1; }
.kaze-completion-detail { color: var(--kz-text-2); font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
.kaze-completion-when { color: var(--kz-text-3); font-size: 11px; white-space: nowrap; }
.kaze-gate-block { display: flex; flex-direction: column; gap: 2px; }
.kaze-gates { display: flex; flex-direction: column; gap: 1px; }
.kaze-gate-entry { display: flex; flex-direction: column; gap: 1px; }
.kaze-gate-row {
  display: grid; grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center; gap: 5px; padding: 1px 2px; border-radius: 4px;
  border: 1px solid transparent; background: transparent; color: inherit;
  width: 100%; box-sizing: border-box; text-align: left; font: inherit;
  font-size: 11px;
}
.kaze-gate-row:hover, .kaze-gate-row:focus-visible { background: var(--kz-hover); border-color: var(--kz-border); }
.kaze-gate-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--kz-mono); color: var(--kz-text-2); }
.kaze-gate-at { color: var(--kz-text-3); white-space: nowrap; }
.kaze-gate-detail { padding: 2px 4px 4px; color: var(--kz-text-2); font-size: 11px; line-height: 1.5; white-space: pre-wrap; overflow-wrap: anywhere; }
.kaze-gate-more { align-self: flex-start; margin-top: 1px; }
.kaze-actions { display: flex; flex-wrap: wrap; gap: 4px; }
.kaze-actions .kaze-btn { max-width: 100%; }
.kaze-action-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 160px; }
.kaze-kind {
  flex: none; padding: 0 4px; border-radius: 999px;
  border: 1px solid var(--kz-border); color: var(--kz-text-3); background: var(--kz-surface-2);
  font-size: 10.5px; line-height: 14px; font-weight: 600; letter-spacing: .1px;
}
.kaze-kind[data-kind="host"] {
  color: var(--kz-ok); border-color: color-mix(in srgb, var(--kz-ok) 35%, transparent);
  background: color-mix(in srgb, var(--kz-ok) 10%, transparent);
}
.kaze-kind[data-kind="agent"] {
  color: var(--kz-accent); border-color: color-mix(in srgb, var(--kz-accent) 32%, transparent);
  background: var(--kz-accent-soft);
}
.kaze-completion .kaze-btn[data-kind="host"] { border-color: color-mix(in srgb, var(--kz-ok) 28%, var(--kz-border)); }
.kaze-completion .kaze-btn[data-kind="agent"] { border-color: color-mix(in srgb, var(--kz-accent) 25%, var(--kz-border)); }
.kaze-validation {
  padding: 6px 8px; border-radius: 7px;
  border: 1px solid color-mix(in srgb, var(--kz-danger) 35%, var(--kz-border));
  background: color-mix(in srgb, var(--kz-danger) 6%, transparent);
  display: flex; flex-direction: column; gap: 4px;
}
.kaze-validation-head { display: flex; align-items: center; gap: 6px; }
.kaze-validation-head strong { font-size: 11px; font-weight: 600; color: var(--kz-danger); }
.kaze-validation-list {
  display: flex; flex-direction: column; gap: 1px; max-height: 150px; overflow: auto;
  border-top: 1px solid var(--kz-border); padding-top: 3px;
}
.kaze-validation-item {
  display: flex; flex-direction: column; gap: 1px; width: 100%; box-sizing: border-box;
  padding: 2px 4px; border: 1px solid transparent; border-radius: 4px;
  background: transparent; color: inherit; font: inherit; text-align: left;
}
button.kaze-validation-item { cursor: pointer; }
button.kaze-validation-item:hover { background: var(--kz-hover); border-color: var(--kz-border); }
.kaze-validation-file { font-family: var(--kz-mono); font-size: 11px; color: var(--kz-text-3); overflow-wrap: anywhere; }
.kaze-validation-msg { font-size: 11.2px; color: var(--kz-text-2); white-space: pre-wrap; overflow-wrap: anywhere; }
.kaze-validation-item[data-severity="error"] .kaze-validation-msg { color: var(--kz-danger); }
.kaze-validation-item[data-severity="warning"] .kaze-validation-msg { color: var(--kz-warn); }
.kaze-task-queue {
  width: 12px; height: 12px; flex: none; margin: 0;
  accent-color: var(--kz-accent); cursor: pointer;
}
.kaze-task-queue-label {
  display: inline-flex; align-items: center; gap: 3px; flex: none;
  color: var(--kz-text-3); font-size: 10px; white-space: nowrap; cursor: pointer;
}
.kaze-task-queue-label:hover { color: var(--kz-text); }
.kaze-task-queue-label[data-queued] { color: var(--kz-accent); }
.kaze-task-deferred {
  display: flex; flex-direction: column; gap: 1px; margin-top: 2px;
  padding-top: 3px; border-top: 1px solid var(--kz-border);
}
.kaze-idle-panel {
  border: 1px solid var(--kz-border); border-radius: 8px;
  padding: 7px 8px; background: var(--kz-surface);
  display: flex; flex-direction: column; gap: 5px;
}
.kaze-idle-head { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; }
.kaze-idle-head strong { font-size: 11.5px; }
.kaze-idle-when { color: var(--kz-text-3); font-size: 11px; line-height: 1.5; }
.kaze-idle-note { color: var(--kz-text-3); font-size: 10.5px; line-height: 1.5; }
.kaze-idle-list {
  display: flex; flex-direction: column; gap: 1px; max-height: 190px; overflow: auto;
  border-top: 1px solid var(--kz-border); padding-top: 3px;
}
.kaze-idle-row {
  display: flex; align-items: center; gap: 4px; min-width: 0;
  padding: 2px 3px; border-radius: 4px; font-size: 11px;
}
.kaze-idle-row:hover { background: var(--kz-hover); }
.kaze-idle-row[data-status="done"] .kaze-idle-name { color: var(--kz-text-3); text-decoration: line-through; }
.kaze-idle-row[data-status="failed"] .kaze-idle-name { color: var(--kz-danger); }
.kaze-idle-index { flex: none; width: 16px; text-align: right; color: var(--kz-text-3); font-family: var(--kz-mono); font-size: 10.5px; }
.kaze-idle-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.kaze-idle-cost { flex: none; color: var(--kz-text-2); font-family: var(--kz-mono); font-size: 10.5px; }
.kaze-idle-dep { flex: none; color: var(--kz-warn); font-size: 10.5px; }
.kaze-idle-actions { display: inline-flex; align-items: center; gap: 0; flex: none; }
.kaze-idle-actions .kaze-iconbtn { width: 18px; height: 18px; font-size: 11px; }
.kaze-idle-edit { display: inline-flex; align-items: center; gap: 3px; flex-wrap: wrap; flex: 1; min-width: 0; }
.kaze-idle-edit input[type="number"] { width: 64px; }
.kaze-idle-edit input:not([type]) { min-width: 80px; flex: 1; }
.kaze-idle-config {
  display: flex; flex-direction: column; gap: 4px;
  border-top: 1px solid var(--kz-border); padding-top: 4px;
}
.kaze-idle-config textarea {
  width: 100%; box-sizing: border-box; min-height: 150px; resize: vertical;
  font-family: var(--kz-mono); font-size: 10.5px; line-height: 1.45;
  background: var(--kz-code); color: var(--kz-text); border: 1px solid var(--kz-border);
  border-radius: 5px; padding: 5px;
}
.kaze-task-panel {
  flex: 1 1 auto; min-height: 0;
  border: 1px solid var(--kz-border); border-radius: 8px;
  padding: 7px 8px; background: var(--kz-surface);
  display: flex; flex-direction: column; gap: 5px;
}
.kaze-task-head { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.kaze-task-head strong { font-size: 11px; font-weight: 600; }
.kaze-progress { height: 4px; border-radius: 999px; background: var(--kz-border); overflow: hidden; }
.kaze-progress > i { display: block; height: 100%; background: var(--kz-ok); border-radius: inherit; transition: width .25s ease; }
.kaze-task-list { display: flex; flex-direction: column; gap: 1px; flex: 1 1 auto; min-height: 0; max-height: none; overflow-y: auto; overflow-x: hidden; }
.kaze-task-hint { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; color: var(--kz-text-3); font-size: 10.5px; }
.kaze-task-row[data-queued] { background: color-mix(in srgb, var(--kz-accent) 7%, transparent); border-radius: 4px; }
.kaze-task-row {
  display: flex; align-items: center; gap: 5px; width: 100%; box-sizing: border-box;
  padding: 2px 4px; border: 1px solid transparent; border-radius: 5px;
  background: transparent; cursor: pointer; text-align: left; font-size: 10.8px;
}
.kaze-task-row:hover { background: var(--kz-hover); }
.kaze-task-row .kaze-tid { font-family: var(--kz-mono); font-size: 10.5px; color: var(--kz-text-3); min-width: 22px; }
.kaze-task-row .kaze-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.kaze-task-row[data-status="completed"] .kaze-title { color: var(--kz-text-3); text-decoration: line-through; }
.kaze-task-row[data-status="in_progress"] .kaze-tid,
.kaze-task-row[data-status="queued"] .kaze-tid { color: var(--kz-accent); }
.kaze-task-row .kaze-star { color: var(--kz-warn); }
.kaze-task-run {
  display: none; align-items: center; justify-content: center;
  width: 18px; height: 18px; flex: none; padding: 0;
  border: 1px solid var(--kz-border); border-radius: 4px;
  background: transparent; color: var(--kz-text-2); cursor: pointer;
}
.kaze-task-row:hover .kaze-task-run, .kaze-task-row:focus-visible .kaze-task-run { display: inline-flex; }
.kaze-task-run:hover { color: var(--kz-accent); border-color: color-mix(in srgb, var(--kz-accent) 45%, transparent); }
.kaze-more { color: var(--kz-text-3); font-size: 10.5px; }
.kaze-toast {
  position: absolute; bottom: 10px; left: 0; right: 0; z-index: 80;
  display: flex; align-items: center; gap: 6px;
  margin: 0 auto; padding: 5px 9px; border-radius: 999px;
  background: var(--dsw-alias-toast-bg, var(--kz-text));
  color: var(--dsw-alias-toast-label, var(--kz-surface));
  font-size: 10.8px; box-shadow: var(--dsw-elevation-soft, 0 4px 14px rgba(0,0,0,.18));
  animation: kaze-pop .14s ease-out; width: fit-content; max-width: 100%;
}
.kaze-toast[data-tone="error"] { background: var(--kz-danger); color: #fff; }
.kaze-visually-hidden {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0;
}

.kaze-diff { display: flex; flex-direction: column; gap: 6px; font-size: 10.5px; }
.kaze-diff-bar { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; }
.kaze-diff-bar strong { font-size: 11px; font-weight: 600; }
.kaze-diff-grid { display: flex; flex-direction: column; border: 1px solid var(--kz-border); border-radius: 7px; overflow-x: auto; overscroll-behavior-x: contain; }
.kaze-diff-heads { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 1px; background: var(--kz-border); color: var(--kz-text-3); font-size: 10.5px; position: sticky; top: 0; z-index: 2; min-width: 440px; }
.kaze-diff-heads > span { padding: 3px 5px; background: var(--kz-surface-2); }
.kaze-diff-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 1px; background: var(--kz-border); min-width: 440px; }
.kaze-diff-cell { display: flex; gap: 5px; min-width: 0; padding: 1px 4px; background: var(--kz-surface); font-family: var(--kz-mono); line-height: 1.55; overflow-wrap: anywhere; }
.kaze-diff-cell[data-kind="equal"] { color: var(--kz-text-2); }
.kaze-diff-left[data-kind="remove"], .kaze-diff-left[data-kind="change"] { background: color-mix(in srgb, var(--kz-danger) 12%, var(--kz-surface)); }
.kaze-diff-right[data-kind="add"], .kaze-diff-right[data-kind="change"] { background: color-mix(in srgb, var(--kz-ok) 12%, var(--kz-surface)); }
.kaze-diff-no { flex: none; width: 26px; text-align: right; color: var(--kz-text-3); font-variant-numeric: tabular-nums; user-select: none; }
.kaze-diff-text { flex: 1; min-width: 0; white-space: pre-wrap; word-break: break-word; }
.kaze-diff-row:has(.kaze-diff-left[data-kind="remove"]) .kaze-diff-left .kaze-diff-text { text-decoration: line-through; text-decoration-color: color-mix(in srgb, currentColor 45%, transparent); }
.kaze-lightbox { position: fixed; inset: 0; z-index: 100; display: flex; align-items: center; justify-content: center; padding: 24px; background: color-mix(in srgb, #000 72%, transparent); backdrop-filter: blur(3px); }
.kaze-lightbox img { max-width: min(94vw, 1200px); max-height: 88vh; object-fit: contain; border-radius: 8px; box-shadow: 0 18px 60px rgba(0,0,0,.5); background: var(--kz-surface); }
.kaze-lightbox-close { position: absolute; top: 14px; right: 14px; width: 30px; height: 30px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid rgba(255,255,255,.25); border-radius: 8px; background: rgba(0,0,0,.35); color: #fff; cursor: pointer; }
.kaze-lightbox-close:hover { background: rgba(0,0,0,.55); }
.kaze-doc::-webkit-scrollbar, .kaze-menu-list::-webkit-scrollbar, .kaze-task-list::-webkit-scrollbar, .kaze-diff-grid::-webkit-scrollbar, .kaze-validation-list::-webkit-scrollbar { width: 8px; height: 8px; }
.kaze-doc::-webkit-scrollbar-thumb, .kaze-menu-list::-webkit-scrollbar-thumb, .kaze-task-list::-webkit-scrollbar-thumb, .kaze-diff-grid::-webkit-scrollbar-thumb, .kaze-validation-list::-webkit-scrollbar-thumb {
  background: var(--dsh-scrollbar-thumb, rgba(127,127,127,.35)); border-radius: 999px;
}

/* Bundle settings rendered by the plugin manager page, outside .kaze-root. */
.kaze-settings {
  --kz-s-text: var(--dsw-alias-label-primary, #1f2328);
  --kz-s-text-2: var(--dsw-alias-label-secondary, #57606a);
  --kz-s-text-3: var(--dsw-alias-label-tertiary, #6a737d);
  --kz-s-border-strong: var(--dsw-alias-border-l2, rgba(127,127,127,.32));
  --kz-s-surface: var(--dsw-alias-bg-layer-1, rgba(127,127,127,.05));
  --kz-s-accent: var(--dsw-alias-state-business-primary, #4176e6);
  display: flex; flex-direction: column; gap: 14px;
  max-width: 760px; color: var(--kz-s-text); font-size: 13px; line-height: 1.55;
}
.kaze-settings-intro { display: flex; flex-direction: column; gap: 4px; }
.kaze-settings-intro h4 { margin: 0; font-size: 13px; font-weight: 600; }
.kaze-settings-intro p { margin: 0; color: var(--kz-s-text-2); }
.kaze-settings-group { display: flex; flex-direction: column; gap: 10px; padding: 12px; border: .5px solid var(--kz-s-border-strong); border-radius: var(--dsw-radius-md, 8px); }
.kaze-settings-group > h5 { margin: 0; color: var(--kz-s-text-3); font-size: 11px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; }
.kaze-settings-field { display: flex; flex-direction: column; gap: 6px; color: var(--kz-s-text-2); }
.kaze-settings-field > span { color: var(--kz-s-text); font-weight: 500; }
/* Every field control shares one style. A text input carries no type attribute,
   so match by exclusion: keying off [type="number"]/[type="time"] alone left the
   capability input showing the raw browser box next to the styled selects. */
.kaze-settings-field select,
.kaze-settings-field input:not([type="checkbox"]):not([type="radio"]) {
  height: 32px; padding: 0 8px; box-sizing: border-box;
  border: .5px solid var(--kz-s-border-strong); border-radius: var(--dsw-radius-sm, 6px);
  background: var(--kz-s-surface); color: var(--kz-s-text); font: inherit;
}
.kaze-settings-field :is(select, input):focus-visible { outline: 2px solid color-mix(in srgb, var(--kz-s-accent) 60%, transparent); outline-offset: 1px; }
.kaze-settings-field :is(select, input):disabled { opacity: .6; }
.kaze-settings-field input::placeholder { color: var(--kz-s-text-3); }
.kaze-settings-toggle { display: flex; gap: 8px; align-items: flex-start; color: var(--kz-s-text); }
.kaze-settings-toggle input { margin: 3px 0 0; width: 14px; height: 14px; accent-color: var(--kz-s-accent); }
.kaze-settings-toggle span { display: block; font-weight: 500; }
.kaze-settings-toggle small { display: block; color: var(--kz-s-text-3); font-weight: 400; font-size: 12px; }
.kaze-settings-window { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding: 8px; border: .5px solid var(--kz-s-border-strong); border-radius: 6px; }
.kaze-settings-days { display: flex; gap: 2px; }
.kaze-settings-day { width: 22px; height: 22px; padding: 0; border: .5px solid var(--kz-s-border-strong); border-radius: 4px; background: transparent; color: var(--kz-s-text-2); font: inherit; font-size: 11px; cursor: pointer; }
.kaze-settings-day[aria-pressed="true"] { background: color-mix(in srgb, var(--kz-s-accent) 16%, transparent); border-color: var(--kz-s-accent); color: var(--kz-s-text); }
.kaze-settings-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.kaze-settings-group > button { align-self: flex-start; }
.kaze-settings-btn { height: 30px; padding: 0 12px; border: .5px solid var(--kz-s-border-strong); border-radius: var(--dsw-radius-sm, 6px); background: var(--kz-s-surface); color: var(--kz-s-text); font: inherit; cursor: pointer; }
.kaze-settings-btn:hover:not(:disabled) { background: color-mix(in srgb, var(--kz-s-accent) 10%, transparent); }
.kaze-settings-btn:disabled { opacity: .6; cursor: default; }
.kaze-settings-btn[data-kind="primary"] { background: var(--kz-s-accent); border-color: var(--kz-s-accent); color: #fff; }
.kaze-settings-note { margin: 0; color: var(--kz-s-text-3); font-size: 12px; }
.kaze-settings-list { margin: 0; padding-left: 18px; color: var(--kz-s-text-2); font-size: 12px; }
.kaze-settings-list li + li { margin-top: 3px; }
.kaze-settings-list li::marker { color: var(--kz-s-text-3); }
.kaze-settings-list strong { color: var(--kz-s-text); font-weight: 600; }
.kaze-settings-hint { margin: -6px 0 0; color: var(--kz-s-text-3); font-size: 12px; }
.kaze-settings-status { margin: 0; color: var(--kz-s-text-2); font-size: 12px; }
.kaze-settings-status[data-tone="error"] { color: var(--dsw-alias-state-error-primary, #d64545); }
@media (prefers-reduced-motion: reduce) {
  .kaze-root *, .kaze-root *::before, .kaze-root *::after { animation: none !important; transition: none !important; }
}
`

export function installStyles(): void {
  if (typeof document === 'undefined') return
  if (document.getElementById(STYLE_ID) !== null) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = CSS
  document.head.append(style)
}

