/**
 * Halo — Configuration Manager
 * Read/write halo-config.json in the user data directory.
 */

const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
let userDataPath;
try {
  const { app } = require('electron');
  userDataPath = app && typeof app.getPath === 'function'
    ? app.getPath('userData')
    : path.join(process.env.HOME || process.env.USERPROFILE || '.', '.halo');
} catch {
  userDataPath = path.join(process.env.HOME || process.env.USERPROFILE || '.', '.halo');
}

const CONFIG_FILENAME = 'halo-config.json';

const DEFAULT_CONFIG = {
  provider: 'openai',
  apiKey: '',
  sttProvider: 'openai',
  sttApiKey: '',
  useSmart: true,
  hotkeys: {
    toggleOverlay: 'CommandOrControl+B',
    assist: 'CommandOrControl+Return',
    solveCode: 'CommandOrControl+Shift+H',
    quit: 'CommandOrControl+Shift+X',
  },
};

class ConfigManager {
  constructor() {
    this.configPath = path.join(userDataPath, CONFIG_FILENAME);
    this.data = {};
    this._load();
  }

  /** Load config from disk, merging with defaults. */
  _load() {
    try {
      if (fs.existsSync(this.configPath)) {
        const raw = fs.readFileSync(this.configPath, 'utf-8');
        const parsed = JSON.parse(raw);
        this.data = { ...structuredClone(DEFAULT_CONFIG), ...parsed, hotkeys: { ...DEFAULT_CONFIG.hotkeys, ...parsed.hotkeys } };
      } else {
        this.data = structuredClone(DEFAULT_CONFIG);
      }
    } catch (err) {
      console.warn('Failed to load config, using defaults:', err.message);
      this.data = structuredClone(DEFAULT_CONFIG);
    }
  }

  /** Save current config to disk. */
  _save(data) {
    fs.mkdirSync(path.dirname(this.configPath), { recursive: true });
    const temporaryPath = `${this.configPath}.${randomUUID()}.tmp`;
    try {
      fs.writeFileSync(temporaryPath, JSON.stringify(data, null, 2), { encoding: 'utf-8', mode: 0o600, flag: 'wx' });
      fs.renameSync(temporaryPath, this.configPath);
      this.data = data;
    } finally {
      try { fs.unlinkSync(temporaryPath); } catch {} // Rename already removes the temporary file.
    }
  }

  /** Persist settings together so callers never observe a partially saved form. */
  update(values) {
    if (!values || typeof values !== 'object' || Array.isArray(values)) throw new Error('Invalid settings values.');
    for (const key of Object.keys(values)) {
      if (!key || key.includes('.') || ['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('Invalid settings key.');
    }
    const data = { ...structuredClone(this.data), ...structuredClone(values) };
    data.hotkeys = { ...this.data.hotkeys, ...values.hotkeys };
    this._save(data);
  }

  /**
   * Get a config value.
   * @param {string} key - Dot-notation key (e.g., 'hotkeys.toggleOverlay')
   * @param {*} defaultValue - Fallback if key not found
   * @returns {*}
   */
  get(key, defaultValue) {
    const keys = key.split('.');
    let value = this.data;

    for (const k of keys) {
      if (value == null || typeof value !== 'object') {
        return defaultValue;
      }
      value = value[k];
    }

    return value !== undefined ? value : defaultValue;
  }

  /**
   * Set a config value and persist.
   * @param {string} key - Dot-notation key
   * @param {*} value
   */
  set(key, value) {
    const keys = typeof key === 'string' ? key.split('.') : [];
    if (!keys.length || keys.some(k => !k || ['__proto__', 'constructor', 'prototype'].includes(k))) throw new Error('Invalid settings key.');
    const data = structuredClone(this.data);
    let target = data;

    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (target[k] == null || typeof target[k] !== 'object') {
        target[k] = {};
      }
      target = target[k];
    }

    target[keys[keys.length - 1]] = structuredClone(value);
    this._save(data);
  }

  /**
   * Get all config values.
   * @returns {Object}
   */
  getAll() {
    return structuredClone(this.data);
  }

  /**
   * Reset to defaults and persist.
   */
  reset() {
    this._save(structuredClone(DEFAULT_CONFIG));
  }
}

module.exports = { ConfigManager, DEFAULT_CONFIG };
