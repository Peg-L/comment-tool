// src/index.js
import { getCurrentProject, SINGLE_PROJECT_NAME, setCurrentProject } from './store.js';
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
  const adapter = getStore();

  // ── Module init (panel first — needed for project dialog) ─────────────────
  const picker  = new ElementPicker(doc);
  const overlay = new OverlayManager(doc);
  const panel   = new PanelUI(doc);
  panel.mount();

  // ── Single project resolution ────────────────────────────────────────────
  const storedProject = getCurrentProject();
  const existingProjects = await adapter.listProjects();
  const project = storedProject || existingProjects[0]?.name || SINGLE_PROJECT_NAME;
  await adapter.createProject(project);
  setCurrentProject(project);

  panel.setProject(project);

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
    if (payload?.pages?.length) {
      const existingPages = await adapter.listProjectPages(project);
      if (
        existingPages.length &&
        !doc.defaultView.confirm(`匯入會覆蓋 ${payload.pages.length} 個頁面的同網址標註，確定繼續？`)
      ) {
        return;
      }

      for (const page of payload.pages) {
        await adapter.importPageJSON(
          project,
          page.url,
          page.pageTitle || page.url,
          JSON.stringify({ version: 1, url: page.url, comments: page.comments || [] })
        );
      }

      await refresh();
      await refreshPages();
      panel.showToast(`✓ 已匯入 ${payload.pages.length} 個頁面的標註資料`);
      return;
    }

    if (!payload?.comments?.length) {
      panel.showToast('沒有可匯入的標註資料');
      return;
    }

    const targetProject = project;
    const existing = await adapter.getAnnotations(project, url);
    if (existing.length && !doc.defaultView.confirm(`匯入會覆蓋目前頁面的 ${existing.length} 筆標註，確定繼續？`)) {
      return;
    }

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

  async function refreshPages() {
    const pages = await adapter.listProjectPages(project);
    panel.setPageData(pages);
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

    const result = await panel.showDialogAt(x, y, { existing: comment.text, showDelete: !panel.isDeveloperMode });
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
    .on('flyoutOpen', () => refreshPages())
    .on('navigateToPage', async ({ url: destUrl }) => {
      if (!destUrl || destUrl === url) return;
      setCurrentProject(project);
      try {
        window.location.href = destUrl;
      } catch {
        setCurrentProject(project);
      }
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
    .on('toggleDone', async ({ id, done }) => {
      await adapter.setAnnotationDone(id, done, project, url);
      await refresh();
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
      const pages = await adapter.listProjectPages(project);
      const projectPages = [];
      for (const page of pages) {
        projectPages.push({
          url: page.url,
          path: page.path,
          comments: await adapter.getAnnotations(project, page.url),
        });
      }
      const json = Exporter.toProjectJSON(project, projectPages);
      const ok = await Exporter.copyToClipboard(json);
      panel.showToast(ok ? `✓ 已複製 ${projectPages.length} 個頁面的專案資料` : '✗ 複製失敗，請手動複製');
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


