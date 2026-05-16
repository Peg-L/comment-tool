// src/index.js
import { getCurrentProject, setCurrentProject, createProject, deleteProject } from './store.js';
import { getStore, saveConfig, loadConfig } from './store-factory.js';
import { ElementPicker } from './picker.js';
import { OverlayManager } from './overlay.js';
import { Exporter } from './exporter.js';
import { PanelUI } from './panel.js';

(async function initCommentTool() {
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

  // ── Adapter ───────────────────────────────────────────────────────────────
  let adapter = getStore();

  // ── Module init (panel first — needed for project dialog) ─────────────────
  const picker  = new ElementPicker(doc);
  const overlay = new OverlayManager(doc);
  const panel   = new PanelUI(doc);
  panel.mount();

  // ── Project resolution ───────────────────────────────────────────────────
  let project = getCurrentProject();
  if (!project) {
    project = 'default';
    await adapter.createProject(project);
    setCurrentProject(project);
  }

  panel.setProject(project);
  panel.setCloudConfigured(!!(loadConfig().supabaseUrl));

  async function refresh() {
    const comments = await adapter.getAnnotations(project, url);
    overlay.renderAll(comments);
    panel.refresh(comments, (id) => overlay.isMissing(id));
  }

  async function refreshFlyout() {
    const projects = await adapter.listProjects();
    const pagesMap = {};
    for (const p of projects) {
      pagesMap[p.name] = await adapter.listProjectPages(p.id);
    }
    panel.setFlyoutData(projects.map(p => p.name), pagesMap);
  }

  // ── Edit helper (shared by badge click + sidebar edit button) ─────────────
  async function openEditDialog(id, anchorX, anchorY) {
    const comments = await adapter.getAnnotations(project, url);
    const comment = comments.find(c => c.id === id);
    if (!comment) return;

    const el = doc.querySelector(comment.selector);
    let x = anchorX, y = anchorY;

    if (x == null || y == null) {
      if (el) {
        el.scrollIntoView({ behavior: 'instant', block: 'center' });
        const r = el.getBoundingClientRect();
        x = r.right; y = r.top;
      } else {
        x = doc.defaultView.innerWidth / 2;
        y = doc.defaultView.innerHeight / 2;
      }
    }

    const result = await panel.showDialogAt(x, y, { existing: comment.text, showDelete: true });
    if (result.action === 'save' && result.text) {
      await adapter.updateAnnotation(id, result.text, project, url);
      await refresh();
    } else if (result.action === 'delete') {
      await adapter.deleteAnnotation(id, project, url);
      await refresh();
    }
  }

  // ── Panel wiring ──────────────────────────────────────────────────────────
  panel
    .on('flyoutOpen', () => {
      refreshFlyout();
    })
    .on('navigateToPage', ({ url: destUrl, project: destProject }) => {
      if (!destUrl || !destProject) return;
      if (destProject === project && destUrl === url) return;
      setCurrentProject(destProject);
      try {
        window.location.href = destUrl;
      } catch {
        setCurrentProject(project);
      }
    })
    .on('createProject', async ({ name }) => {
      if (!name) return;
      await adapter.createProject(name);
      overlay.clearAll();
      project = name;
      setCurrentProject(project);
      panel.setProject(project);
      await refresh();
    })
    .on('deleteProject', async ({ name }) => {
      await adapter.deleteProject(name);

      if (name === project) {
        const remaining = await adapter.listProjects();
        project = remaining[0]?.name ?? 'default';
        if (!remaining.length) await adapter.createProject('default');
        setCurrentProject(project);
        overlay.clearAll();
        panel.setProject(project);
        await refresh();
      }

      await refreshFlyout();
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
          const comments = await adapter.getAnnotations(project, url);
          const existing = comments.find(c => c.selector === selector);
          if (existing) {
            await openEditDialog(existing.id, x, y);
          } else {
            const result = await panel.showDialogAt(x, y, { existing: '', showDelete: false });
            if (result.action === 'save' && result.text) {
              await adapter.addAnnotation(project, url, document.title, {
                selector,
                elementLabel: label,
                text: result.text,
                meta,
              });
              await refresh();
            }
          }
          picker.resume();
        },
        onCancel: () => panel.setPickActive(false),
      });
    })
    .on('edit', (id) => openEditDialog(id))
    .on('delete', async (id) => {
      await adapter.deleteAnnotation(id, project, url);
      await refresh();
    })
    .on('clear', async () => {
      await adapter.clearAnnotations(project, url);
      overlay.clearAll();
      panel.refresh([], () => false);
    })
    .on('exportPrompt', async () => {
      const comments = await adapter.getAnnotations(project, url);
      const prompt = Exporter.toPrompt(url, comments);
      const ok = await Exporter.copyToClipboard(prompt);
      panel.showToast(ok ? '✓ Prompt 已複製到剪貼簿' : '✗ 複製失敗，請手動複製');
    })
    .on('exportJSON', async () => {
      const json = await adapter.exportPageJSON(project, url);
      const blob = new Blob([json], { type: 'application/json' });
      const a = doc.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `comments-${project}-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    })
    .on('importJSON', async (jsonString) => {
      try {
        await adapter.importPageJSON(project, url, document.title, jsonString);
        await refresh();
        panel.showToast('✓ 已匯入標註');
      } catch {
        panel.showToast('✗ JSON 格式錯誤');
      }
    })
    .on('shareLink', async () => {
      const comments = await adapter.getAnnotations(project, url);
      const shareUrl = Exporter.toShareURL(url, comments);
      const ok = await Exporter.copyToClipboard(shareUrl);
      panel.showToast(ok ? '✓ 分享連結已複製到剪貼簿' : '✗ 複製失敗，請手動複製');
    })
    .on('saveConfig', async ({ supabaseUrl, supabaseKey }) => {
      saveConfig({ supabaseUrl, supabaseKey });
      adapter = getStore();
      panel.setCloudConfigured(true);
      panel.showToast('✓ 雲端設定已儲存，重新整理以套用');
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
    const existing = await adapter.getAnnotations(project, url);
    const doImport = existing.length === 0
      || doc.defaultView.confirm(
           `此連結含有 ${sharedData.comments.length} 筆共享標註。是否匯入？（將覆蓋目前的 ${existing.length} 筆標註）`
         );
    if (doImport) {
      await adapter.importPageJSON(project, url, document.title,
        JSON.stringify({ version: 1, comments: sharedData.comments })
      );
      didImportShared = true;
    }
  }

  await refresh();
  if (didImportShared) {
    const all = await adapter.getAnnotations(project, url);
    panel.showToast(`✓ 已載入 ${all.length} 筆共享標註`);
  }

  window.__commentToolActive = {
    toggle() {
      picker.stop();
      overlay.clearAll();
      panel.unmount();
      delete window.__commentToolActive;
    },
  };
})();

