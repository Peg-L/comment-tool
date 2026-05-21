import { describe, it, expect, beforeEach } from 'vitest';
import {
  createProject, listProjects, listProjectPages, deleteProject,
  deleteProjectPage, renameProject,
  CommentStore,
} from '../src/store.js';

beforeEach(() => localStorage.clear());

describe('createProject', () => {
  it('adds project to listProjects', () => {
    createProject('alpha');
    expect(listProjects()).toContain('alpha');
  });

  it('is idempotent — duplicate names not stored twice', () => {
    createProject('alpha');
    createProject('alpha');
    expect(listProjects().filter(p => p === 'alpha').length).toBe(1);
  });
});

describe('listProjects', () => {
  it('returns empty array when nothing stored', () => {
    expect(listProjects()).toEqual([]);
  });

  it('includes projects derived from annotation keys', () => {
    const store = new CommentStore('beta', 'https://example.com/');
    store.add('h1', 'Heading', 'note');
    expect(listProjects()).toContain('beta');
  });

  it('merges explicit and annotation-derived projects, sorted', () => {
    createProject('zebra');
    const store = new CommentStore('alpha', 'https://example.com/');
    store.add('h1', 'H', 'x');
    expect(listProjects()).toEqual(['alpha', 'zebra']);
  });
});

describe('listProjectPages', () => {
  it('returns empty array for project with no annotations', () => {
    createProject('empty');
    expect(listProjectPages('empty')).toEqual([]);
  });

  it('returns page entry with url, path, and count', () => {
    const store = new CommentStore('proj', 'https://example.com/dashboard');
    store.add('h1', 'H', 'note1');
    store.add('p',  'P', 'note2');
    const pages = listProjectPages('proj');
    expect(pages).toHaveLength(1);
    expect(pages[0].url).toBe('https://example.com/dashboard');
    expect(pages[0].path).toBe('/dashboard');
    expect(pages[0].count).toBe(2);
  });

  it('returns multiple pages sorted by path', () => {
    new CommentStore('proj', 'https://example.com/settings').add('a', 'A', 'x');
    new CommentStore('proj', 'https://example.com/dashboard').add('b', 'B', 'y');
    const pages = listProjectPages('proj');
    expect(pages.map(p => p.path)).toEqual(['/dashboard', '/settings']);
  });
});

describe('deleteProject', () => {
  it('removes annotation keys', () => {
    const store = new CommentStore('del-me', 'https://example.com/');
    store.add('h1', 'H', 'note');
    deleteProject('del-me');
    expect(listProjects()).not.toContain('del-me');
    expect(listProjectPages('del-me')).toEqual([]);
  });

  it('removes from explicit project list', () => {
    createProject('explicit');
    deleteProject('explicit');
    expect(listProjects()).not.toContain('explicit');
  });

  it('does not affect other projects', () => {
    createProject('keep');
    createProject('remove');
    deleteProject('remove');
    expect(listProjects()).toContain('keep');
  });
});

describe('renameProject', () => {
  it('moves annotation pages to the new project name', () => {
    new CommentStore('old-name', 'https://example.com/page').add('h1', 'H', 'note');

    renameProject('old-name', 'new-name');

    expect(listProjects()).toContain('new-name');
    expect(listProjects()).not.toContain('old-name');
    expect(listProjectPages('new-name')).toHaveLength(1);
    expect(listProjectPages('old-name')).toEqual([]);
  });

  it('does not overwrite an existing project name', () => {
    createProject('taken');
    createProject('source');

    expect(() => renameProject('source', 'taken')).toThrow('PROJECT_EXISTS');
  });
});

describe('deleteProjectPage', () => {
  it('removes only the selected page from a project', () => {
    new CommentStore('proj', 'https://example.com/a').add('h1', 'A', 'note');
    new CommentStore('proj', 'https://example.com/b').add('h1', 'B', 'note');

    deleteProjectPage('proj', 'https://example.com/a');

    expect(listProjectPages('proj').map(p => p.path)).toEqual(['/b']);
  });
});
