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
  it('parses copy-paste JSON', () => {
    const payload = {
      version: 1,
      type: 'comment-tool-annotations',
      url: 'https://site.test/page',
      pageTitle: 'Page',
      project: 'review',
      comments,
    };
    const json = JSON.stringify(payload);

    expect(Exporter.parsePortableText(json)).toMatchObject(payload);
  });

  it('strips share hashes while preserving non-tool hashes', () => {
    const urlWithHash = 'https://site.test/page#section&__ct__=abc123';
    expect(Exporter.stripShareHash(urlWithHash)).toBe('https://site.test/page#section');
  });

  it('exports and parses complete project JSON with all pages', () => {
    const json = Exporter.toProjectJSON('review', [
      {
        url: 'https://site.test/a',
        path: '/a',
        comments,
      },
      {
        url: 'https://site.test/b',
        path: '/b',
        comments: [],
      },
    ]);

    expect(Exporter.parsePortableText(json)).toMatchObject({
      version: 1,
      type: 'comment-tool-project',
      project: 'review',
      pages: [
        { url: 'https://site.test/a', path: '/a', comments },
        { url: 'https://site.test/b', path: '/b', comments: [] },
      ],
    });
  });
});
