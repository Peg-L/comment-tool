// src/selector.js

const cssEscape = (typeof CSS !== 'undefined' && CSS.escape)
  ? (s) => CSS.escape(s)
  : (s) => s.replace(/[^\w-]/g, c => '\\' + c);

/**
 * Generate a unique CSS selector path for a DOM element.
 * Uses #id when available (stops early). Otherwise builds tag:nth-child path.
 * @param {Element} el
 * @param {Document} doc
 * @returns {string}
 */
export function getUniqueSelector(el, doc) {
  const parts = [];
  let current = el;

  while (current && current.nodeType === 1 && current !== doc.documentElement) {
    if (current.id) {
      parts.unshift('#' + cssEscape(current.id));
      break;
    }

    const tag = current.tagName.toLowerCase();
    const parent = current.parentElement;

    if (!parent) {
      parts.unshift(tag);
      break;
    }

    const siblings = Array.from(parent.children).filter(c => c.tagName === current.tagName);
    if (siblings.length === 1) {
      parts.unshift(tag);
    } else {
      const index = Array.from(parent.children).indexOf(current) + 1;
      parts.unshift(`${tag}:nth-child(${index})`);
    }

    current = parent;
  }

  return parts.join(' > ');
}

/**
 * Return the last 2 segments of a selector for panel display.
 * @param {string} selector
 * @returns {string}
 */
export function getShortLabel(selector) {
  const parts = selector.split(' > ');
  return parts.slice(-2).join(' > ');
}
