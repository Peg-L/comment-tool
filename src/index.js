// src/index.js
import { CommentStore, getCurrentProject, setCurrentProject, listProjects } from './store.js';
import { ElementPicker } from './picker.js';
import { OverlayManager } from './overlay.js';
import { Exporter } from './exporter.js';
import { PanelUI } from './panel.js';

(function initCommentTool() {
  // Re-click bookmarklet = toggle panel
  if (window.__commentToolActive) {
    window.__commentToolActive.toggle();
    return;
  }

  const doc = document;
  const url = location.href;

  // ── Project resolution ───────────────────────────────────────────────────
  function askProject(current) {
    const existing = listProjects();
    let hint = '';
    if (existing.length) hint = `\n\n現有專案：${existing.join('、')}`;
    const name = doc.defaultView.prompt(
      `請輸入專案名稱（用於隔離不同專案的標註）${hint}`,
      current
    );
    return (name || '').trim();
  }

  let project = getCurrentProject();
  if (!project) {
    project = askProject('');
    if (!project) return; // user cancelled
    setCurrentProject(project);
  }

  // ── Module init ───────────────────────────────────────────────────────────
  let store   = new CommentStore(project, url);
  const picker  = new ElementPicker(doc);
  const overlay = new OverlayManager(doc);
  const panel   = new PanelUI(doc);

  function refresh() {
    const comments = store.getAll();
    overlay.renderAll(comments);
    panel.refresh(comments, (id) => overlay.isMissing(id));
  }

  function switchProject() {
    const newName = askProject(project);
    if (!newName || newName === project) return;
    overlay.clearAll();
    project = newName;
    setCurrentProject(project);
    store = new CommentStore(project, url);
    panel.setProject(project);
    refresh();
  }

  // ── Edit helper (shared by badge click + sidebar edit button) ─────────────
  async function openEditDialog(id, anchorX, anchorY) {
    const comment = store.getAll().find(c => c.id === id);
    if (!comment) return;

    let x = anchorX, y = anchorY;
    if (x == null || y == null) {
      const el = doc.querySelector(comment.selector);
      if (el) {
        const r = el.getBoundingClientRect();
        x = r.right; y = r.top;
      } else {
        x = doc.defaultView.innerWidth / 2;
        y = doc.defaultView.innerHeight / 2;
      }
    }

    const result = await panel.showDialogAt(x, y, { existing: comment.text, showDelete: true });
    if (result.action === 'save' && result.text) {
      store.update(id, result.text);
      refresh();
    } else if (result.action === 'delete') {
      store.delete(id);
      refresh();
    }
  }

  // ── Panel wiring ──────────────────────────────────────────────────────────
  panel
    .on('switchProject', switchProject)
    .on('pickRequest', () => {
      if (picker.isActive) {
        picker.stop();
        panel.setPickActive(false);
        return;
      }
      panel.setPickActive(true);
      picker.start({
        onPick: async ({ selector, label, meta, rect }) => {
          panel.setPickActive(false);
          const x = rect ? rect.right : doc.defaultView.innerWidth / 2;
          const y = rect ? rect.top  : doc.defaultView.innerHeight / 2;
          const result = await panel.showDialogAt(x, y, { existing: '', showDelete: false });
          if (result.action === 'save' && result.text) {
            store.add(selector, label, result.text, meta);
            refresh();
          }
        },
        onCancel: () => panel.setPickActive(false),
      });
    })
    .on('edit', (id) => openEditDialog(id))
    .on('delete', (id) => {
      store.delete(id);
      refresh();
    })
    .on('clear', () => {
      store.clear();
      overlay.clearAll();
      panel.refresh([], () => false);
    })
    .on('exportPrompt', async () => {
      const prompt = Exporter.toPrompt(url, store.getAll());
      const ok = await Exporter.copyToClipboard(prompt);
      panel.showToast(ok ? '✓ Prompt 已複製到剪貼簿' : '✗ 複製失敗，請手動複製');
    })
    .on('exportJSON', () => {
      const json = store.exportJSON();
      const blob = new Blob([json], { type: 'application/json' });
      const a = doc.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `comments-${project}-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    })
    .on('importJSON', (jsonString) => {
      try {
        store.importJSON(jsonString);
        refresh();
        panel.showToast('✓ 已匯入標註');
      } catch {
        panel.showToast('✗ JSON 格式錯誤');
      }
    });

  // ── Badge click → edit dialog ─────────────────────────────────────────────
  overlay.setBadgeClickHandler((id, x, y) => openEditDialog(id, x, y));

  // ── Keyboard shortcut: Alt+C = toggle panel ───────────────────────────────
  doc.addEventListener('keydown', (e) => {
    if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.key.toLowerCase() === 'c') {
      e.preventDefault();
      panel.toggleCollapse();
    }
  });

  panel.mount();
  panel.setProject(project);
  refresh();

  window.__commentToolActive = {
    toggle() {
      picker.stop();
      overlay.clearAll();
      panel.unmount();
      delete window.__commentToolActive;
    },
  };
})();
