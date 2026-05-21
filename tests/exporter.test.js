import { describe, it, expect } from 'vitest';
import { Exporter } from '../src/exporter.js';

const comments = [{
  id: 'a1',
  selector: 'main h1',
  elementLabel: 'h1',
  text: '調整標題文案',
  meta: { tagName: 'H1' },
  createdAt: '2026-05-21T00:00:00.000Z',
}];

describe('Exporter portable data', () => {
  it('exports and parses copy-paste JSON', () => {
    const json = Exporter.toPortableJSON('https://site.test/page', comments, {
      project: 'review',
      pageTitle: 'Page',
    });

    expect(Exporter.parsePortableText(json)).toMatchObject({
      version: 1,
      url: 'https://site.test/page',
      pageTitle: 'Page',
      project: 'review',
      comments,
    });
  });

  it('exports and decodes share URLs while preserving non-tool hashes', () => {
    const shareUrl = Exporter.toShareURL('https://site.test/page#section', comments, {
      project: 'review',
    });

    expect(shareUrl).toContain('#section&__ct__=');
    expect(Exporter.stripShareHash(shareUrl)).toBe('https://site.test/page#section');
    expect(Exporter.parsePortableText(shareUrl).comments).toEqual(comments);
  });
});
