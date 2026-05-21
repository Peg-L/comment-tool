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

  static toPortableData(pageUrl, comments, { project = '', pageTitle = '' } = {}) {
    return {
      version: 1,
      type: 'comment-tool-annotations',
      url: pageUrl,
      pageTitle,
      project,
      comments,
    };
  }

  static toPortableJSON(pageUrl, comments, opts = {}) {
    return JSON.stringify(this.toPortableData(pageUrl, comments, opts), null, 2);
  }

  static _encodePayload(payload) {
    return btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  }

  static _decodePayload(value) {
    return JSON.parse(decodeURIComponent(escape(atob(value))));
  }

  /**
   * Encode comments into a shareable URL using the URL hash (#__ct__=…).
   * @param {string} pageUrl - Current page URL (without __ct__ fragment)
   * @param {Array}  comments
   * @returns {string} Share URL
   */
  static toShareURL(pageUrl, comments, opts = {}) {
    const payload = this.toPortableData(pageUrl, comments, opts);
    const b64 = this._encodePayload(payload);
    const hashIndex = pageUrl.indexOf('#');
    const base     = hashIndex === -1 ? pageUrl : pageUrl.slice(0, hashIndex);
    const existing = hashIndex === -1 ? '' : pageUrl.slice(hashIndex + 1).replace(new RegExp(`&?${this.SHARE_PARAM}=[^&]*`, 'g'), '');
    const newHash  = existing ? `${existing}&${this.SHARE_PARAM}=${b64}` : `${this.SHARE_PARAM}=${b64}`;
    return `${base}#${newHash}`;
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
    if (!payload || !payload.version || !Array.isArray(payload.comments)) {
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

