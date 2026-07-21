/**
 * Halo — Configuration Manager
 * Read/write halo-config.json in the user data directory.
 */

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

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
    this.configPath = path.join(app.getPath('userData'), CONFIG_FILENAME);
    this.data = {};
    this._load();
  }

  /** Load config from disk, merging with defaults. */
  _load() {
    try {
      if (fs.existsSync(this.configPath)) {
        const raw = fs.readFileSync(this.configPath, 'utf-8');
        const parsed = JSON.parse(raw);
        this.data = { ...DEFAULT_CONFIG, ...parsed };
      } else {
        this.data = { ...DEFAULT_CONFIG };
      }
    } catch (err) {
      console.warn('Failed to load config, using defaults:', err.message);
      this.data = { ...DEFAULT_CONFIG };
    }
  }

  /** Save current config to disk. */
  _save() {
    try {
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.configPath, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save config:', err.message);
    }
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
    const keys = key.split('.');
    let target = this.data;

    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (target[k] == null || typeof target[k] !== 'object') {
        target[k] = {};
      }
      target = target[k];
    }

    target[keys[keys.length - 1]] = value;
    this._save();
  }

  /**
   * Get all config values.
   * @returns {Object}
   */
  getAll() {
    return { ...this.data };
  }

  /**
   * Reset to defaults and persist.
   */
  reset() {
    this.data = { ...DEFAULT_CONFIG };
    this._save();
  }
}

module.exports = { ConfigManager, DEFAULT_CONFIG };
