// src/index.js
import { getCurrentProject, setCurrentProject } from './store.js';
import { getStore } from './store-factory.js';
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
  const sharedData = Exporter.decodeShareHash(location.hash);
  const url = Exporter.stripShareHash(location.href);

  // ── Adapter ───────────────────────────────────────────────────────────────
  let adapter = getStore();

  // ── Module init (panel first — needed for project dialog) ─────────────────
  const picker  = new ElementPicker(doc);
  const overlay = new OverlayManager(doc);
  const panel   = new PanelUI(doc);
  panel.mount();

  // ── Project resolution ───────────────────────────────────────────────────
  let project = getCurrentProject() || '';

  panel.setProject(project);
  if (!project) panel.setNoProject(true);

  function setActiveProject(name) {
    project = name || '';
    setCurrentProject(project);
    panel.setProject(project);
    panel.setNoProject(!project);
  }

  async function refresh() {
    if (!project) return;
    try {
      const comments = await adapter.getAnnotations(project, url);
      overlay.renderAll(comments);
      panel.refresh(comments, (id) => overlay.isMissing(id), (id) => overlay.pulse(id));
    } catch (e) {
      panel.showToast(`讀取失敗：${e.message}`);
      throw e;
    }
  }

  async function importPayload(payload, { fromLink = false } = {}) {
    if (!payload?.comments?.length) {
      panel.showToast('沒有可匯入的標註資料');
      return;
    }

    const targetProject = project || payload.project || '共享標註';
    const existing = project ? await adapter.getAnnotations(project, url) : [];
    if (existing.length && !doc.defaultView.confirm(`匯入會覆蓋目前頁面的 ${existing.length} 筆標註，確定繼續？`)) {
      return;
    }

    await adapter.createProject(targetProject);
    setActiveProject(targetProject);
    await adapter.importPageJSON(
      targetProject,
      url,
      doc.title || payload.pageTitle || url,
      JSON.stringify({ version: 1, url, comments: payload.comments })
    );
    await refresh();

    if (fromLink && location.href !== url) {
      history.replaceState(null, '', url);
    }
    panel.showToast(`✓ 已匯入 ${payload.comments.length} 筆標註`);
  }

  async function activateProject(name) {
    if (!name) return;
    overlay.clearAll();
    setActiveProject(name);
    await refresh();
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
    .on('flyoutOpen', () => refreshFlyout())
    .on('navigateToPage', async ({ url: destUrl, project: destProject }) => {
      if (!destUrl || !destProject) return;
      if (destProject === project && destUrl === url) return;
      if (destUrl === url) {
        await activateProject(destProject);
        await refreshFlyout();
        return;
      }
      setCurrentProject(destProject);
      try {
        window.location.href = destUrl;
      } catch {
        setCurrentProject(project);
      }
    })
    .on('selectProject', async ({ name }) => {
      await activateProject(name);
      await refreshFlyout();
    })
    .on('createProject', async ({ name }) => {
      if (!name) return;
      await adapter.createProject(name);
      await activateProject(name);
    })
    .on('deleteProject', async ({ name }) => {
      await adapter.deleteProject(name);

      if (name === project) {
        const remaining = await adapter.listProjects();
        overlay.clearAll();
        if (remaining.length) {
          await activateProject(remaining[0].name);
        } else {
          setActiveProject('');
          panel.refresh([], () => false);
        }
      }

      await refreshFlyout();
    })
    .on('renameProject', async ({ oldName, newName }) => {
      if (!oldName || !newName || oldName === newName) return;
      try {
        await adapter.renameProject(oldName, newName);
      } catch (e) {
        panel.showToast(e.message === 'PROJECT_EXISTS' ? '已有相同名稱的專案' : `改名失敗：${e.message || e}`);
        return;
      }

      if (oldName === project) {
        setActiveProject(newName);
        await refresh();
      }
      await refreshFlyout();
    })
    .on('deleteProjectPage', async ({ project: targetProject, url: targetUrl }) => {
      if (!targetProject || !targetUrl) return;
      await adapter.deleteProjectPage(targetProject, targetUrl);

      if (targetProject === project && targetUrl === url) {
        overlay.clearAll();
        panel.refresh([], () => false);
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
          try {
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
          } catch (e) {
            panel.showToast(`操作失敗：${e.message || e}`);
          } finally {
            picker.resume();
          }
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
      panel.setOverlayVisible(true);
    })
    .on('toggleOverlay', () => {
      if (overlay.isVisible) {
        overlay.hide();
        panel.setOverlayVisible(false);
      } else {
        overlay.show();
        panel.setOverlayVisible(true);
      }
    })
    .on('exportPrompt', async () => {
      const comments = await adapter.getAnnotations(project, url);
      const prompt = Exporter.toPrompt(url, comments);
      const ok = await Exporter.copyToClipboard(prompt);
      panel.showToast(ok ? '✓ Prompt 已複製到剪貼簿' : '✗ 複製失敗，請手動複製');
    })
    .on('exportData', async () => {
      const comments = await adapter.getAnnotations(project, url);
      const json = Exporter.toPortableJSON(url, comments, {
        project,
        pageTitle: doc.title || url,
      });
      const ok = await Exporter.copyToClipboard(json);
      panel.showToast(ok ? '✓ 標註資料已複製' : '✗ 複製失敗，請手動複製');
    })
    .on('shareLink', async () => {
      const comments = await adapter.getAnnotations(project, url);
      const shareUrl = Exporter.toShareURL(url, comments, {
        project,
        pageTitle: doc.title || url,
      });
      const ok = await Exporter.copyToClipboard(shareUrl);
      panel.showToast(ok ? '✓ 分享連結已複製' : '✗ 複製失敗，請手動複製');
    })
    .on('importData', async () => {
      const result = await panel.showImportDialog();
      if (result.action !== 'import') return;
      try {
        const payload = Exporter.parsePortableText(result.text);
        await importPayload(payload);
      } catch {
        panel.showToast('匯入失敗：資料格式不正確');
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

  try {
    if (sharedData?.comments?.length) {
      await importPayload(sharedData, { fromLink: true });
    } else {
      await refresh();
    }
  } catch {
    // Keep the panel usable even if imported data is invalid.
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


