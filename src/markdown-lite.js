// src/markdown-lite.js
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Render a lightweight markdown subset (bold, inline code, "- " list lines) to safe HTML.
 * HTML-escapes first, so only the tags this function inserts can appear in the output.
 * Line breaks rely on CSS `white-space: pre-wrap` on the container, not <br> tags.
 */
export function renderLiteMarkdown(text) {
  const escaped = escapeHtml(text || '');
  return escaped
    .split('\n')
    .map(line => {
      const listMatch = line.match(/^(\s*)-\s+(.*)$/);
      return listMatch ? `${listMatch[1]}• ${listMatch[2]}` : line;
    })
    .join('\n')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+?)`/g, '<code>$1</code>');
}
