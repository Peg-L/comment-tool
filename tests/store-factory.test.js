import { describe, it, expect, beforeEach } from 'vitest';
import { LocalAdapter } from '../src/store.js';
import {
  clearConfig,
  createStoreFromConfig,
  getStore,
  hasBuiltInConfig,
  loadConfig,
  saveConfig,
} from '../src/store-factory.js';

beforeEach(() => localStorage.clear());

describe('store factory', () => {
  it('always uses local storage', () => {
    expect(hasBuiltInConfig()).toBe(false);
    expect(loadConfig()).toEqual({});
    expect(getStore()).toBeInstanceOf(LocalAdapter);
  });

  it('ignores legacy remote config values', () => {
    saveConfig({
      remoteUrl: 'https://example.test',
      remoteKey: 'legacy-key',
    });

    expect(loadConfig()).toEqual({});
    expect(createStoreFromConfig({
      remoteUrl: 'https://example.test',
      remoteKey: 'legacy-key',
    })).toBeInstanceOf(LocalAdapter);

    clearConfig();
    expect(getStore()).toBeInstanceOf(LocalAdapter);
  });
});
