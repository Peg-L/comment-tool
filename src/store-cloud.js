// src/store-cloud.js

export class SupabaseAdapter {
  /**
   * @param {{ supabaseUrl: string, supabaseKey: string }} config
   */
  constructor({ supabaseUrl, supabaseKey }) {
    this._base = supabaseUrl.replace(/\/$/, '') + '/rest/v1';
    this._key  = supabaseKey;
  }

  _headers(extra = {}) {
    return {
      'apikey':        this._key,
      'Authorization': `Bearer ${this._key}`,
      'Content-Type':  'application/json',
      ...extra,
    };
  }

  async _get(path) {
    const res = await fetch(this._base + path, { headers: this._headers() });
    if (!res.ok) throw new Error(`Supabase GET ${path} → ${res.status}`);
    return res.json();
  }

  async _post(path, body) {
    const res = await fetch(this._base + path, {
      method:  'POST',
      headers: this._headers({ 'Prefer': 'return=representation' }),
      body:    JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Supabase POST ${path} → ${res.status}`);
    const rows = await res.json();
    return Array.isArray(rows) ? rows[0] : rows;
  }

  async _patch(path, body) {
    const res = await fetch(this._base + path, {
      method:  'PATCH',
      headers: this._headers({ 'Prefer': 'return=representation' }),
      body:    JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Supabase PATCH ${path} → ${res.status}`);
    const rows = await res.json();
    return Array.isArray(rows) ? rows[0] : rows;
  }

  async _delete(path) {
    const res = await fetch(this._base + path, {
      method:  'DELETE',
      headers: this._headers(),
    });
    if (!res.ok) throw new Error(`Supabase DELETE ${path} → ${res.status}`);
  }

  _q(params) {
    return '?' + new URLSearchParams(params).toString();
  }

  _rowToComment(row) {
    return {
      id:           row.id,
      selector:     row.selector,
      elementLabel: row.element_label,
      text:         row.text,
      meta:         row.meta || {},
      createdAt:    row.created_at,
    };
  }

  // ── Projects ──────────────────────────────────────────────────────────────

  async listProjects() {
    const rows = await this._get('/projects?select=name,created_at&order=name.asc');
    return rows.map(r => ({ id: r.name, name: r.name }));
  }

  async createProject(name) {
    try {
      await this._post('/projects', { name });
    } catch (e) {
      // 409 / duplicate key = already exists; treat as success
      if (!String(e.message).includes('409') && !String(e.message).includes('duplicate')) throw e;
    }
    return { id: name, name };
  }

  async deleteProject(id) {
    await this._delete('/projects' + this._q({ name: `eq.${id}` }));
  }

  async listProjectPages(projectId) {
    const rows = await this._get(
      '/annotations' + this._q({ project_name: `eq.${projectId}`, select: 'page_url,page_title' })
    );
    const map = new Map();
    rows.forEach(r => {
      if (!map.has(r.page_url)) map.set(r.page_url, { url: r.page_url, count: 0 });
      map.get(r.page_url).count++;
    });
    return Array.from(map.values()).map(({ url, count }) => {
      let path = url;
      try { const u = new URL(url); path = u.pathname + (u.search || ''); } catch { /* keep url */ }
      return { url, path, count };
    }).sort((a, b) => a.path.localeCompare(b.path));
  }

  // ── Annotations ───────────────────────────────────────────────────────────

  async getAnnotations(projectId, pageUrl) {
    const rows = await this._get(
      '/annotations' + this._q({
        project_name: `eq.${projectId}`,
        page_url:     `eq.${pageUrl}`,
        select:       '*',
        order:        'created_at.asc',
      })
    );
    return rows.map(r => this._rowToComment(r));
  }

  async addAnnotation(projectId, pageUrl, pageTitle, { selector, elementLabel, text, meta }) {
    const row = await this._post('/annotations', {
      project_name:  projectId,
      page_url:      pageUrl,
      page_title:    pageTitle,
      selector,
      element_label: elementLabel,
      text,
      meta:          meta || {},
    });
    return this._rowToComment(row);
  }

  async updateAnnotation(id, text) {
    await this._patch(
      '/annotations' + this._q({ id: `eq.${id}` }),
      { text, updated_at: new Date().toISOString() }
    );
  }

  async deleteAnnotation(id) {
    await this._delete('/annotations' + this._q({ id: `eq.${id}` }));
  }

  async clearAnnotations(projectId, pageUrl) {
    await this._delete(
      '/annotations' + this._q({ project_name: `eq.${projectId}`, page_url: `eq.${pageUrl}` })
    );
  }

  async exportPageJSON(projectId, pageUrl) {
    const comments = await this.getAnnotations(projectId, pageUrl);
    return JSON.stringify({ version: 1, url: pageUrl, comments }, null, 2);
  }

  async importPageJSON(projectId, pageUrl, pageTitle, jsonString) {
    const { comments } = JSON.parse(jsonString);
    await this.clearAnnotations(projectId, pageUrl);
    for (const c of comments) {
      await this.addAnnotation(projectId, pageUrl, pageTitle, {
        selector:     c.selector,
        elementLabel: c.elementLabel,
        text:         c.text,
        meta:         c.meta,
      });
    }
  }
}
