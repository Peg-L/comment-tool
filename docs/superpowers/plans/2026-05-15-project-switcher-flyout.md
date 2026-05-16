# Project Switcher Flyout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the full-page project-manager modal with an inline accordion flyout that shows all projects, each expandable to its annotated pages, with direct navigation and an inline "add project" form.

**Architecture:** `store.js` gains `createProject`, `listProjectPages`, and updates to `listProjects`/`deleteProject`. `panel.js` swaps the modal dialog for a collapsible `.proj-flyout` div rendered inline in the panel. `index.js` wires the three new panel events (`flyoutOpen`, `navigateToPage`, `createProject`, `deleteProject`) and removes the old `switchProject` / `showProjectDialog` path.

**Tech Stack:** Vanilla JS ES modules, localStorage, Shadow DOM, vitest + jsdom for store unit tests, esbuild bundle.

---

## File Map

| File | Change |
|------|--------|
| `src/store.js` | Add `PROJECT_LIST_KEY`, `createProject`, `listProjectPages`; update `listProjects`, `deleteProject` |
| `src/panel.js` | Remove modal CSS + `showProjectDialog`; add flyout CSS; replace proj-bar; add `_openFlyout`, `_closeFlyout`, `_toggleFlyout`, `setFlyoutData` |
| `src/index.js` | Remove `async`, `switchProject`; add `createProject`/`listProjectPages` imports; auto-create `"default"`; wire 4 new events |
| `tests/store.test.js` | New file — unit tests for all store changes |

---

## Task 1: store.js — Data Layer

**Files:**
- Modify: `src/store.js`
- Create: `tests/store.test.js`

- [ ] **Step 1: Add `PROJECT_LIST_KEY` constant and two private helpers**

In `src/store.js`, after line 2 (`const CURRENT_PROJECT_KEY = ...`), add:

```js
const PROJECT_LIST_KEY = 'comment-tool:__project-list__';

function _getProjectList() {
  try {
    const raw = localStorage.getItem(PROJECT_LIST_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function _saveProjectList(list) {
  localStorage.setItem(PROJECT_LIST_KEY, JSON.stringify(list));
}
```

- [ ] **Step 2: Add `createProject` export**

After `setCurrentProject`, add:

```js
/** Add a named project to the persistent project list (no-op if already exists). */
export function createProject(name) {
  const list = _getProjectList();
  if (!list.includes(name)) {
    list.push(name);
    _saveProjectList(list);
  }
}
```

- [ ] **Step 3: Update `listProjects` to merge stored list with annotation-derived projects**

Replace the existing `listProjects` function with:

```js
export function listProjects() {
  const projects = new Set(_getProjectList());
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (
      k &&
      k.startsWith(STORAGE_PREFIX) &&
      k !== CURRENT_PROJECT_KEY &&
      k !== PROJECT_LIST_KEY
    ) {
      const rest = k.slice(STORAGE_PREFIX.length);
      const sep = rest.indexOf(':');
      if (sep !== -1) projects.add(rest.slice(0, sep));
    }
  }
  return Array.from(projects).sort();
}
```

- [ ] **Step 4: Add `listProjectPages` export**

After `listProjects`, add:

```js
/**
 * Return all pages (URLs) that have annotations under a project.
 * @param {string} projectName
 * @returns {Array<{url: string, path: string, count: number}>}
 */
export function listProjectPages(projectName) {
  const prefix = `${STORAGE_PREFIX}${projectName}:`;
  const pages = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(prefix)) {
      const url = k.slice(prefix.length);
      let path = url;
      try {
        const u = new URL(url);
        path = u.pathname + (u.search || '');
      } catch { /* keep raw url as path */ }
      let count = 0;
      try {
        const data = JSON.parse(localStorage.getItem(k));
        count = Array.isArray(data?.comments) ? data.comments.length : 0;
      } catch { /* count stays 0 */ }
      pages.push({ url, path, count });
    }
  }
  return pages.sort((a, b) => a.path.localeCompare(b.path));
}
```

- [ ] **Step 5: Update `deleteProject` to also remove from project list**

Replace the existing `deleteProject` function with:

```js
export function deleteProject(name) {
  const prefix = `${STORAGE_PREFIX}${name}:`;
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(prefix)) keys.push(k);
  }
  keys.forEach(k => localStorage.removeItem(k));
  _saveProjectList(_getProjectList().filter(p => p !== name));
}
```

- [ ] **Step 6: Write tests in `tests/store.test.js`**

```js
import { describe, it, expect, beforeEach } from 'vitest';
import {
  getCurrentProject, setCurrentProject,
  createProject, listProjects, listProjectPages, deleteProject,
} from '../src/store.js';
import { CommentStore } from '../src/store.js';

beforeEach(() => localStorage.clear());

describe('createProject', () => {
  it('adds project to listProjects', () => {
    createProject('alpha');
    expect(listProjects()).toContain('alpha');
  });

  it('is idempotent — duplicate names not stored twice', () => {
    createProject('alpha');
    createProject('alpha');
    expect(listProjects().filter(p => p === 'alpha').length).toBe(1);
  });
});

describe('listProjects', () => {
  it('returns empty array when nothing stored', () => {
    expect(listProjects()).toEqual([]);
  });

  it('includes projects derived from annotation keys', () => {
    const store = new CommentStore('beta', 'https://example.com/');
    store.add('h1', 'Heading', 'note');
    expect(listProjects()).toContain('beta');
  });

  it('merges explicit and annotation-derived projects, sorted', () => {
    createProject('zebra');
    const store = new CommentStore('alpha', 'https://example.com/');
    store.add('h1', 'H', 'x');
    expect(listProjects()).toEqual(['alpha', 'zebra']);
  });
});

describe('listProjectPages', () => {
  it('returns empty array for project with no annotations', () => {
    createProject('empty');
    expect(listProjectPages('empty')).toEqual([]);
  });

  it('returns page entry with url, path, and count', () => {
    const store = new CommentStore('proj', 'https://example.com/dashboard');
    store.add('h1', 'H', 'note1');
    store.add('p',  'P', 'note2');
    const pages = listProjectPages('proj');
    expect(pages).toHaveLength(1);
    expect(pages[0].url).toBe('https://example.com/dashboard');
    expect(pages[0].path).toBe('/dashboard');
    expect(pages[0].count).toBe(2);
  });

  it('returns multiple pages sorted by path', () => {
    new CommentStore('proj', 'https://example.com/settings').add('a', 'A', 'x');
    new CommentStore('proj', 'https://example.com/dashboard').add('b', 'B', 'y');
    const pages = listProjectPages('proj');
    expect(pages.map(p => p.path)).toEqual(['/dashboard', '/settings']);
  });
});

describe('deleteProject', () => {
  it('removes annotation keys', () => {
    const store = new CommentStore('del-me', 'https://example.com/');
    store.add('h1', 'H', 'note');
    deleteProject('del-me');
    expect(listProjects()).not.toContain('del-me');
    expect(listProjectPages('del-me')).toEqual([]);
  });

  it('removes from explicit project list', () => {
    createProject('explicit');
    deleteProject('explicit');
    expect(listProjects()).not.toContain('explicit');
  });

  it('does not affect other projects', () => {
    createProject('keep');
    createProject('remove');
    deleteProject('remove');
    expect(listProjects()).toContain('keep');
  });
});
```

- [ ] **Step 7: Run tests — expect all pass**

```
npm test
```

Expected output: all tests in `tests/store.test.js` pass, `PASS` printed.

- [ ] **Step 8: Commit**

```
git add src/store.js tests/store.test.js
git commit -m "feat(store): add createProject, listProjectPages; update listProjects/deleteProject"
```

---

## Task 2: panel.js — CSS Swap

**Files:**
- Modify: `src/panel.js`

- [ ] **Step 1: Remove the modal CSS block**

In `src/panel.js`, delete the entire block from `/* ── Project manager dialog ── */` through the closing `}` of `.proj-footer` (lines 254–338), including the blank line above the comment. The line immediately before the deletion is `.dialog-actions .spacer { flex: 1; }` and the line immediately after is the backtick closing the CSS template literal (`` ` ``).

The block to remove:
```css
/* ── Project manager dialog ── */
.proj-overlay { ... }
.proj-mgr { ... }
.proj-mgr h3 { ... }
.proj-section-label { ... }
.proj-scroll { ... }
.proj-scroll::-webkit-scrollbar { ... }
.proj-scroll::-webkit-scrollbar-track { ... }
.proj-scroll::-webkit-scrollbar-thumb { ... }
.proj-row { ... }
.proj-row:hover:not(.proj-row-current) { ... }
.proj-row-current { ... }
.proj-row-name { ... }
.proj-current-badge { ... }
.proj-empty { ... }
.proj-new-row { ... }
.proj-input { ... }
.proj-input:focus { ... }
.proj-footer { ... }
```

- [ ] **Step 2: Add flyout CSS in place of the removed block**

Insert this block at the same position (between `.dialog-actions .spacer { flex: 1; }` and the closing backtick):

```css
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
```

- [ ] **Step 3: Commit**

```
git add src/panel.js
git commit -m "refactor(panel): swap modal CSS for flyout accordion CSS"
```

---

## Task 3: panel.js — HTML + Behaviour

**Files:**
- Modify: `src/panel.js`

- [ ] **Step 1: Update constructor — add flyout state fields**

In the `constructor(doc)` body, after `this._cbs = {};`, add:

```js
this._project = '';
this._flyoutOpen = false;
this._flyoutExpandedProject = null;
this._flyoutEl = null;
this._projFlyoutBtn = null;
this._flyoutOutsideHandler = null;
```

- [ ] **Step 2: Replace proj-bar in `_buildPanel`**

Find this block in `_buildPanel()`:
```js
// Project bar
const projBar = this._el('div', 'proj-bar');
this._projLabel = this._el('span', 'proj-label', '');
const switchBtn = this._btn('切換', 'btn btn-neutral btn-xs', () => this._emit('switchProject'));
projBar.append(this._el('span', 'proj-icon', '📁'), this._projLabel, switchBtn);
p.appendChild(projBar);
```

Replace with:
```js
// Project bar with flyout toggle
const projBar = this._el('div', 'proj-bar');
this._projFlyoutBtn = this._el('button', 'proj-flyout-btn', '📁 … ▾');
this._projFlyoutBtn.addEventListener('click', () => this._toggleFlyout());
projBar.appendChild(this._projFlyoutBtn);
p.appendChild(projBar);

// Flyout (hidden until toggled open)
this._flyoutEl = this._el('div', 'proj-flyout');
p.appendChild(this._flyoutEl);
```

- [ ] **Step 3: Update `setProject` to update the flyout button**

Replace the existing `setProject` method:
```js
setProject(name) {
  if (this._projLabel) this._projLabel.textContent = name || '（未命名專案）';
}
```

With:
```js
setProject(name) {
  this._project = name;
  if (this._projFlyoutBtn) {
    this._projFlyoutBtn.textContent = `📁 ${name || '（未命名）'} ▾`;
  }
}
```

- [ ] **Step 4: Add `_openFlyout`, `_closeFlyout`, `_toggleFlyout` methods**

Add these three methods after `setProject`:

```js
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
```

- [ ] **Step 5: Add `setFlyoutData(projects, pagesMap)` public method**

Add this method after `_toggleFlyout` (before `_toggleCollapse`):

```js
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
```

- [ ] **Step 6: Remove `showProjectDialog` method**

Delete the entire `showProjectDialog` method from `src/panel.js` (lines 574–657: the JSDoc comment, the method signature, and the closing `}`).

- [ ] **Step 7: Commit**

```
git add src/panel.js
git commit -m "feat(panel): replace project dialog with inline flyout accordion"
```

---

## Task 4: index.js — Orchestration

**Files:**
- Modify: `src/index.js`

- [ ] **Step 1: Update imports — add `createProject`, `listProjectPages`; remove `async`**

Replace the import line:
```js
import { CommentStore, getCurrentProject, setCurrentProject, listProjects, deleteProject } from './store.js';
```

With:
```js
import { CommentStore, getCurrentProject, setCurrentProject, listProjects, listProjectPages, createProject, deleteProject } from './store.js';
```

And change the IIFE opening from:
```js
(async function initCommentTool() {
```
To:
```js
(function initCommentTool() {
```

- [ ] **Step 2: Replace the project-resolution block**

Find:
```js
  // ── Project resolution ───────────────────────────────────────────────────
  let project = getCurrentProject();
  if (!project) {
    const result = await panel.showProjectDialog(listProjects(), null);
    if (result.action === 'cancel') { panel.unmount(); return; }
    project = result.project;
    setCurrentProject(project);
  }
```

Replace with:
```js
  // ── Project resolution ───────────────────────────────────────────────────
  let project = getCurrentProject();
  if (!project) {
    project = 'default';
    createProject(project);
    setCurrentProject(project);
  }
```

- [ ] **Step 3: Remove `switchProject` function**

Delete the entire `switchProject` async function:
```js
  async function switchProject() {
    const result = await panel.showProjectDialog(listProjects(), project, {
      onDelete: (name) => deleteProject(name),
    });
    if (result.action === 'cancel') return;
    const newName = result.project;
    if (newName === project) return;
    overlay.clearAll();
    project = newName;
    setCurrentProject(project);
    store = new CommentStore(project, url);
    panel.setProject(project);
    refresh();
  }
```

- [ ] **Step 4: Wire flyout events in panel wiring block**

In the `panel` wiring chain (`.on('switchProject', switchProject)` line), replace:
```js
    .on('switchProject', switchProject)
```

With these four handlers:
```js
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
```

- [ ] **Step 5: Commit**

```
git add src/index.js
git commit -m "feat(index): wire flyout events, auto-create default project, remove async"
```

---

## Task 5: Build, Run Tests, Smoke Test

**Files:**
- Modify: `index.html` (auto-regenerated)

- [ ] **Step 1: Run tests**

```
npm test
```

Expected: all tests pass.

- [ ] **Step 2: Build and regenerate bookmarklet**

```
npm run generate
```

Expected output:
```
Built dist/comment-tool.js
Bookmarklet injected into index.html (NNNNN chars)
```

- [ ] **Step 3: Manual smoke test**

Open `index.html` in a browser and copy the bookmarklet to the address bar. Open any webpage and run the bookmarklet. Verify:

1. Panel opens; project bar shows `📁 default ▾`
2. Click `📁 default ▾` → flyout opens with `default` expanded, showing "此專案尚無標註頁面", and the "新專案名稱…" input
3. Type a new project name in the input, press Enter → flyout closes, panel shows new project name
4. Click the pick button, annotate one element → annotation appears in list
5. Click `📁 <project> ▾` → flyout shows the current project with the annotated page listed (e.g. `↗ / 1 筆`)
6. Click another project in the list (if present) → its pages expand without switching
7. Click a page link → browser navigates to that URL; after load, panel shows that project's annotations
8. Open flyout → click 刪除 on a non-current project → confirm → project removed from list
9. Press Escape while flyout is open → flyout closes
10. Click outside the panel while flyout is open → flyout closes

- [ ] **Step 4: Final commit**

```
git add index.html
git commit -m "build: regenerate bookmarklet with flyout project switcher"
```
