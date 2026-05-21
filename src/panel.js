// src/panel.js
const RED = '#ef4444';

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
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
iconify-icon { font-size: inherit; flex-shrink: 0; }
.btn:hover { opacity: 0.85; }
.btn:active { opacity: 0.65; }
.btn-primary { background: #89b4fa; color: #1e1e2e; }
.btn-danger  { background: #f38ba8; color: #1e1e2e; }
.btn-success { background: #a6e3a1; color: #1e1e2e; }
.btn-neutral { background: #313244; color: #cdd6f4; }
.btn-teal    { background: #2dd4bf; color: #1e1e2e; }
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
.list-header {
  display: flex;
  align-items: center;
  padding: 6px 12px 4px;
  gap: 8px;
}
.list-header-title {
  flex: 1;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: #6c7086;
}
.mode-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 12px 6px;
  background: #181825;
  border-bottom: 1px solid #313244;
  font-size: 12px;
  color: #6c7086;
}
.mode-label.active { color: #cdd6f4; font-weight: 700; }
.mode-switch {
  width: 34px;
  height: 18px;
  border: none;
  border-radius: 999px;
  background: #45475a;
  padding: 2px;
  cursor: pointer;
  transition: background 0.15s;
}
.mode-switch.dev { background: #89b4fa; }
.mode-switch-knob {
  display: block;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.15s;
}
.mode-switch.dev .mode-switch-knob { transform: translateX(16px); }
.hide-done-control {
  display: none;
  align-items: center;
  gap: 4px;
  color: #a6adc8;
  font-size: 11px;
  white-space: nowrap;
  cursor: pointer;
}
.hide-done-control.visible { display: inline-flex; }
.hide-done-control input,
.comment-done-box {
  accent-color: #a6e3a1;
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
.comment-item.done { opacity: 0.58; }
.comment-item.done .comment-text { text-decoration: line-through; color: #8b8fa7; }
.comment-header { display: flex; align-items: center; gap: 5px; margin-bottom: 3px; }
.comment-done-box {
  width: 14px;
  height: 14px;
  margin: 0;
  flex-shrink: 0;
}
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
  display: flex;
  align-items: center;
  gap: 6px;
  overflow: hidden;
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
.proj-search-row {
  padding: 8px 10px 0;
}
.proj-search-input {
  width: 100%;
  min-width: 0;
  background: #313244;
  border: 1px solid #45475a;
  border-radius: 5px;
  color: #cdd6f4;
  font-size: 12px;
  padding: 5px 8px;
  outline: none;
  font-family: inherit;
}
.proj-search-input:focus { border-color: #89b4fa; }
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
.proj-page-del {
  padding: 1px 6px;
  font-size: 11px;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  background: rgba(137,180,250,0.15);
  color: #89b4fa;
  flex-shrink: 0;
  transition: background 0.1s;
}
.proj-acc-pages {
  padding: 2px 8px 4px 16px;
  margin: 0 8px 4px;
  border-left: 2px solid #313244;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.proj-acc-page-row {
  display: flex;
  align-items: baseline;
  gap: 4px;
}
.proj-acc-page {
  flex: 1;
  min-width: 0;
  padding: 2px 0;
  font-size: 11px;
  color: #89b4fa;
  cursor: pointer;
  font-family: monospace;
  text-decoration: underline;
  text-underline-offset: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.proj-acc-page:hover { color: #cba6f7; }
.proj-acc-page-count { color: #585869; font-size: 10px; text-decoration: none; flex-shrink: 0; }
.proj-page-del {
  background: transparent;
  color: #6c7086;
}
.proj-page-del:hover { background: rgba(243,139,168,0.15); color: #f38ba8; }
.proj-acc-empty { font-size: 11px; color: #6c7086; font-style: italic; padding: 2px 0; }
/* ── Pick group with switch toggle ── */
.pick-group {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.pick-switch {
  display: inline-block;
  width: 30px;
  height: 17px;
  position: relative;
  flex-shrink: 0;
  cursor: pointer;
  border-radius: 9px;
}
.pick-switch-track {
  position: absolute;
  inset: 0;
  background: #45475a;
  border-radius: 9px;
  transition: background 0.2s;
}
.pick-switch-track.on { background: #a6e3a1; }
.pick-switch-knob {
  position: absolute;
  width: 13px;
  height: 13px;
  top: 2px;
  left: 2px;
  background: #fff;
  border-radius: 50%;
  transition: transform 0.2s;
  pointer-events: none;
}
.pick-switch-track.on .pick-switch-knob { transform: translateX(13px); }
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
    this._visBtn = null;
    this._cbs = {};
    this._project = '';
    this._flyoutOpen = false;
    this._flyoutEl = null;
    this._projFlyoutBtn = null;
    this._flyoutOutsideHandler = null;
    this._noProject = false;
    this._pageSearch = '';
    this._mode = 'reviewer';
    this._hideDone = false;
    this._lastRefresh = null;
    this._modeSwitch = null;
    this._hideDoneControl = null;
  }

  on(event, cb) { this._cbs[event] = cb; return this; }
  _emit(event, ...args) {
    const cb = this._cbs[event];
    if (!cb) return undefined;
    try {
      const result = cb(...args);
      if (result && typeof result.catch === 'function') {
        result.catch(e => this.showToast(`操作失敗：${e.message || e}`));
      }
      return result;
    } catch (e) {
      this.showToast(`操作失敗：${e.message || e}`);
      return undefined;
    }
  }

  get isCollapsed() { return this._collapsed; }
  get isDeveloperMode() { return this._mode === 'developer'; }

  mount() {
    if (this._host) return;
    // Inject Iconify web component script once per page
    if (!this._doc.defaultView.customElements.get('iconify-icon')) {
      const s = this._doc.createElement('script');
      s.src = 'https://code.iconify.design/iconify-icon/2.1.0/iconify-icon.min.js';
      this._doc.head.appendChild(s);
    }
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
    const toggle = this._doc.createElement('button');
    toggle.className = 'toggle-btn';
    toggle.appendChild(this._icon(this._collapsed ? 'mdi:chevron-right' : 'mdi:chevron-left'));
    toggle.title = '收起/展開 (Alt+C)';
    toggle.addEventListener('click', () => this._toggleCollapse());
    p.appendChild(toggle);

    // Toolbar
    const tb = this._el('div', 'toolbar');

    this._pickBtn = this._btn('mdi:cursor-default-click', '選取元素', 'btn-primary', () => this._emit('pickRequest'));
    this._visBtn  = this._btn('mdi:eye-off-outline', '隱藏標註', 'btn-neutral', () => this._emit('toggleOverlay'));
    const exportBtn = this._btn('mdi:content-copy', '複製 Prompt', 'btn-success', () => this._emit('exportPrompt'));
    const copyDataBtn = this._btn('mdi:database-export-outline', '複製資料', 'btn-teal', () => this._emit('exportData'));
    const importBtn = this._btn('mdi:database-import-outline', '貼上資料', 'btn-neutral', () => this._emit('importData'));
    const shareBtn = this._btn('mdi:link-variant', '複製連結', 'btn-neutral', () => this._emit('shareLink'));
    tb.append(this._pickBtn, this._visBtn, exportBtn, copyDataBtn, importBtn, shareBtn);
    p.appendChild(tb);

    // Page list with flyout toggle
    const projBar = this._el('div', 'proj-bar');
    this._projFlyoutBtn = this._doc.createElement('button');
    this._projFlyoutBtn.className = 'proj-flyout-btn';
    this._projFlyoutBtn.appendChild(this._icon('mdi:file-document-multiple-outline'));
    const projNameSpan = this._doc.createElement('span');
    projNameSpan.className = 'proj-name';
    projNameSpan.style.cssText = 'flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;';
    projNameSpan.textContent = '頁面清單';
    this._projFlyoutBtn.appendChild(projNameSpan);
    this._projFlyoutBtn.appendChild(this._icon('mdi:chevron-down'));
    this._projFlyoutBtn.addEventListener('click', () => this._toggleFlyout());
    projBar.appendChild(this._projFlyoutBtn);
    p.appendChild(projBar);

    // Flyout (hidden until toggled open)
    this._flyoutEl = this._el('div', 'proj-flyout');
    p.appendChild(this._flyoutEl);

    const modeBar = this._el('div', 'mode-bar');
    this._reviewerModeLabel = this._el('span', 'mode-label active', '審核者');
    this._developerModeLabel = this._el('span', 'mode-label', '開發者');
    this._modeSwitch = this._doc.createElement('button');
    this._modeSwitch.type = 'button';
    this._modeSwitch.className = 'mode-switch';
    this._modeSwitch.title = '切換審核者 / 開發者模式';
    this._modeSwitch.appendChild(this._el('span', 'mode-switch-knob'));
    this._modeSwitch.addEventListener('click', () => this._setMode(this._mode === 'reviewer' ? 'developer' : 'reviewer'));
    modeBar.append(this._reviewerModeLabel, this._modeSwitch, this._developerModeLabel);
    p.appendChild(modeBar);

    // List header
    const listHdr = this._el('div', 'list-header');
    listHdr.appendChild(this._el('span', 'list-header-title', '標註清單'));
    this._hideDoneControl = this._doc.createElement('label');
    this._hideDoneControl.className = 'hide-done-control';
    const hideDoneInput = this._doc.createElement('input');
    hideDoneInput.type = 'checkbox';
    hideDoneInput.checked = this._hideDone;
    hideDoneInput.addEventListener('change', () => {
      this._hideDone = hideDoneInput.checked;
      this._rerenderLast();
    });
    this._hideDoneControl.append(hideDoneInput, this._doc.createTextNode('隱藏已完成'));
    listHdr.appendChild(this._hideDoneControl);
    p.appendChild(listHdr);

    // List
    this._listEl = this._el('div', 'list');
    this._listEl.innerHTML = '<div class="empty">尚無標註。點擊「選取元素」開始。</div>';
    p.appendChild(this._listEl);
  }

  _el(tag, cls, text) {
    const el = this._doc.createElement(tag);
    if (cls) el.className = cls;
    if (text != null) el.textContent = text;
    return el;
  }

  _icon(name) {
    const ic = this._doc.createElement('iconify-icon');
    ic.setAttribute('icon', name);
    return ic;
  }

  _btn(iconName, label, cls, onClick) {
    const b = this._doc.createElement('button');
    b.className = 'btn ' + cls;
    if (iconName) b.appendChild(this._icon(iconName));
    if (label) {
      const s = this._doc.createElement('span');
      s.textContent = label;
      b.appendChild(s);
    }
    b.addEventListener('click', onClick);
    return b;
  }

  _setMode(mode) {
    this._mode = mode === 'developer' ? 'developer' : 'reviewer';
    if (this._modeSwitch) {
      this._modeSwitch.classList.toggle('dev', this._mode === 'developer');
    }
    if (this._reviewerModeLabel) this._reviewerModeLabel.classList.toggle('active', this._mode === 'reviewer');
    if (this._developerModeLabel) this._developerModeLabel.classList.toggle('active', this._mode === 'developer');
    if (this._hideDoneControl) this._hideDoneControl.classList.toggle('visible', this._mode === 'developer');
    this._rerenderLast();
  }

  _rerenderLast() {
    if (!this._lastRefresh) return;
    this.refresh(this._lastRefresh.comments, this._lastRefresh.isMissing, this._lastRefresh.onLocate);
  }

  _toggleCollapse() {
    this._collapsed = !this._collapsed;
    this._panel.classList.toggle('collapsed', this._collapsed);
    const toggle = this._shadow.querySelector('.toggle-btn');
    if (toggle) {
      const icon = toggle.querySelector('iconify-icon');
      if (icon) icon.setAttribute('icon', this._collapsed ? 'mdi:chevron-right' : 'mdi:chevron-left');
    }
  }

  /** Public: toggle collapse state (used by keyboard shortcut) */
  toggleCollapse() { this._toggleCollapse(); }

  /** Public: expand panel if collapsed */
  open() { if (this._collapsed) this._toggleCollapse(); }

  refresh(comments, isMissing, onLocate) {
    if (!this._listEl) return;
    this._lastRefresh = { comments, isMissing, onLocate };
    this._listEl.innerHTML = '';

    const visibleComments = this._mode === 'developer' && this._hideDone
      ? comments.filter(c => !c.done)
      : comments;

    if (!visibleComments.length) {
      this._listEl.innerHTML = comments.length
        ? '<div class="empty">已隱藏完成項目。</div>'
        : '<div class="empty">尚無標註。點擊「選取元素」開始。</div>';
      return;
    }

    visibleComments.forEach((c, i) => {
      const missing = isMissing(c.id);
      const meta = c.meta || {};
      const item = this._el('div', 'comment-item' + (missing ? ' missing' : '') + (c.done ? ' done' : ''));

      // Header: badge + tagName chip + selector label
      const hdr = this._el('div', 'comment-header');
      if (this._mode === 'developer') {
        const doneBox = this._doc.createElement('input');
        doneBox.type = 'checkbox';
        doneBox.className = 'comment-done-box';
        doneBox.checked = !!c.done;
        doneBox.title = '標記為已完成';
        doneBox.addEventListener('click', e => e.stopPropagation());
        doneBox.addEventListener('change', e => {
          e.stopPropagation();
          this._emit('toggleDone', { id: c.id, done: doneBox.checked });
        });
        hdr.appendChild(doneBox);
      }
      const badge = this._el('span', 'badge', String(i + 1));
      badge.style.background = RED;
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
      const editBtn = this._btn('mdi:pencil', '編輯', 'btn-edit-item', (e) => { e.stopPropagation(); this._emit('edit', c.id); });
      actions.appendChild(editBtn);
      if (this._mode === 'reviewer') {
        const delBtn = this._btn('mdi:delete', '刪除', 'btn-del', (e) => { e.stopPropagation(); this._emit('delete', c.id); });
        actions.appendChild(delBtn);
      }
      item.appendChild(actions);

      // Click item → scroll to element + pulse glow
      item.addEventListener('click', () => {
        const el = this._doc.querySelector(c.selector);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(() => { if (onLocate) onLocate(c.id); }, 400);
        }
      });
      this._listEl.appendChild(item);
    });
  }

  setProject(name) {
    this._project = name;
    if (this._projFlyoutBtn) {
      const nameSpan = this._projFlyoutBtn.querySelector('.proj-name');
      if (nameSpan) nameSpan.textContent = '頁面清單';
    }
  }

  _openFlyout() {
    if (this._flyoutOpen) return;
    this._flyoutOpen = true;
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
   * Render the page flyout contents for the single project.
   * @param {Array<{url:string,path:string,count:number}>} pages
   */
  setPageData(pages) {
    if (!this._flyoutEl) return;
    this._flyoutEl.innerHTML = '';

    const searchRow = this._el('div', 'proj-search-row');
    const searchInput = this._doc.createElement('input');
    searchInput.type = 'search';
    searchInput.className = 'proj-search-input';
    searchInput.placeholder = '搜尋頁面…';
    searchInput.value = this._pageSearch;
    searchInput.addEventListener('input', e => {
      this._pageSearch = e.target.value;
      this.setPageData(pages);
      const next = this._flyoutEl.querySelector('.proj-search-input');
      if (next) {
        next.focus();
        next.setSelectionRange(next.value.length, next.value.length);
      }
    });
    searchInput.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        this._pageSearch = '';
        this.setPageData(pages);
      }
      e.stopPropagation();
    });
    searchRow.appendChild(searchInput);
    this._flyoutEl.appendChild(searchRow);

    const list = this._el('div', 'proj-acc-list');
    const query = this._pageSearch.trim().toLowerCase();
    const visiblePages = pages.filter(({ path, url }) => {
      if (!query) return true;
      return String(path).toLowerCase().includes(query) ||
        String(url).toLowerCase().includes(query);
    });

    if (!visiblePages.length) {
      list.appendChild(this._el('span', 'proj-acc-empty', query ? '找不到符合的頁面' : '此專案尚無標註頁面'));
    }

    const pagesDiv = this._el('div', 'proj-acc-pages');
    visiblePages.forEach(({ url, path, count }) => {
      const pageRow = this._el('div', 'proj-acc-page-row');
      const link  = this._el('span', 'proj-acc-page', `↗ ${path} `);
      const cnt   = this._el('span', 'proj-acc-page-count', `${count} 筆`);
      link.appendChild(cnt);
      link.addEventListener('click', e => {
        e.stopPropagation();
        this._closeFlyout();
        this._emit('navigateToPage', { url });
      });
      const pageDel = this._btn('mdi:close', '刪除頁面', 'proj-page-del', e => {
        e.stopPropagation();
        if (!this._doc.defaultView.confirm(`刪除 ${path} 的所有標註？`)) return;
        this._emit('deleteProjectPage', { url });
      });
      pageRow.append(link, pageDel);
      pagesDiv.appendChild(pageRow);
    });
    list.appendChild(pagesDiv);

    this._flyoutEl.appendChild(list);
  }

  setPickActive(active) {
    this._pickActive = active;
    if (!this._pickBtn) return;
    const icon  = this._pickBtn.querySelector('iconify-icon');
    const label = this._pickBtn.querySelector('span');
    if (active) {
      this._pickBtn.className = 'btn btn-danger';
      if (icon)  icon.setAttribute('icon', 'mdi:stop-circle-outline');
      if (label) label.textContent = '停止選取';
    } else {
      this._pickBtn.className = 'btn btn-primary';
      if (icon)  icon.setAttribute('icon', 'mdi:cursor-default-click');
      if (label) label.textContent = '選取元素';
    }
  }

  setOverlayVisible(visible) {
    if (!this._visBtn) return;
    const icon  = this._visBtn.querySelector('iconify-icon');
    const label = this._visBtn.querySelector('span');
    if (visible) {
      this._visBtn.className = 'btn btn-neutral';
      if (icon)  icon.setAttribute('icon', 'mdi:eye-off-outline');
      if (label) label.textContent = '隱藏標註';
    } else {
      this._visBtn.className = 'btn btn-teal';
      if (icon)  icon.setAttribute('icon', 'mdi:eye-outline');
      if (label) label.textContent = '顯示標註';
    }
  }

  setNoProject(val) {
    this._noProject = !!val;
    if (this._pickBtn) {
      this._pickBtn.disabled = this._noProject;
      this._pickBtn.style.opacity = this._noProject ? '0.4' : '';
      this._pickBtn.style.cursor  = this._noProject ? 'not-allowed' : '';
    }
    if (this._listEl && this._noProject) {
      this._listEl.innerHTML = '<div class="empty">頁面清單初始化中，請稍後再開始標註。</div>';
    }
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
        const delBtn = this._btn('mdi:delete', '刪除', 'btn-danger', () => done({ action: 'delete' }));
        const spacer = this._el('span', 'spacer');
        actions.append(delBtn, spacer);
      }
      const cancelBtn = this._btn('mdi:close', '取消', 'btn-neutral', () => done({ action: 'cancel' }));
      const saveBtn   = this._btn('mdi:check', '儲存', 'btn-primary', () => {
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

  showImportDialog() {
    return new Promise(resolve => {
      const vw = this._doc.defaultView.innerWidth;
      const vh = this._doc.defaultView.innerHeight;
      const W = 300, H = 280;
      const dialog = this._el('div', 'dialog');
      dialog.style.left = `${Math.max(12, (vw - W) / 2)}px`;
      dialog.style.top  = `${Math.max(12, (vh - H) / 2)}px`;
      dialog.style.width = `${W}px`;

      const h3 = this._el('h3', null, '貼上標註資料');
      const ta = this._doc.createElement('textarea');
      ta.placeholder = '貼上「複製資料」產生的整個專案 JSON，或貼上含有標註資料的分享連結';
      ta.style.minHeight = '150px';

      const actions = this._el('div', 'dialog-actions');
      const spacer = this._el('span', 'spacer');
      const done = (result) => { dialog.remove(); resolve(result); };
      const cancelBtn = this._btn('mdi:close', '取消', 'btn-neutral', () => done({ action: 'cancel' }));
      const importBtn = this._btn('mdi:database-import-outline', '匯入', 'btn-primary', () => {
        const text = ta.value.trim();
        done({ action: text ? 'import' : 'cancel', text });
      });
      actions.append(spacer, cancelBtn, importBtn);

      dialog.append(h3, ta, actions);
      this._shadow.appendChild(dialog);
      requestAnimationFrame(() => ta.focus());

      ta.addEventListener('keydown', e => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) importBtn.click();
        if (e.key === 'Escape') cancelBtn.click();
        e.stopPropagation();
      });
    });
  }

  unmount() {
    this._closeFlyout();
    if (this._host) {
      this._host.remove();
      this._host = null;
      this._shadow = null;
      this._flyoutEl = null;
      this._projFlyoutBtn = null;
    }
  }
}

