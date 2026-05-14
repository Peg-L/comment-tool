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
