// src/exporter.js
export class Exporter {
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

  /**
   * Encode comments into a shareable URL using the URL hash (#__ct__=…).
   * @param {string} pageUrl - Current page URL (without __ct__ fragment)
   * @param {Array}  comments
   * @returns {string} Share URL
   */
  static toShareURL(pageUrl, comments) {
    const payload = JSON.stringify({ version: 1, comments });
    const b64 = btoa(unescape(encodeURIComponent(payload)));
    const hashIndex = pageUrl.indexOf('#');
    const base     = hashIndex === -1 ? pageUrl : pageUrl.slice(0, hashIndex);
    const existing = hashIndex === -1 ? '' : pageUrl.slice(hashIndex + 1).replace(/&?__ct__=[^&]*/g, '');
    const newHash  = existing ? `${existing}&__ct__=${b64}` : `__ct__=${b64}`;
    return `${base}#${newHash}`;
  }

  /**
   * Decode shared comment data from a URL hash.
   * @param {string} hash - location.hash (e.g. "#__ct__=abc123")
   * @returns {{ version: number, comments: Array }|null}
   */
  static decodeShareHash(hash) {
    const m = (hash || '').replace(/^#/, '').match(/(?:^|&)__ct__=([^&]+)/);
    if (!m) return null;
    try {
      return JSON.parse(decodeURIComponent(escape(atob(m[1]))));
    } catch {
      return null;
    }
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
