// src/overlay.js
const BADGE_ID_PREFIX = '__ct_badge_';
const COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6',
];

function getColor(i) { return COLORS[i % COLORS.length]; }

/**
 * OverlayManager — draws colored outlines + numbered badges on annotated elements.
 * Badges are fixed-position divs injected into document.body.
 */
export class OverlayManager {
  constructor(doc) {
    this._doc = doc;
    this._badges = new Map(); // id → { badgeEl, element, missing }
    this._observer = null;
    this._onReposition = this._reposition.bind(this);
  }

  renderAll(comments) {
    this.clearAll();
    comments.forEach((c, i) => this._render(c, i + 1));
    this._startObserver();
  }

  _render(comment, num) {
    const el = this._doc.querySelector(comment.selector);
    const color = getColor(num - 1);

    if (!el) {
      this._badges.set(comment.id, { badgeEl: null, element: null, missing: true });
      return;
    }

    // Outline
    el.dataset.__ctPrevOutline = el.style.outline || '';
    el.dataset.__ctPrevOffset = el.style.outlineOffset || '';
    el.style.outline = `2px solid ${color}`;
    el.style.outlineOffset = '2px';

    // Badge
    const badge = this._doc.createElement('div');
    badge.id = BADGE_ID_PREFIX + comment.id;
    badge.setAttribute('data-__ct__badge', 'true');
    Object.assign(badge.style, {
      position: 'fixed',
      zIndex: '2147483646',
      background: color,
      color: '#fff',
      borderRadius: '50%',
      width: '20px',
      height: '20px',
      fontSize: '11px',
      fontWeight: 'bold',
      fontFamily: 'sans-serif',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      pointerEvents: 'none',
      boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
    });
    badge.textContent = String(num);
    this._doc.body.appendChild(badge);
    this._badges.set(comment.id, { badgeEl: badge, element: el, missing: false });
    this._positionBadge(badge, el);
  }

  _positionBadge(badge, el) {
    const rect = el.getBoundingClientRect();
    badge.style.top = Math.max(0, rect.top - 10) + 'px';
    badge.style.left = Math.min(window.innerWidth - 24, rect.right - 10) + 'px';
  }

  _reposition() {
    this._badges.forEach(({ badgeEl, element }) => {
      if (badgeEl && element) this._positionBadge(badgeEl, element);
    });
  }

  removeOne(id) {
    const entry = this._badges.get(id);
    if (!entry) return;
    if (entry.badgeEl) entry.badgeEl.remove();
    if (entry.element) {
      entry.element.style.outline = entry.element.dataset.__ctPrevOutline || '';
      entry.element.style.outlineOffset = entry.element.dataset.__ctPrevOffset || '';
      delete entry.element.dataset.__ctPrevOutline;
      delete entry.element.dataset.__ctPrevOffset;
    }
    this._badges.delete(id);
  }

  clearAll() {
    this._badges.forEach((_, id) => this.removeOne(id));
    this._badges.clear();
    this._stopObserver();
  }

  isMissing(id) { return this._badges.get(id)?.missing === true; }

  _startObserver() {
    if (this._observer) return;
    this._observer = new MutationObserver(this._onReposition);
    this._observer.observe(this._doc.body, { childList: true, subtree: true });
    window.addEventListener('scroll', this._onReposition, { passive: true });
    window.addEventListener('resize', this._onReposition, { passive: true });
  }

  _stopObserver() {
    if (this._observer) { this._observer.disconnect(); this._observer = null; }
    window.removeEventListener('scroll', this._onReposition);
    window.removeEventListener('resize', this._onReposition);
  }
}
