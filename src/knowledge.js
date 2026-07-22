/**
 * Halo — Knowledge Base Manager
 * Stores and retrieves resume text and uploaded documents.
 * Data persists in ~/.halo/knowledge/ as JSON files.
 */

const fs = require('fs');
const path = require('path');
let userDataPath;
try {
  const { app } = require('electron');
  userDataPath = app && typeof app.getPath === 'function'
    ? app.getPath('userData')
    : path.join(process.env.HOME || process.env.USERPROFILE || '.', '.halo');
} catch {
  userDataPath = path.join(process.env.HOME || process.env.USERPROFILE || '.', '.halo');
}

const KNOWLEDGE_DIR = path.join(userDataPath, 'knowledge');
const RESUME_FILE = path.join(KNOWLEDGE_DIR, 'resume.json');
const DOCS_FILE = path.join(KNOWLEDGE_DIR, 'documents.json');

// Max text length per document (chars) to keep prompts manageable
const MAX_DOC_TEXT = 50000;
const MAX_RESUME_TEXT = 30000;

class KnowledgeBase {
  constructor() {
    this._ensureDir();
    this._resume = this._loadJSON(RESUME_FILE, null);
    this._documents = this._loadJSON(DOCS_FILE, []);
  }

  // ─── Resume ───────────────────────────────────────────────────────────

  /** @returns {{ filename: string, text: string, uploadedAt: string } | null} */
  getResume() {
    return this._resume;
  }

  /**
   * Store resume from a PDF file.
   * @param {string} filePath - Absolute path to PDF
   * @returns {Promise<{ filename: string, text: string, uploadedAt: string }>}
   */
  async setResume(filePath) {
    const text = await this._extractText(filePath);
    const trimmed = text.slice(0, MAX_RESUME_TEXT);

    this._resume = {
      filename: path.basename(filePath),
      text: trimmed,
      uploadedAt: new Date().toISOString(),
    };

    this._saveJSON(RESUME_FILE, this._resume);
    return this._resume;
  }

  /** Remove stored resume. */
  clearResume() {
    this._resume = null;
    if (fs.existsSync(RESUME_FILE)) {
      fs.unlinkSync(RESUME_FILE);
    }
  }

  // ─── Documents ────────────────────────────────────────────────────────

  /** @returns {Array<{ id: string, filename: string, textLength: number, uploadedAt: string }>} */
  listDocuments() {
    return this._documents.map((d) => ({
      id: d.id,
      filename: d.filename,
      textLength: d.text.length,
      uploadedAt: d.uploadedAt,
    }));
  }

  /**
   * Add a document to the knowledge base.
   * @param {string} filePath - Absolute path to PDF, TXT, or MD file
   * @returns {Promise<{ id: string, filename: string, textLength: number }>}
   */
  async addDocument(filePath) {
    const text = await this._extractText(filePath);
    const trimmed = text.slice(0, MAX_DOC_TEXT);
    const id = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const doc = {
      id,
      filename: path.basename(filePath),
      text: trimmed,
      uploadedAt: new Date().toISOString(),
    };

    this._documents.push(doc);
    this._saveJSON(DOCS_FILE, this._documents);

    return { id, filename: doc.filename, textLength: trimmed.length };
  }

  /**
   * Remove a document by ID.
   * @param {string} id
   * @returns {boolean} true if found and removed
   */
  removeDocument(id) {
    const idx = this._documents.findIndex((d) => d.id === id);
    if (idx === -1) return false;

    this._documents.splice(idx, 1);
    this._saveJSON(DOCS_FILE, this._documents);
    return true;
  }

  // ─── Context Builder ──────────────────────────────────────────────────

  /**
   * Build a context string from resume + documents for injection into prompts.
   * @returns {string} formatted context or empty string
   */
  getContext() {
    const parts = [];

    if (this._resume && this._resume.text) {
      parts.push(
        `[USER RESUME]\n${this._resume.text}\n[/USER RESUME]`
      );
    }

    if (this._documents.length > 0) {
      const docTexts = this._documents.map(
        (d) => `--- ${d.filename} ---\n${d.text}`
      );
      parts.push(
        `[KNOWLEDGE BASE DOCUMENTS]\n${docTexts.join('\n\n')}\n[/KNOWLEDGE BASE DOCUMENTS]`
      );
    }

    return parts.join('\n\n');
  }

  /**
   * Check if any knowledge context is available.
   * @returns {boolean}
   */
  hasContext() {
    return !!(this._resume?.text || this._documents.length > 0);
  }

  // ─── Private Helpers ──────────────────────────────────────────────────

  _ensureDir() {
    if (!fs.existsSync(KNOWLEDGE_DIR)) {
      fs.mkdirSync(KNOWLEDGE_DIR, { recursive: true });
    }
  }

  _loadJSON(filePath, fallback) {
    try {
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      }
    } catch (err) {
      console.warn(`KnowledgeBase: Failed to load ${filePath}:`, err.message);
    }
    return fallback;
  }

  _saveJSON(filePath, data) {
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error(`KnowledgeBase: Failed to save ${filePath}:`, err.message);
    }
  }

  /**
   * Extract text from a file (PDF, TXT, MD).
   * @param {string} filePath
   * @returns {Promise<string>}
   */
  async _extractText(filePath) {
    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.pdf') {
      return await this._extractPDF(filePath);
    } else if (['.txt', '.md', '.markdown', '.text'].includes(ext)) {
      return fs.readFileSync(filePath, 'utf-8');
    } else if (ext === '.json') {
      return fs.readFileSync(filePath, 'utf-8');
    } else {
      // Try to read as text
      try {
        return fs.readFileSync(filePath, 'utf-8');
      } catch {
        throw new Error(`Unsupported file type: ${ext}`);
      }
    }
  }

  async _extractPDF(filePath) {
    try {
      const pdfModule = require('pdf-parse');
      const buffer = fs.readFileSync(filePath);

      if (typeof pdfModule === 'function') {
        const data = await pdfModule(buffer);
        return data.text || '';
      } else if (pdfModule.PDFParse) {
        const parser = new pdfModule.PDFParse({ data: buffer });
        await parser.load();
        const parsed = await parser.getText();
        if (typeof parsed === 'string') return parsed;
        if (parsed && typeof parsed.text === 'string') return parsed.text;
        return '';
      } else if (pdfModule.default && typeof pdfModule.default === 'function') {
        const data = await pdfModule.default(buffer);
        return data.text || '';
      }
      return '';
    } catch (err) {
      console.error('PDF extraction failed:', err.message);
      try {
        return fs.readFileSync(filePath, 'utf-8');
      } catch {
        return '';
      }
    }
  }
}

module.exports = { KnowledgeBase };
