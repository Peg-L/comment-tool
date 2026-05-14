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
        onPick: async ({ selector, label }) => {
          panel.setPickActive(false);
          const text = await panel.promptComment();
          if (text) {
            store.add(selector, label, text);
            refresh();
          }
        },
        onCancel: () => panel.setPickActive(false),
      });
    })
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
