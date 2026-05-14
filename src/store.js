// src/store.js
const STORAGE_PREFIX = 'comment-tool:';
const CURRENT_PROJECT_KEY = 'comment-tool:__current-project__';

function generateId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/** Persist / retrieve the last-used project name across page loads. */
export function getCurrentProject() {
  return localStorage.getItem(CURRENT_PROJECT_KEY) || '';
}
export function setCurrentProject(name) {
  localStorage.setItem(CURRENT_PROJECT_KEY, name);
}

/** Return all distinct project names found in localStorage. */
export function listProjects() {
  const projects = new Set();
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(STORAGE_PREFIX) && k !== CURRENT_PROJECT_KEY) {
      // key format: comment-tool:<project>:<url>
      const rest = k.slice(STORAGE_PREFIX.length);
      const sep = rest.indexOf(':');
      if (sep !== -1) projects.add(rest.slice(0, sep));
    }
  }
  return Array.from(projects).sort();
}

export class CommentStore {
  /**
   * @param {string} project  Project name / identifier
   * @param {string} url      Full page URL
   */
  constructor(project, url) {
    this._key = `${STORAGE_PREFIX}${project}:${url}`;
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
