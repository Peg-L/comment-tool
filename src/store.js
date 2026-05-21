// src/store.js
const STORAGE_PREFIX = 'comment-tool:';
const CURRENT_PROJECT_KEY = 'comment-tool:__current-project__';
const PROJECT_LIST_KEY = 'comment-tool:__project-list__';
export const SINGLE_PROJECT_NAME = '審核小精靈';

function _getProjectList() {
  try {
    const raw = localStorage.getItem(PROJECT_LIST_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function _saveProjectList(list) {
  localStorage.setItem(PROJECT_LIST_KEY, JSON.stringify(list));
}

function generateId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function projectPageKey(projectName, pageUrl) {
  return `${STORAGE_PREFIX}${projectName}:${pageUrl}`;
}

/** Persist / retrieve the last-used project name across page loads. */
export function getCurrentProject() {
  return localStorage.getItem(CURRENT_PROJECT_KEY) || '';
}
export function setCurrentProject(name) {
  localStorage.setItem(CURRENT_PROJECT_KEY, name);
}

/** Add a named project to the persistent project list (no-op if already exists). */
export function createProject(name) {
  if (!name) return;
  const list = _getProjectList();
  if (!list.includes(name)) {
    list.push(name);
    _saveProjectList(list);
  }
}

/** Return all distinct project names found in localStorage. */
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

/** Remove all localStorage entries belonging to a project. */
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

/** Rename a project and move all page annotations under the new name. */
export function renameProject(oldName, newName) {
  const from = (oldName || '').trim();
  const to = (newName || '').trim();
  if (!from || !to || from === to) return;
  if (listProjects().includes(to)) throw new Error('PROJECT_EXISTS');

  const oldPrefix = `${STORAGE_PREFIX}${from}:`;
  const moves = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(oldPrefix)) {
      moves.push({
        oldKey: key,
        newKey: `${STORAGE_PREFIX}${to}:${key.slice(oldPrefix.length)}`,
        value: localStorage.getItem(key),
      });
    }
  }

  moves.forEach(({ newKey, value }) => localStorage.setItem(newKey, value));
  moves.forEach(({ oldKey }) => localStorage.removeItem(oldKey));

  const list = _getProjectList().filter(p => p !== from);
  if (!list.includes(to)) list.push(to);
  _saveProjectList(list);

  if (getCurrentProject() === from) setCurrentProject(to);
}

export class CommentStore {
  /**
   * @param {string} project  Project name / identifier
   * @param {string} url      Full page URL
   */
  constructor(project, url) {
    this._key = projectPageKey(project, url);
    this._data = this._load();
  }

  _load() {
    try {
      const raw = localStorage.getItem(this._key);
      if (!raw) return { version: 1, url: this._key.slice(STORAGE_PREFIX.length), comments: [] };
      return JSON.parse(raw);
    } catch {
      return { version: 1, url: this._key.slice(STORAGE_PREFIX.length), comments: [] };
    }
  }

  _save() {
    try {
      localStorage.setItem(this._key, JSON.stringify(this._data));
    } catch {
      throw new Error('STORAGE_FULL');
    }
  }

  getAll() {
    return this._data.comments;
  }

  add(selector, elementLabel, text, meta = {}) {
    const comment = {
      id: generateId(),
      selector,
      elementLabel,
      text,
      meta,
      done: false,
      createdAt: new Date().toISOString(),
    };
    this._data.comments.push(comment);
    this._save();
    return comment;
  }

  update(id, text) {
    const comment = this._data.comments.find(c => c.id === id);
    if (!comment) return;
    comment.text = text;
    this._save();
  }

  delete(id) {
    this._data.comments = this._data.comments.filter(c => c.id !== id);
    this._save();
  }

  setDone(id, done) {
    const comment = this._data.comments.find(c => c.id === id);
    if (!comment) return;
    comment.done = !!done;
    this._save();
  }

  clear() {
    this._data.comments = [];
    this._save();
  }

  exportJSON() {
    return JSON.stringify(this._data, null, 2);
  }

  importJSON(jsonString) {
    const parsed = JSON.parse(jsonString);
    if (!parsed.version || !Array.isArray(parsed.comments)) {
      throw new Error('INVALID_FORMAT');
    }
    this._data = parsed;
    this._save();
  }
}

/**
 * LocalAdapter — wraps all localStorage operations behind the async StorageAdapter interface.
 * Sharing happens outside storage through copied JSON or URL hash payloads.
 */
export class LocalAdapter {
  // ── Projects ─────────────────────────────────────────────────────────────

  async listProjects() {
    return listProjects().map(name => ({ id: name, name }));
  }

  async createProject(name) {
    createProject(name);
    return { id: name, name };
  }

  async deleteProject(id) {
    deleteProject(id);
  }

  async renameProject(id, name) {
    renameProject(id, name);
    return { id: name, name };
  }

  async listProjectPages(projectId) {
    return listProjectPages(projectId);
  }

  // ── Annotations ───────────────────────────────────────────────────────────

  async getAnnotations(projectId, pageUrl) {
    return new CommentStore(projectId, pageUrl).getAll();
  }

  async addAnnotation(projectId, pageUrl, _pageTitle, { selector, elementLabel, text, meta }) {
    const cs = new CommentStore(projectId, pageUrl);
    return cs.add(selector, elementLabel, text, meta);
  }

  async updateAnnotation(id, text, projectId, pageUrl) {
    new CommentStore(projectId, pageUrl).update(id, text);
  }

  async deleteAnnotation(id, projectId, pageUrl) {
    new CommentStore(projectId, pageUrl).delete(id);
  }

  async setAnnotationDone(id, done, projectId, pageUrl) {
    new CommentStore(projectId, pageUrl).setDone(id, done);
  }

  async clearAnnotations(projectId, pageUrl) {
    new CommentStore(projectId, pageUrl).clear();
  }

  async exportPageJSON(projectId, pageUrl) {
    return new CommentStore(projectId, pageUrl).exportJSON();
  }

  async importPageJSON(projectId, pageUrl, _pageTitle, jsonString) {
    new CommentStore(projectId, pageUrl).importJSON(jsonString);
  }
}
