// src/picker.js
import { getUniqueSelector, getShortLabel } from './selector.js';

const TOOL_ATTR = 'data-__ct__panel';
const BADGE_ATTR = 'data-__ct__badge';

/**
 * ElementPicker — enter "pick mode": hover highlights elements in blue,
 * click captures selector. Fires onPick({ selector, label }) or onCancel().
 */
export class ElementPicker {
  constructor(doc) {
    this._doc = doc;
    this._hovered = null;
    this._savedOutline = '';
    this._active = false;
    this._onPick = null;
    this._onCancel = null;

    this._onMouseOver = this._onMouseOver.bind(this);
    this._onMouseOut = this._onMouseOut.bind(this);
    this._onClick = this._onClick.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
  }

  _isTool(el) {
    return el.closest(`[${TOOL_ATTR}]`) || el.closest(`[${BADGE_ATTR}]`);
  }

  _onMouseOver(e) {
    const el = e.target;
    if (this._isTool(el)) return;
    if (this._hovered && this._hovered !== el) {
      this._hovered.style.outline = this._savedOutline;
    }
    this._hovered = el;
    this._savedOutline = el.style.outline || '';
    el.style.outline = '2px solid #3b82f6';
    el.style.outlineOffset = '2px';
    e.stopPropagation();
  }

  _onMouseOut(e) {
    const el = e.target;
    if (this._hovered === el) {
      el.style.outline = this._savedOutline;
      el.style.outlineOffset = '';
      this._hovered = null;
    }
  }

  _onClick(e) {
    e.preventDefault();
    e.stopPropagation();
    const el = e.target;
    if (this._isTool(el)) return;
    if (this._hovered) {
      this._hovered.style.outline = this._savedOutline;
      this._hovered.style.outlineOffset = '';
      this._hovered = null;
    }
    const selector = getUniqueSelector(el, this._doc);
    const label = getShortLabel(selector);

    // Collect element metadata to help disambiguate in the prompt
    const tagName = el.tagName;
    const innerText = (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 120);
    const attrs = {};
    if (el.alt) attrs.alt = el.alt;
    if (el.getAttribute('aria-label')) attrs['aria-label'] = el.getAttribute('aria-label');
    if (el.id) attrs.id = el.id;
    if (el.getAttribute('placeholder')) attrs.placeholder = el.getAttribute('placeholder');
    const rect = el.getBoundingClientRect();

    this.suspend(); // pause hover/click while dialog is shown
    if (this._onPick) this._onPick({ selector, label, element: el, meta: { tagName, innerText, attrs }, rect });
  }

  _onKeyDown(e) {
    if (e.key === 'Escape') {
      this.stop();
      if (this._onCancel) this._onCancel();
    }
  }

  start({ onPick, onCancel }) {
    if (this._active) return;
    this._active = true;
    this._onPick = onPick;
    this._onCancel = onCancel;
    this._doc.addEventListener('mouseover', this._onMouseOver, true);
    this._doc.addEventListener('mouseout', this._onMouseOut, true);
    this._doc.addEventListener('click', this._onClick, true);
    this._doc.addEventListener('keydown', this._onKeyDown, true);
    this._doc.body.style.cursor = 'crosshair';
  }

  /** Temporarily remove hover/click/keyboard listeners while a dialog is open. */
  suspend() {
    if (!this._active) return;
    this._doc.removeEventListener('mouseover', this._onMouseOver, true);
    this._doc.removeEventListener('mouseout', this._onMouseOut, true);
    this._doc.removeEventListener('click', this._onClick, true);
    this._doc.removeEventListener('keydown', this._onKeyDown, true);
    this._doc.body.style.cursor = '';
    if (this._hovered) {
      this._hovered.style.outline = this._savedOutline;
      this._hovered.style.outlineOffset = '';
      this._hovered = null;
    }
  }

  /** Re-attach hover/click/keyboard listeners after a dialog is closed. */
  resume() {
    if (!this._active) return;
    this._doc.addEventListener('mouseover', this._onMouseOver, true);
    this._doc.addEventListener('mouseout', this._onMouseOut, true);
    this._doc.addEventListener('click', this._onClick, true);
    this._doc.addEventListener('keydown', this._onKeyDown, true);
    this._doc.body.style.cursor = 'crosshair';
  }

  stop() {
    if (!this._active) return;
    this._active = false;
    this._doc.removeEventListener('mouseover', this._onMouseOver, true);
    this._doc.removeEventListener('mouseout', this._onMouseOut, true);
    this._doc.removeEventListener('click', this._onClick, true);
    this._doc.removeEventListener('keydown', this._onKeyDown, true);
    this._doc.body.style.cursor = '';
    if (this._hovered) {
      this._hovered.style.outline = this._savedOutline;
      this._hovered.style.outlineOffset = '';
      this._hovered = null;
    }
  }

  get isActive() { return this._active; }
}
