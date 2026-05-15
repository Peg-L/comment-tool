// src/panel.js
const COLORS = [
  '#ef4444','#f97316','#eab308','#22c55e',
  '#3b82f6','#8b5cf6','#ec4899','#14b8a6',
];
function getColor(i) { return COLORS[i % COLORS.length]; }

const CSS = `
:host {
  all: initial;
  display: block;
  position: fixed;
  top: 0;
  right: 0;
  width: 320px;
  height: 100vh;
  z-index: 2147483647;
  pointer-events: none;
  overflow: visible;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 13px;
  line-height: 1.5;
}
.panel {
  pointer-events: all;
  width: 100%;
  height: 100%;
  background: #1e1e2e;
  color: #cdd6f4;
  display: flex;
  flex-direction: column;
  box-shadow: -4px 0 24px rgba(0,0,0,0.5);
  transition: transform 0.2s ease;
}
.panel.collapsed { transform: translateX(100%); }
.toggle-btn {
  pointer-events: all;
  position: absolute;
  left: -28px;
  top: 50%;
  transform: translateY(-50%);
  width: 28px;
  height: 56px;
  background: #313244;
  border: none;
  border-radius: 6px 0 0 6px;
  cursor: pointer;
  color: #cdd6f4;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: -2px 0 8px rgba(0,0,0,0.3);
}
.toolbar {
  padding: 10px 12px;
  background: #181825;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  border-bottom: 1px solid #313244;
}
.btn {
  padding: 5px 10px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  transition: opacity 0.1s;
}
.btn:hover { opacity: 0.85; }
.btn:active { opacity: 0.65; }
.btn-primary { background: #89b4fa; color: #1e1e2e; }
.btn-danger  { background: #f38ba8; color: #1e1e2e; }
.btn-success { background: #a6e3a1; color: #1e1e2e; }
.btn-neutral { background: #313244; color: #cdd6f4; }
.btn.active  { background: #cba6f7; color: #1e1e2e; }
.proj-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: #181825;
  border-bottom: 1px solid #313244;
  font-size: 12px;
  color: #a6adc8;
}
.proj-icon { font-size: 13px; }
.proj-label {
  flex: 1;
  font-weight: 600;
  color: #cba6f7;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.btn-xs { padding: 2px 8px; font-size: 11px; }
.list-header {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: #6c7086;
  padding: 8px 12px 4px;
}
.list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}
.list::-webkit-scrollbar { width: 4px; }
.list::-webkit-scrollbar-track { background: transparent; }
.list::-webkit-scrollbar-thumb { background: #45475a; border-radius: 2px; }
.comment-item {
  padding: 8px 12px;
  border-bottom: 1px solid #1e1e2e;
  cursor: pointer;
  transition: background 0.1s;
}
.comment-item:hover { background: #313244; }
.comment-item.missing { opacity: 0.5; }
.comment-header { display: flex; align-items: center; gap: 5px; margin-bottom: 3px; }
.badge {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  font-size: 10px;
  font-weight: bold;
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.comment-tag {
  font-size: 10px;
  background: #1e1e3a;
  color: #89b4fa;
  border-radius: 3px;
  padding: 1px 4px;
  font-family: monospace;
  flex-shrink: 0;
}
.comment-label {
  font-size: 11px;
  color: #6c7086;
  font-family: monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}
.comment-text {
  font-size: 12px;
  color: #cdd6f4;
  word-break: break-word;
  padding-left: 24px;
  margin-bottom: 2px;
}
.comment-inner {
  font-size: 11px;
  color: #6c7086;
  padding-left: 24px;
  margin-bottom: 4px;
  font-style: italic;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.comment-actions { padding-left: 24px; display: flex; gap: 4px; }
.btn-del {
  padding: 2px 8px;
  font-size: 11px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  background: rgba(243,139,168,0.15);
  color: #f38ba8;
  transition: background 0.1s;
  flex-shrink: 0;
}
.btn-del:hover { background: #f38ba8; color: #1e1e2e; }
.btn-edit-item {
  padding: 2px 8px;
  font-size: 11px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  background: rgba(137,180,250,0.15);
  color: #89b4fa;
  transition: background 0.1s;
}
.btn-edit-item:hover { background: #89b4fa; color: #1e1e2e; }
.empty {
  text-align: center;
  padding: 40px 16px;
  color: #6c7086;
  font-size: 12px;
}
.toast {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: #a6e3a1;
  color: #1e1e2e;
  padding: 8px 18px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.25s;
  z-index: 1;
}
.toast.show { opacity: 1; }
/* Floating dialog — no backdrop, positioned near the element */
.dialog {
  position: fixed;
  pointer-events: all;
  background: #1e1e2e;
  border: 1px solid #45475a;
  border-radius: 10px;
  padding: 16px;
  width: 280px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.6);
  z-index: 3;
}
.dialog h3 { margin: 0 0 10px; font-size: 14px; color: #cdd6f4; font-weight: 600; }
.dialog textarea {
  width: 100%;
  box-sizing: border-box;
  background: #313244;
  border: 1px solid #45475a;
  border-radius: 6px;
  color: #cdd6f4;
  font-size: 13px;
  padding: 8px;
  resize: vertical;
  min-height: 80px;
  font-family: inherit;
  outline: none;
}
.dialog textarea:focus { border-color: #89b4fa; }
.dialog-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
}
.dialog-actions .spacer { flex: 1; }
/* ── Project flyout ── */
.proj-flyout-btn {
  width: 100%;
  background: #313244;
  color: #cdd6f4;
  border: none;
  border-radius: 5px;
  padding: 5px 10px;
  font-size: 12px;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  transition: background 0.1s;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.proj-flyout-btn:hover { background: #45475a; }
.proj-flyout {
  display: none;
  flex-direction: column;
  background: #1a1a2e;
  border-bottom: 1px solid #313244;
  max-height: 280px;
  overflow-y: auto;
}
.proj-flyout.open { display: flex; }
.proj-flyout::-webkit-scrollbar { width: 4px; }
.proj-flyout::-webkit-scrollbar-track { background: transparent; }
.proj-flyout::-webkit-scrollbar-thumb { background: #45475a; border-radius: 2px; }
.proj-acc-list { padding: 8px 10px 4px; flex: 1; }
.proj-acc-row { border-radius: 6px; margin-bottom: 2px; overflow: hidden; }
.proj-acc-hdr {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  cursor: pointer;
  border-radius: 6px;
  transition: background 0.1s;
}
.proj-acc-hdr:hover { background: #313244; }
.proj-acc-row.current > .proj-acc-hdr { background: #2a2a3e; cursor: default; }
.proj-acc-name {
  flex: 1;
  font-size: 12px;
  color: #cdd6f4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.proj-acc-row.current > .proj-acc-hdr .proj-acc-name { color: #cba6f7; }
.proj-acc-badge {
  font-size: 10px;
  background: #cba6f7;
  color: #1e1e2e;
  border-radius: 3px;
  padding: 1px 5px;
  font-weight: 600;
  flex-shrink: 0;
}
.proj-acc-arrow { font-size: 10px; color: #6c7086; flex-shrink: 0; }
.proj-acc-del {
  padding: 1px 6px;
  font-size: 11px;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  background: rgba(243,139,168,0.15);
  color: #f38ba8;
  flex-shrink: 0;
  transition: background 0.1s;
}
.proj-acc-del:hover { background: #f38ba8; color: #1e1e2e; }
.proj-acc-pages {
  padding: 2px 8px 4px 16px;
  margin: 0 8px 4px;
  border-left: 2px solid #313244;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.proj-acc-page {
  display: flex;
  align-items: baseline;
  gap: 4px;
  padding: 2px 0;
  font-size: 11px;
  color: #89b4fa;
  cursor: pointer;
  font-family: monospace;
  text-decoration: underline;
  text-underline-offset: 2px;
}
.proj-acc-page:hover { color: #cba6f7; }
.proj-acc-page-count { color: #585869; font-size: 10px; text-decoration: none; flex-shrink: 0; }
.proj-acc-empty { font-size: 11px; color: #6c7086; font-style: italic; padding: 2px 0; }
.proj-add-row {
  display: flex;
  gap: 6px;
  padding: 8px 10px;
  border-top: 1px solid #313244;
  background: #181825;
  flex-shrink: 0;
}
.proj-add-input {
  flex: 1;
  min-width: 0;
  background: #313244;
  border: 1px solid #45475a;
  border-radius: 5px;
  color: #cdd6f4;
  font-size: 12px;
  padding: 4px 8px;
  outline: none;
  font-family: inherit;
}
.proj-add-input:focus { border-color: #89b4fa; }
`;

export class PanelUI {
  constructor(doc) {
    this._doc = doc;
    this._host = null;
    this._shadow = null;
    this._panel = null;
    this._listEl = null;
    this._collapsed = false;
    this._pickActive = false;
    this._cbs = {};
    this._project = '';
    this._flyoutOpen = false;
    this._flyoutExpandedProject = null;
    this._flyoutEl = null;
    this._projFlyoutBtn = null;
    this._flyoutOutsideHandler = null;
  }

  on(event, cb) { this._cbs[event] = cb; return this; }
  _emit(event, ...args) { if (this._cbs[event]) this._cbs[event](...args); }

  get isCollapsed() { return this._collapsed; }

  mount() {
    if (this._host) return;
    this._host = this._doc.createElement('div');
    this._host.setAttribute('data-__ct__panel', 'true');
    this._shadow = this._host.attachShadow({ mode: 'open' });

    const style = this._doc.createElement('style');
    style.textContent = CSS;
    this._shadow.appendChild(style);

    this._panel = this._doc.createElement('div');
    this._panel.className = 'panel';
    this._shadow.appendChild(this._panel);

    this._buildPanel();
    this._doc.body.appendChild(this._host);
  }

  _buildPanel() {
    const p = this._panel;
    p.innerHTML = '';

    // Toggle button (always visible, shows shortcut hint)
    const toggle = this._el('button', 'toggle-btn', this._collapsed ? '◀' : '▶');
    toggle.title = '收起/展開 (Alt+C)';
    toggle.addEventListener('click', () => this._toggleCollapse());
    p.appendChild(toggle);

    // Toolbar
    const tb = this._el('div', 'toolbar');
    this._pickBtn = this._btn('🎯 選取元素', 'btn-primary', () => this._emit('pickRequest'));
    const exportBtn = this._btn('📋 複製 Prompt', 'btn-success', () => this._emit('exportPrompt'));
    const clearBtn  = this._btn('🗑 清除全部', 'btn-danger', () => {
      if (this._doc.defaultView.confirm('確定清除所有標註？')) this._emit('clear');
    });
    const dlBtn    = this._btn('⬇ JSON', 'btn-neutral', () => this._emit('exportJSON'));
    const ulBtn    = this._btn('⬆ 匯入', 'btn-neutral', () => {
      const json = this._doc.defaultView.prompt('貼上 JSON 內容：');
      if (json) this._emit('importJSON', json);
    });
    const shareBtn = this._btn('🔗 分享', 'btn-neutral', () => this._emit('shareLink'));
    tb.append(this._pickBtn, exportBtn, clearBtn, dlBtn, ulBtn, shareBtn);
    p.appendChild(tb);

    // Project bar with flyout toggle
    const projBar = this._el('div', 'proj-bar');
    this._projFlyoutBtn = this._el('button', 'proj-flyout-btn', '📁 … ▾');
    this._projFlyoutBtn.addEventListener('click', () => this._toggleFlyout());
    projBar.appendChild(this._projFlyoutBtn);
    p.appendChild(projBar);

    // Flyout (hidden until toggled open)
    this._flyoutEl = this._el('div', 'proj-flyout');
    p.appendChild(this._flyoutEl);

    // List header
    p.appendChild(this._el('div', 'list-header', '標註清單'));

    // List
    this._listEl = this._el('div', 'list');
    this._listEl.innerHTML = '<div class="empty">尚無標註。點擊「🎯 選取元素」開始。</div>';
    p.appendChild(this._listEl);
  }

  _el(tag, cls, text) {
    const el = this._doc.createElement(tag);
    if (cls) el.className = cls;
    if (text != null) el.textContent = text;
    return el;
  }

  _btn(label, cls, onClick) {
    const b = this._el('button', 'btn ' + cls, label);
    b.addEventListener('click', onClick);
    return b;
  }

  _toggleCollapse() {
    this._collapsed = !this._collapsed;
    this._panel.classList.toggle('collapsed', this._collapsed);
    const toggle = this._shadow.querySelector('.toggle-btn');
    if (toggle) toggle.textContent = this._collapsed ? '◀' : '▶';
  }

  /** Public: toggle collapse state (used by keyboard shortcut) */
  toggleCollapse() { this._toggleCollapse(); }

  /** Public: expand panel if collapsed */
  open() { if (this._collapsed) this._toggleCollapse(); }

  refresh(comments, isMissing) {
    if (!this._listEl) return;
    this._listEl.innerHTML = '';

    if (!comments.length) {
      this._listEl.innerHTML = '<div class="empty">尚無標註。點擊「🎯 選取元素」開始。</div>';
      return;
    }

    comments.forEach((c, i) => {
      const missing = isMissing(c.id);
      const meta = c.meta || {};
      const item = this._el('div', 'comment-item' + (missing ? ' missing' : ''));

      // Header: badge + tagName chip + selector label
      const hdr = this._el('div', 'comment-header');
      const badge = this._el('span', 'badge', String(i + 1));
      badge.style.background = getColor(i);
      hdr.appendChild(badge);
      if (meta.tagName) hdr.appendChild(this._el('span', 'comment-tag', meta.tagName));
      const label = this._el('span', 'comment-label',
        missing ? `${c.elementLabel} ⚠ 元素已不存在` : c.elementLabel);
      label.title = c.selector;
      hdr.appendChild(label);

      // Comment text
      const textEl = this._el('div', 'comment-text', c.text);

      item.append(hdr, textEl);

      // Inner content snippet to help identify the element
      if (meta.innerText) {
        const snippet = meta.innerText.slice(0, 60);
        item.appendChild(this._el('div', 'comment-inner',
          `"${snippet}${meta.innerText.length > 60 ? '…' : ''}"`));
      }

      // Actions
      const actions = this._el('div', 'comment-actions');
      const editBtn = this._el('button', 'btn-edit-item', '編輯');
      editBtn.addEventListener('click', (e) => { e.stopPropagation(); this._emit('edit', c.id); });
      const delBtn = this._el('button', 'btn-del', '刪除');
      delBtn.addEventListener('click', (e) => { e.stopPropagation(); this._emit('delete', c.id); });
      actions.append(editBtn, delBtn);
      item.appendChild(actions);

      // Click item → scroll to element
      item.addEventListener('click', () => {
        const el = this._doc.querySelector(c.selector);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      this._listEl.appendChild(item);
    });
  }

  setProject(name) {
    this._project = name;
    if (this._projFlyoutBtn) {
      this._projFlyoutBtn.textContent = `📁 ${name || '（未命名）'} ▾`;
    }
  }

  _openFlyout() {
    if (this._flyoutOpen) return;
    this._flyoutOpen = true;
    this._flyoutExpandedProject = this._project;
    this._flyoutEl.classList.add('open');
    this._emit('flyoutOpen');
    this._flyoutOutsideHandler = (e) => {
      if (!e.composedPath().includes(this._host)) this._closeFlyout();
    };
    this._doc.addEventListener('click', this._flyoutOutsideHandler, { capture: true });
  }

  _closeFlyout() {
    if (!this._flyoutOpen) return;
    this._flyoutOpen = false;
    this._flyoutEl.classList.remove('open');
    if (this._flyoutOutsideHandler) {
      this._doc.removeEventListener('click', this._flyoutOutsideHandler, { capture: true });
      this._flyoutOutsideHandler = null;
    }
  }

  _toggleFlyout() {
    if (this._flyoutOpen) this._closeFlyout();
    else this._openFlyout();
  }

  /**
   * Render the flyout contents.
   * @param {string[]} projects       Sorted project names
   * @param {Object}   pagesMap       { [projectName]: Array<{url,path,count}> }
   */
  setFlyoutData(projects, pagesMap) {
    if (!this._flyoutEl) return;
    this._flyoutEl.innerHTML = '';

    // ── Accordion list ─────────────────────────────────────────────────────
    const list = this._el('div', 'proj-acc-list');

    projects.forEach(p => {
      const isCurrent  = p === this._project;
      const isExpanded = p === this._flyoutExpandedProject;
      const pages      = pagesMap[p] || [];

      const row = this._el('div', 'proj-acc-row' + (isCurrent ? ' current' : ''));

      // Header row
      const hdr  = this._el('div', 'proj-acc-hdr');
      const name = this._el('span', 'proj-acc-name', p);
      hdr.appendChild(name);

      if (isCurrent) {
        hdr.appendChild(this._el('span', 'proj-acc-badge', '目前'));
      } else {
        const arrow  = this._el('span', 'proj-acc-arrow', isExpanded ? '▼' : '▶');
        const delBtn = this._el('button', 'proj-acc-del', '刪除');
        delBtn.addEventListener('click', e => {
          e.stopPropagation();
          if (!this._doc.defaultView.confirm(`確定刪除專案「${p}」及其所有標註？`)) return;
          this._emit('deleteProject', { name: p });
        });
        hdr.append(arrow, delBtn);
        hdr.addEventListener('click', () => {
          this._flyoutExpandedProject = isExpanded ? null : p;
          this._emit('flyoutOpen'); // ask index.js to re-render with new expanded state
        });
      }

      row.appendChild(hdr);

      // Pages (shown when expanded or current)
      if (isCurrent || isExpanded) {
        const pagesDiv = this._el('div', 'proj-acc-pages');
        if (!pages.length) {
          pagesDiv.appendChild(this._el('span', 'proj-acc-empty', '此專案尚無標註頁面'));
        } else {
          pages.forEach(({ url, path, count }) => {
            const link  = this._el('span', 'proj-acc-page', `↗ ${path} `);
            const cnt   = this._el('span', 'proj-acc-page-count', `${count} 筆`);
            link.appendChild(cnt);
            link.addEventListener('click', e => {
              e.stopPropagation();
              this._closeFlyout();
              this._emit('navigateToPage', { url, project: p });
            });
            pagesDiv.appendChild(link);
          });
        }
        row.appendChild(pagesDiv);
      }

      list.appendChild(row);
    });

    this._flyoutEl.appendChild(list);

    // ── Add new project row ────────────────────────────────────────────────
    const addRow   = this._el('div', 'proj-add-row');
    const input    = this._doc.createElement('input');
    input.type        = 'text';
    input.className   = 'proj-add-input';
    input.placeholder = '新專案名稱…';
    const createBtn   = this._btn('建立', 'btn-primary', () => {
      const n = input.value.trim();
      if (!n) { input.focus(); return; }
      input.value = '';
      this._closeFlyout();
      this._emit('createProject', { name: n });
    });
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter')  createBtn.click();
      if (e.key === 'Escape') this._closeFlyout();
      e.stopPropagation();
    });
    addRow.append(input, createBtn);
    this._flyoutEl.appendChild(addRow);
  }

  setPickActive(active) {
    this._pickActive = active;
    if (this._pickBtn) this._pickBtn.classList.toggle('active', active);
  }

  showToast(msg) {
    let t = this._shadow.querySelector('.toast');
    if (!t) { t = this._el('div', 'toast'); this._shadow.appendChild(t); }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  /**
   * Show a floating comment dialog positioned near (anchorX, anchorY).
   * No full-page backdrop — small card only.
   * @returns {Promise<{action:'save'|'delete'|'cancel', text?:string}>}
   */
  showDialogAt(anchorX, anchorY, opts = {}) {
    const { existing = '', showDelete = false } = opts;
    return new Promise(resolve => {
      const vw = this._doc.defaultView.innerWidth;
      const vh = this._doc.defaultView.innerHeight;
      const W = 280, H_EST = 190, pad = 12;

      // Position near anchor, clamped to viewport
      let left = anchorX + pad;
      let top  = anchorY + pad;
      if (left + W  > vw - pad) left = anchorX - W - pad;
      if (left < pad) left = pad;
      if (top  + H_EST > vh - pad) top = anchorY - H_EST - pad;
      if (top  < pad) top = pad;

      const dialog = this._el('div', 'dialog');
      dialog.style.left = `${left}px`;
      dialog.style.top  = `${top}px`;

      const h3 = this._el('h3', null, existing ? '編輯標註' : '新增標註');
      const ta = this._doc.createElement('textarea');
      ta.value = existing;
      ta.placeholder = '輸入意見… (Ctrl+Enter 確認，Esc 取消)';

      const actions = this._el('div', 'dialog-actions');

      const done = (result) => { dialog.remove(); resolve(result); };

      if (showDelete) {
        const delBtn = this._btn('刪除', 'btn-danger', () => done({ action: 'delete' }));
        const spacer = this._el('span', 'spacer');
        actions.append(delBtn, spacer);
      }
      const cancelBtn = this._btn('取消', 'btn-neutral', () => done({ action: 'cancel' }));
      const saveBtn   = this._btn('儲存', 'btn-primary', () => {
        const text = ta.value.trim();
        done({ action: text ? 'save' : 'cancel', text });
      });
      actions.append(cancelBtn, saveBtn);

      dialog.append(h3, ta, actions);
      this._shadow.appendChild(dialog);
      requestAnimationFrame(() => ta.focus());

      ta.addEventListener('keydown', e => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) saveBtn.click();
        if (e.key === 'Escape') cancelBtn.click();
        e.stopPropagation();
      });
    });
  }

  unmount(){
    if (this._host) { this._host.remove(); this._host = null; this._shadow = null; }
  }
}