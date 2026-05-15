import { CommentStore, getCurrentProject, setCurrentProject, listProjects, listProjectPages, createProject, deleteProject } from './store.js';
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

  // Detect shared data in URL hash and produce a clean URL for the store key
  const sharedData = Exporter.decodeShareHash(location.hash);
  let url;
  if (location.hash.includes('__ct__=')) {
    const newHash = location.hash.replace(/&?__ct__=[^&]*/g, '');
    const base = location.href.split('#')[0];
    url = (newHash && newHash !== '#') ? base + newHash : base;
    try { history.replaceState(null, '', url); } catch (e) { /* ignore */ }
  } else {
    url = location.href;
  }

  // ── Module init (panel first — needed for project dialog) ─────────────────
  const picker  = new ElementPicker(doc);
  const overlay = new OverlayManager(doc);
  const panel   = new PanelUI(doc);
  panel.mount();

  // ── Project resolution ───────────────────────────────────────────────────
  let project = getCurrentProject();
  if (!project) {
    project = 'default';
    createProject(project);
    setCurrentProject(project);
  }

  // ── Store ─────────────────────────────────────────────────────────────────
  let store = new CommentStore(project, url);
  panel.setProject(project);

  function refresh() {
    const comments = store.getAll();
    overlay.renderAll(comments);
    panel.refresh(comments, (id) => overlay.isMissing(id));
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
    .on('flyoutOpen', () => {
      const projects = listProjects();
      const pagesMap = Object.fromEntries(
        projects.map(p => [p, listProjectPages(p)])
      );
      panel.setFlyoutData(projects, pagesMap);
    })
    .on('navigateToPage', ({ url: destUrl, project: destProject }) => {
      setCurrentProject(destProject);
      window.location.href = destUrl;
    })
    .on('createProject', ({ name }) => {
      if (!name) return;
      createProject(name);
      overlay.clearAll();
      project = name;
      setCurrentProject(project);
      store = new CommentStore(project, url);
      panel.setProject(project);
      refresh();
    })
    .on('deleteProject', ({ name }) => {
      deleteProject(name);
      const projects = listProjects();
      const pagesMap = Object.fromEntries(
        projects.map(p => [p, listProjectPages(p)])
      );
      panel.setFlyoutData(projects, pagesMap);
    })
    .on('pickRequest', () => {
      if (picker.isActive) {
        picker.stop();
        panel.setPickActive(false);
        return;
      }
      panel.setPickActive(true);
      picker.start({
        onPick: async ({ selector, label, meta, rect }) => {
          const x = rect ? rect.right : doc.defaultView.innerWidth / 2;
          const y = rect ? rect.top  : doc.defaultView.innerHeight / 2;
          const result = await panel.showDialogAt(x, y, { existing: '', showDelete: false });
          if (result.action === 'save' && result.text) {
            store.add(selector, label, result.text, meta);
            refresh();
          }
          picker.resume(); // stay in pick mode until button is clicked again
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
    })
    .on('shareLink', async () => {
      const shareUrl = Exporter.toShareURL(url, store.getAll());
      const ok = await Exporter.copyToClipboard(shareUrl);
      panel.showToast(ok ? '✓ 分享連結已複製到剪貼簿' : '✗ 複製失敗，請手動複製');
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

  // Auto-import shared annotations when the URL contains a share hash
  let didImportShared = false;
  if (sharedData?.comments?.length) {
    const existing = store.getAll();
    const doImport = existing.length === 0
      || doc.defaultView.confirm(
           `此連結含有 ${sharedData.comments.length} 筆共享標註。是否匯入？（將覆蓋目前的 ${existing.length} 筆標註）`
         );
    if (doImport) {
      store.importJSON(JSON.stringify({ version: 1, comments: sharedData.comments }));
      didImportShared = true;
    }
  }

  refresh();
  if (didImportShared) panel.showToast(`✓ 已載入 ${store.getAll().length} 筆共享標註`);

  window.__commentToolActive = {
    toggle() {
      picker.stop();
      overlay.clearAll();
      panel.unmount();
      delete window.__commentToolActive;
    },
  };
})();
