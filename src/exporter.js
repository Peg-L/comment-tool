// src/exporter.js
export class Exporter {
  /**
   * Format comments as an AI-ready prompt string.
   */
  static toPrompt(url, comments) {
    if (comments.length === 0) {
      return `以下是審核人員針對 ${url} 的標註意見：\n\n（尚無標註）`;
    }
    const lines = comments.map((c, i) =>
      `[${i + 1}] 元素：${c.elementLabel}\n    意見：${c.text}`
    );
    return [
      `以下是審核人員針對 ${url} 的標註意見，請根據這些意見給出改善建議：`,
      '',
      ...lines,
    ].join('\n');
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
