// src/exporter.js
export class Exporter {
  static get SHARE_PARAM() { return '__ct__'; }

  /**
   * Format comments as an AI-ready prompt, matching UISelector2AI structure.
   */
  static toPrompt(url, comments) {
    const lines = [
      '# Webpage Context',
      `URL: ${url}`,
      '',
      '# Annotations',
    ];

    if (!comments.length) {
      lines.push('', '（尚無標註）');
      return lines.join('\n');
    }

    comments.forEach((c, i) => {
      const meta  = c.meta  || {};
      const attrs = meta.attrs || {};

      lines.push('');
      lines.push(`## Annotation ${i + 1}`);
      lines.push(`**Target**: \`${c.selector}\``);
      if (meta.tagName)           lines.push(`**TagName**: ${meta.tagName}`);
      if (attrs.id)               lines.push(`**ID**: ${attrs.id}`);
      if (attrs.alt)              lines.push(`**Alt**: ${attrs.alt}`);
      if (attrs['aria-label'])    lines.push(`**Aria Label**: ${attrs['aria-label']}`);
      if (attrs.placeholder)      lines.push(`**Placeholder**: ${attrs.placeholder}`);
      if (meta.innerText)         lines.push(`**Inner Content**: ${meta.innerText}`);
      lines.push(`**Instruction**: ${c.text}`);
    });

    return lines.join('\n');
  }

  static toProjectData(project, pages) {
    return {
      version: 1,
      type: 'comment-tool-project',
      project,
      pages: pages.map(page => ({
        url: page.url || '',
        path: page.path || '',
        pageTitle: page.pageTitle || '',
        comments: Array.isArray(page.comments) ? page.comments : [],
      })),
    };
  }

  static toProjectJSON(project, pages) {
    return JSON.stringify(this.toProjectData(project, pages), null, 2);
  }

  static _encodePayload(payload) {
    return btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  }

  static _decodePayload(value) {
    return JSON.parse(decodeURIComponent(escape(atob(value))));
  }

  static stripShareHash(pageUrl) {
    const hashIndex = pageUrl.indexOf('#');
    if (hashIndex === -1) return pageUrl;

    const base = pageUrl.slice(0, hashIndex);
    const cleanHash = pageUrl
      .slice(hashIndex + 1)
      .replace(new RegExp(`&?${this.SHARE_PARAM}=[^&]*`, 'g'), '')
      .replace(/^&/, '');

    return cleanHash ? `${base}#${cleanHash}` : base;
  }

  /**
   * Decode shared comment data from a URL hash.
   * @param {string} hash - location.hash (e.g. "#__ct__=abc123")
   * @returns {{ version: number, comments: Array }|null}
   */
  static decodeShareHash(hash) {
    const m = (hash || '').replace(/^#/, '').match(new RegExp(`(?:^|&)${this.SHARE_PARAM}=([^&]+)`));
    if (!m) return null;
    try {
      return this._normalizePayload(this._decodePayload(m[1]));
    } catch {
      return null;
    }
  }

  static parsePortableText(text) {
    const raw = String(text || '').trim();
    if (!raw) throw new Error('EMPTY_IMPORT');

    try {
      const url = new URL(raw);
      const payload = this.decodeShareHash(url.hash);
      if (payload) return payload;
    } catch { /* keep trying as JSON */ }

    try {
      return this._normalizePayload(JSON.parse(raw));
    } catch {
      throw new Error('INVALID_IMPORT');
    }
  }

  static _normalizePayload(payload) {
    if (!payload || !payload.version) {
      throw new Error('INVALID_FORMAT');
    }

    if (Array.isArray(payload.pages)) {
      return {
        version: payload.version,
        type: payload.type || 'comment-tool-project',
        project: payload.project || '',
        pages: payload.pages.map(page => ({
          url: page.url || '',
          path: page.path || '',
          pageTitle: page.pageTitle || '',
          comments: Array.isArray(page.comments) ? page.comments : [],
        })).filter(page => page.url),
      };
    }

    if (!Array.isArray(payload.comments)) {
      throw new Error('INVALID_FORMAT');
    }

    return {
      version: payload.version,
      type: payload.type || 'comment-tool-annotations',
      url: payload.url || '',
      pageTitle: payload.pageTitle || '',
      project: payload.project || '',
      comments: payload.comments,
    };
  }

  /**
   * Copy text to clipboard. Falls back to execCommand for HTTP pages.
   * @returns {Promise<boolean>}
   */
  static async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    }
  }
}

