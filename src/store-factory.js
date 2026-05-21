// src/store-factory.js
import { LocalAdapter } from './store.js';

export function hasBuiltInConfig() {
  return false;
}

export function loadConfig() {
  return {};
}

export function saveConfig() {
  return undefined;
}

export function clearConfig() {
  return undefined;
}

export function createStoreFromConfig() {
  return new LocalAdapter();
}

/**
 * Returns the local StorageAdapter. Sharing is done by copied data or URL hash,
 * not by any remote database.
 */
export function getStore() {
  return new LocalAdapter();
}
