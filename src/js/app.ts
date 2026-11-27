import { initI18n, t, applyTranslations } from './i18n.js';
import { createIcons, Moon, ArrowLeft, Upload, X, Merge, Scissors, Zap, Lock, Unlock, RotateCw, PenTool, Scan, Image, ImagePlus, Sun, Monitor, FileText } from 'lucide';
import '../css/styles.css';

const ICONS = { Moon, ArrowLeft, Upload, X, Merge, Scissors, Zap, Lock, Unlock, RotateCw, PenTool, Scan, Image, ImagePlus, Sun, Monitor, FileText };
const renderIcons = () => createIcons({ icons: ICONS });

type Theme = 'light' | 'dark' | 'system';

function getStoredTheme(): Theme {
  return (localStorage.getItem('theme') as Theme) || 'system';
}

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: Theme) {
  const resolved = theme === 'system' ? getSystemTheme() : theme;
  document.documentElement.setAttribute('data-theme', resolved);
  localStorage.setItem('theme', theme);
  updateThemeIcon(theme);
}

function updateThemeIcon(theme: Theme) {
  const toggle = document.getElementById('themeToggle');
  if (!toggle) return;
  const icons = toggle.querySelectorAll('.theme-icon');
  icons.forEach(icon => icon.classList.add('hidden'));
  const iconMap: Record<Theme, string> = {
    light: '.theme-icon-light',
    dark: '.theme-icon-dark',
    system: '.theme-icon-system'
  };
  const active = toggle.querySelector(iconMap[theme]);
  active?.classList.remove('hidden');
}

function initTheme() {
  const stored = getStoredTheme();
  applyTheme(stored);

  const toggle = document.getElementById('themeToggle');
  if (!toggle) return;

  const themes: Theme[] = ['light', 'dark', 'system'];
  let currentIndex = themes.indexOf(stored);

  const cycleTheme = () => {
    currentIndex = (currentIndex + 1) % themes.length;
    applyTheme(themes[currentIndex]);
  };

  toggle.addEventListener('click', cycleTheme);
  toggle.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      cycleTheme();
    }
  });

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (getStoredTheme() === 'system') {
      applyTheme('system');
    }
  });
}

interface ToolOption {
  id: string;
  type: 'checkbox' | 'select' | 'text' | 'password' | 'range';
  label: string;
  default?: string | boolean | number;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
}

interface ToolCtx {
  pdfLib: any;
  pdfjs: any;
  onProgress: (pct: number, text?: string) => void;
}

interface ToolConfig {
  id: string;
  name: string;
  icon: string;
  subtitle: string;
  accept: string;
  multiple: boolean;
  disabled?: boolean;
  options?: ToolOption[];
  execute?: (state: any, options: any, ctx: ToolCtx) => Promise<Uint8Array | Blob>;
  outputName?: (files: File[], config: ToolConfig, opts?: Record<string, any>) => string;
}

function parsePageRanges(input: string, pageCount: number): number[] {
  const trimmed = input.trim();
  if (!trimmed) throw new Error(`Please enter page range (1-${pageCount})`);
  const seen = new Set<number>();
  const pages: number[] = [];
  for (const part of trimmed.split(',')) {
    const token = part.trim();
    if (!token) continue;
    const match = token.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) throw new Error(`Invalid range "${token}". Use e.g. 1-3,5`);
    const a = Number(match[1]);
    const b = match[2] !== undefined ? Number(match[2]) : a;
    const start = Math.min(a, b);
    const end = Math.max(a, b);
    if (start < 1 || end > pageCount) throw new Error(`Range ${token} out of bounds (1-${pageCount})`);
    for (let i = start; i <= end; i++) {
      if (!seen.has(i)) {
        seen.add(i);
        pages.push(i);
      }
    }
  }
  if (!pages.length) throw new Error(`Please enter page range (1-${pageCount})`);
  return pages;
}

function fileMatchesAccept(file: File, accept: string): boolean {
  if (accept === 'application/pdf') {
    return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  }
  if (accept === 'image/*') {
    return file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|avif)$/i.test(file.name);
  }
  return true;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function sanitizeWinAnsi(text: string): string {
  return text.replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, ' ');
}

async function imageFileToPngBytes(file: File): Promise<ArrayBuffer> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  try {
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    ctx.drawImage(bitmap, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error(`Unsupported image: ${file.name}`))), 'image/png')
    );
    return await blob.arrayBuffer();
  } finally {
    bitmap.close();
    canvas.width = 0;
    canvas.height = 0;
  }
}

const categories = [
  {
    name: 'Popular Tools',
    tools: [
      {
        id: 'merge-pdf', name: 'Merge PDF', icon: 'merge', subtitle: 'Combine multiple PDFs',
        accept: 'application/pdf', multiple: true,
        outputName: (f: File[]) => `merged-${f[0]?.name?.replace(/\.pdf$/i,'') || 'output'}.pdf`,
        execute: async (s: any, _o: any, ctx: ToolCtx) => {
          const { PDFDocument } = ctx.pdfLib;
          const mergedDoc = await PDFDocument.create();
          for (let i = 0; i < s.files.length; i++) {
            const f = s.files[i];
            const doc = await PDFDocument.load(await f.arrayBuffer());
            const pages = await mergedDoc.copyPages(doc, doc.getPageIndices());
            pages.forEach((p: any) => mergedDoc.addPage(p));
            ctx.onProgress(((i + 1) / s.files.length) * 100);
          }
          return await mergedDoc.save();
        }
      },
      {
        id: 'split-pdf', name: 'Split PDF', icon: 'scissors', subtitle: 'Split PDF into parts',
        accept: 'application/pdf', multiple: false,
        options: [
          { id: 'mode', type: 'select', label: 'Split mode', default: 'all', options: [{value:'all',label:'Every page'}, {value:'range',label:'Page range'}, {value:'single',label:'Single page'}] },
          { id: 'range', type: 'text', label: 'Page range (e.g. 1-3,5)', default: '' },
        ],
        outputName: (f: File[], _c: ToolConfig, o?: Record<string, any>) => {
          const base = f[0]?.name?.replace(/\.pdf$/i, '') || 'output';
          return o?.mode === 'single' ? `page-${base}.pdf` : `split-${base}.zip`;
        },
        execute: async (s: any, o: any, ctx: ToolCtx) => {
          const { PDFDocument } = ctx.pdfLib;
          const doc = await PDFDocument.load(await s.files[0].arrayBuffer());
          const pageCount = doc.getPageCount();

          if (o.mode === 'single') {
            const raw = (o.range || '1').trim();
            if (!/^\d+$/.test(raw)) throw new Error(`Invalid page number "${o.range}".`);
            const p = Number(raw);
            if (p < 1 || p > pageCount) throw new Error(`Page ${p} out of range (1-${pageCount})`);
            const nd = await PDFDocument.create();
            const [cp] = await nd.copyPages(doc, [p - 1]);
            nd.addPage(cp);
            ctx.onProgress(100);
            return await nd.save();
          }

          const JSZip = (await import('jszip')).default;
          const zip = new JSZip();
          const pages = o.mode === 'range'
            ? parsePageRanges(o.range || '', pageCount)
            : Array.from({ length: pageCount }, (_, i) => i + 1);

          for (let i = 0; i < pages.length; i++) {
            const p = pages[i];
            const nd = await PDFDocument.create();
            const [cp] = await nd.copyPages(doc, [p - 1]);
            nd.addPage(cp);
            zip.file(`page-${p}.pdf`, await nd.save());
            ctx.onProgress(((i + 1) / pages.length) * 100);
          }
          return await zip.generateAsync({ type: 'uint8array' });
        }
      },
      {
        id: 'compress-pdf', name: 'Compress PDF', icon: 'zap', subtitle: 'Reduce PDF size',
        accept: 'application/pdf', multiple: false,
        options: [
          { id: 'quality', type: 'select', label: 'Quality', default: 'medium', options: [{value:'low',label:'Low (smallest)'},{value:'medium',label:'Medium'},{value:'high',label:'High (largest)'}] },
        ],
        outputName: (f: File[]) => `compressed-${f[0]?.name?.replace(/\.pdf$/i,'') || 'output'}.pdf`,
        execute: async (s: any, o: any, ctx: ToolCtx) => {
          const { PDFDocument } = ctx.pdfLib;
          const buf = await s.files[0].arrayBuffer();
          const doc = await PDFDocument.load(buf);
          const lossless = await doc.save({ useObjectStreams: true, objectsPerTick: 50 });
          if (o.quality === 'high') {
            ctx.onProgress(100);
            return lossless;
          }

          // shortcut: low/medium rasterize pages to JPEG; upgrade to image-XObject recompression or qpdf-wasm in P1
          const scale = o.quality === 'low' ? 100 / 72 : 150 / 72;
          const jpegQ = o.quality === 'low' ? 0.5 : 0.72;
          const outDoc = await PDFDocument.create();
          const src = await ctx.pdfjs.getDocument({ data: buf.slice(0) }).promise;
          try {
            for (let i = 1; i <= src.numPages; i++) {
              const page = await src.getPage(i);
              const vp1 = page.getViewport({ scale: 1 });
              const vp = page.getViewport({ scale });
              const canvas = document.createElement('canvas');
              canvas.width = Math.max(1, Math.round(vp.width));
              canvas.height = Math.max(1, Math.round(vp.height));
              await page.render({ canvasContext: canvas.getContext('2d')!, viewport: vp }).promise;
              const blob = await new Promise<Blob>((resolve, reject) =>
                canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Failed to encode compressed page'))), 'image/jpeg', jpegQ)
              );
              canvas.width = 0;
              canvas.height = 0;
              const jpg = await outDoc.embedJpg(await blob.arrayBuffer());
              const outPage = outDoc.addPage([vp1.width, vp1.height]);
              outPage.drawImage(jpg, { x: 0, y: 0, width: vp1.width, height: vp1.height });
              ctx.onProgress((i / src.numPages) * 100);
            }
          } finally {
            await src.destroy();
          }
          const rasterized = await outDoc.save({ useObjectStreams: true, objectsPerTick: 50 });
          return rasterized.byteLength < lossless.byteLength ? rasterized : lossless;
        }
      },
      {
        id: 'protect-pdf', name: 'Protect PDF', icon: 'lock', subtitle: 'Password protect PDF (unavailable)',
        accept: 'application/pdf', multiple: true,
        disabled: true,
        options: [
          { id: 'userPass', type: 'password', label: 'User password', default: '' },
          { id: 'ownerPass', type: 'password', label: 'Owner password (optional)', default: '' },
          { id: 'perms', type: 'checkbox', label: 'Allow printing', default: true },
          { id: 'perms2', type: 'checkbox', label: 'Allow copying', default: true },
        ],
        outputName: (f: File[]) => `protected-${f[0]?.name?.replace(/\.pdf$/i,'') || 'output'}.pdf`,
        execute: async () => { throw new Error('Protect PDF not supported: pdf-lib encryption unavailable'); }
      },
      {
        id: 'unlock-pdf', name: 'Unlock PDF', icon: 'unlock', subtitle: 'Remove password (unavailable)',
        accept: 'application/pdf', multiple: false,
        disabled: true,
        options: [
          { id: 'password', type: 'password', label: 'Password', default: '' },
        ],
        outputName: (f: File[]) => `unlocked-${f[0]?.name?.replace(/\.pdf$/i,'') || 'output'}.pdf`,
        execute: async () => { throw new Error('Unlock PDF not supported yet: pdf-lib cannot decrypt encrypted PDFs'); }
      },
      {
        id: 'rotate-pdf', name: 'Rotate PDF', icon: 'rotate-cw', subtitle: 'Rotate pages',
        accept: 'application/pdf', multiple: false,
        options: [
          { id: 'angle', type: 'select', label: 'Rotation', default: '90', options: [{value:'90',label:'90° CW'},{value:'180',label:'180°'},{value:'270',label:'90° CCW'}] },
          { id: 'pages', type: 'select', label: 'Apply to', default: 'all', options: [{value:'all',label:'All pages'},{value:'current',label:'Current page'},{value:'even',label:'Even pages'},{value:'odd',label:'Odd pages'}] },
        ],
        outputName: (f: File[]) => `rotated-${f[0]?.name?.replace(/\.pdf$/i,'') || 'output'}.pdf`,
        execute: async (s: any, o: any, ctx: ToolCtx) => {
          const { PDFDocument, degrees } = ctx.pdfLib;
          const angle = parseInt(o.angle, 10);
          const doc = await PDFDocument.load(await s.files[0].arrayBuffer());
          const pageCount = doc.getPageCount();

          let pageIndices: number[] = [];
          if (o.pages === 'all') pageIndices = Array.from({length: pageCount}, (_,i) => i);
          else if (o.pages === 'current') pageIndices = [Math.min(s.currentPage || 1, pageCount) - 1];
          else if (o.pages === 'even') pageIndices = Array.from({length: pageCount}, (_,i) => i).filter(i => (i+1) % 2 === 0);
          else if (o.pages === 'odd') pageIndices = Array.from({length: pageCount}, (_,i) => i).filter(i => (i+1) % 2 === 1);

          for (const i of pageIndices) {
            const page = doc.getPages()[i];
            const currentRotation = page.getRotation().angle;
            page.setRotation(degrees((currentRotation + angle) % 360));
          }
          ctx.onProgress(100);
          return await doc.save();
        }
      },
      {
        id: 'sign-pdf', name: 'Sign PDF', icon: 'pen-tool', subtitle: 'Add signature',
        accept: 'application/pdf', multiple: false,
        options: [
          { id: 'text', type: 'text', label: 'Signature text', default: '' },
          { id: 'font', type: 'select', label: 'Font', default: 'Helvetica', options: [{value:'Helvetica',label:'Helvetica'},{value:'Courier',label:'Courier'},{value:'TimesRoman',label:'Times'}] },
          { id: 'page', type: 'range', label: 'Page', default: 1, min: 1, max: 1 },
        ],
        outputName: (f: File[]) => `signed-${f[0]?.name?.replace(/\.pdf$/i,'') || 'output'}.pdf`,
        execute: async (s: any, o: any, ctx: ToolCtx) => {
          const text = sanitizeWinAnsi((o.text || '').trim());
          if (!text) throw new Error('Please enter signature text');
          const { PDFDocument, StandardFonts, rgb } = ctx.pdfLib;
          const doc = await PDFDocument.load(await s.files[0].arrayBuffer());
          const pageNum = Math.max(0, Math.min(Number(o.page) || 1, doc.getPageCount()) - 1);
          const page = doc.getPages()[pageNum];
          const fontKey = StandardFonts[o.font as keyof typeof StandardFonts] ?? StandardFonts.Helvetica;
          const font = await doc.embedFont(fontKey);
          page.drawText(text, { x: 50, y: 50, size: 24, font, color: rgb(0, 0, 0) });
          ctx.onProgress(100);
          return await doc.save();
        }
      },
      {
        id: 'ocr-pdf', name: 'OCR PDF', icon: 'scan', subtitle: 'Make searchable',
        accept: 'application/pdf', multiple: false,
        options: [
          { id: 'lang', type: 'select', label: 'Language', default: 'eng', options: [{value:'eng',label:'English'},{value:'ind',label:'Indonesian'},{value:'fra',label:'French'},{value:'deu',label:'German'},{value:'spa',label:'Spanish'}] },
        ],
        outputName: (f: File[]) => `ocr-${f[0]?.name?.replace(/\.pdf$/i,'') || 'output'}.pdf`,
        execute: async (s: any, o: any, ctx: ToolCtx) => {
          const { createWorker } = await import('tesseract.js');
          const { PDFDocument, StandardFonts, rgb } = ctx.pdfLib;
          const buf = await s.files[0].arrayBuffer();
          const doc = await PDFDocument.load(buf);
          const font = await doc.embedFont(StandardFonts.Helvetica);
          const src = await ctx.pdfjs.getDocument({ data: buf.slice(0) }).promise;
          const worker = await createWorker(o.lang);
          try {
            const total = doc.getPageCount();
            for (let i = 0; i < total; i++) {
              const page = await src.getPage(i + 1);
              const vp = page.getViewport({ scale: 2 });
              const canvas = document.createElement('canvas');
              canvas.width = vp.width;
              canvas.height = vp.height;
              await page.render({ canvasContext: canvas.getContext('2d')!, viewport: vp }).promise;
              const { data: { text } } = await worker.recognize(canvas);
              canvas.width = 0;
              canvas.height = 0;
              const cleaned = sanitizeWinAnsi(text.trim());
              if (cleaned) {
                const p = doc.getPages()[i];
                // shortcut: invisible block at page origin; upgrade to word bbox positioning in P1
                p.drawText(cleaned.slice(0, 3000), { x: 20, y: 20, size: 8, font, color: rgb(0, 0, 0), opacity: 0, lineHeight: 10, maxWidth: p.getWidth() - 40 });
              }
              ctx.onProgress(((i + 1) / total) * 100);
            }
          } finally {
            await worker.terminate();
            await src.destroy();
          }
          return await doc.save();
        }
      },
      {
        id: 'image-to-pdf', name: 'Images to PDF', icon: 'image', subtitle: 'Convert images',
        accept: 'image/*', multiple: true,
        options: [
          { id: 'pageSize', type: 'select', label: 'Page size', default: 'auto', options: [{value:'auto',label:'Auto (fit image)'},{value:'a4',label:'A4'},{value:'letter',label:'Letter'}] },
          { id: 'margin', type: 'range', label: 'Margin', default: 0, min: 0, max: 50, step: 5 },
        ],
        outputName: () => `images-to-pdf.pdf`,
        execute: async (s: any, o: any, ctx: ToolCtx) => {
          const { PDFDocument } = ctx.pdfLib;
          const doc = await PDFDocument.create();
          const margin = Math.max(0, Number(o.margin) || 0);
          const pageSizes: Record<string, [number, number]> = {
            a4: [595.28, 841.89],
            letter: [612, 792],
          };

          for (let i = 0; i < s.files.length; i++) {
            const f = s.files[i];
            const buf = await f.arrayBuffer();
            let img;
            try { img = await doc.embedPng(buf); }
            catch {
              try { img = await doc.embedJpg(buf); }
              catch { img = await doc.embedPng(await imageFileToPngBytes(f)); }
            }
            const fixed = pageSizes[o.pageSize];
            if (!fixed) {
              const page = doc.addPage([img.width + margin * 2, img.height + margin * 2]);
              page.drawImage(img, { x: margin, y: margin, width: img.width, height: img.height });
            } else {
              const [pw, ph] = fixed;
              const page = doc.addPage([pw, ph]);
              const availW = Math.max(1, pw - margin * 2);
              const availH = Math.max(1, ph - margin * 2);
              const scale = Math.min(availW / img.width, availH / img.height);
              const w = img.width * scale;
              const h = img.height * scale;
              page.drawImage(img, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
            }
            ctx.onProgress(((i + 1) / s.files.length) * 100);
          }
          return await doc.save();
        }
      },
      {
        id: 'pdf-to-images', name: 'PDF to Images', icon: 'image-plus', subtitle: 'Extract images',
        accept: 'application/pdf', multiple: true,
        options: [
          { id: 'format', type: 'select', label: 'Format', default: 'png', options: [{value:'png',label:'PNG'},{value:'jpeg',label:'JPEG'},{value:'webp',label:'WebP'}] },
          { id: 'dpi', type: 'select', label: 'DPI', default: '150', options: [{value:'72',label:'72'},{value:'150',label:'150'},{value:'300',label:'300'}] },
        ],
        outputName: () => `pdf-to-images.zip`,
        execute: async (s: any, o: any, ctx: ToolCtx) => {
          const JSZip = (await import('jszip')).default;
          const zip = new JSZip();
          const scale = parseInt(o.dpi, 10) / 72;

          for (let fi = 0; fi < s.files.length; fi++) {
            const f = s.files[fi];
            const doc = await ctx.pdfjs.getDocument({ data: await f.arrayBuffer() }).promise;
            try {
              for (let i = 1; i <= doc.numPages; i++) {
                const page = await doc.getPage(i);
                const vp = page.getViewport({ scale });
                const canvas = document.createElement('canvas');
                canvas.width = vp.width;
                canvas.height = vp.height;
                await page.render({ canvasContext: canvas.getContext('2d')!, viewport: vp }).promise;

                const blob = await new Promise<Blob>((resolve, reject) =>
                  canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Failed to encode image'))), `image/${o.format}`, o.format === 'jpeg' ? 0.9 : 1)
                );
                canvas.width = 0;
                canvas.height = 0;
                zip.file(`${f.name.replace(/\.pdf$/i, '')}-page-${i}.${o.format}`, blob);
                ctx.onProgress(((fi + i / doc.numPages) / s.files.length) * 100);
                await new Promise(r => setTimeout(r, 0));
              }
            } finally {
              await doc.destroy();
            }
          }
          return await zip.generateAsync({ type: 'uint8array', compression: 'STORE' });
        }
      },
    ]
  }
] as const;

const allTools = categories.flatMap(c => c.tools) as ToolConfig[];

function getToolConfig(id: string): ToolConfig | undefined {
  return allTools.find(t => t.id === id);
}

interface ToolState {
  files: File[];
  pdfDoc: any;
  pageCount: number;
  currentPage: number;
  thumbUrls: string[];
  [key: string]: any;
}

interface ToolCallbacks {
  onProcessComplete?: (result: Uint8Array | Blob, filename: string) => void;
}

function download(data: Uint8Array | Blob, name: string, mime = 'application/octet-stream') {
  const blob = data instanceof Uint8Array ? new Blob([data as BlobPart], { type: mime }) : data;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

class ToolRunner {
  config: ToolConfig;
  state: ToolState;
  callbacks: ToolCallbacks;
  container: HTMLElement;
  pdfLib: any = null;
  pdfjs: any = null;
  previewObserver: IntersectionObserver | null = null;
  previewRenderGen = 0;
  onKeyDown: ((e: KeyboardEvent) => void) | null = null;

  constructor(config: ToolConfig, container: HTMLElement, callbacks: ToolCallbacks = {}) {
    this.config = config; this.container = container; this.callbacks = callbacks;
    this.state = { files: [], pdfDoc: null, pageCount: 0, currentPage: 1, thumbUrls: [] };
  }

  async init() { this.render(); this.bindEvents(); await this.loadDeps(); }

  async loadDeps() {
    await import('./pdf-shim.js');
    this.pdfLib = await import('pdf-lib');
    this.pdfjs = await import('pdfjs-dist');
    const { default: workerUrl } = await import('./pdf-worker?worker&url');
    this.pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  }

  render() {
    this.container.innerHTML = this.getTemplate();
    this.container.querySelectorAll('[data-i18n]').forEach(el => { const k = el.getAttribute('data-i18n'); if (k) el.textContent = t(k); });
    renderIcons();
  }

  getTemplate() {
    return `
      <div class="tool-container" data-tool="${this.config.id}">
        <div class="tool-header"><button class="back-btn" aria-label="${t('back')}" title="${t('back')}"><i data-lucide="arrow-left"></i></button><div class="tool-title"><i data-lucide="${this.config.icon}"></i><h1 data-i18n="tools:${this.config.id}.name">${this.config.name}</h1></div></div>
        <p class="tool-subtitle" data-i18n="tools:${this.config.id}.subtitle">${this.config.subtitle}</p>
        <div class="upload-section" id="uploadSection"><div class="drop-zone" id="dropZone"><input type="file" id="fileInput" accept="${this.config.accept}" ${this.config.multiple ? 'multiple' : ''} hidden><i data-lucide="upload" class="drop-icon"></i><p data-i18n="dropFilesHere">${t('dropFilesHere')}</p><p class="file-types">${this.config.accept}</p><button type="button" class="btn btn-primary browse-btn" data-i18n="browseFiles">${t('browseFiles')}</button></div></div>
        <div class="files-section hidden" id="filesSection"><div class="files-list" id="filesList"></div><div class="file-actions"><button type="button" class="btn btn-secondary clear-btn" data-i18n="clearFiles">${t('clearFiles')}</button><button type="button" class="btn btn-primary process-btn" id="processBtn" disabled data-i18n="tools:${this.config.id}.processBtn">${t('process')}</button></div></div>
        <div class="options-section hidden" id="optionsSection"></div>
        <div class="preview-section hidden" id="previewSection"></div>
        <div class="loader-modal hidden" id="loaderModal" role="dialog" aria-live="polite"><div class="loader-content"><div class="spinner"></div><p id="loaderText" data-i18n="processing">${t('processing')}</p><progress id="loaderProgress" class="loader-progress" value="0" max="100"></progress></div></div>
        <div class="alert-modal hidden" id="alertModal" role="alertdialog"><div class="alert-content"><p id="alertText"></p><button type="button" class="btn btn-primary alert-ok" data-i18n="ok">${t('ok')}</button></div></div>
      </div>`;
  }

  bindEvents() {
    const us = this.container.querySelector('#uploadSection');
    const dz = this.container.querySelector('#dropZone');
    const fi = this.container.querySelector('#fileInput') as HTMLInputElement;
    const bb = this.container.querySelector('.browse-btn');
    const cb = this.container.querySelector('.clear-btn');
    const pb = this.container.querySelector('#processBtn');
    const bkb = this.container.querySelector('.back-btn');
    const am = this.container.querySelector('#alertModal');

    dz?.addEventListener('dragover', e => { e.preventDefault(); us?.classList.add('drag-over'); });
    dz?.addEventListener('dragleave', () => us?.classList.remove('drag-over'));
    dz?.addEventListener('drop', (e: Event) => { const de = e as DragEvent; de.preventDefault(); us?.classList.remove('drag-over'); this.handleFiles(de.dataTransfer?.files ?? null); });
    bb?.addEventListener('click', () => fi?.click());
    fi?.addEventListener('change', async e => { const input = e.target as HTMLInputElement; await this.handleFiles(input.files); input.value = ''; });
    cb?.addEventListener('click', () => this.reset());
    pb?.addEventListener('click', () => this.process());
    bkb?.addEventListener('click', () => window.history.back());

    am?.querySelector('.alert-ok')?.addEventListener('click', () => am.classList.add('hidden'));
    am?.addEventListener('click', e => { if (e.target === am) am.classList.add('hidden'); });
    if (this.onKeyDown) window.removeEventListener('keydown', this.onKeyDown);
    this.onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') am?.classList.add('hidden');
    };
    window.addEventListener('keydown', this.onKeyDown);
  }

  async handleFiles(files: FileList | null) {
    if (!files?.length) return;
    const fa = Array.from(files);
    const valid = fa.filter(f => fileMatchesAccept(f, this.config.accept));
    if (!valid.length) {
      this.showAlert(`Unsupported file type. Expected: ${this.config.accept}`);
      return;
    }
    if (valid.length < fa.length) {
      this.showAlert(`Skipped ${fa.length - valid.length} unsupported file(s). Expected: ${this.config.accept}`);
    }
    const prevFirst = this.state.files[0];
    this.state.files = this.config.multiple ? [...this.state.files, ...valid] : [valid[0]];
    this.updateFileDisplay();
    this.show('filesSection');
    if (!this.container.querySelector('#optionsSection .options-grid')) {
      this.renderOptions();
    }
    if (this.state.files[0] !== prevFirst || !this.state.pdfDoc) {
      await this.loadFirstPdf();
    }
  }

  async loadFirstPdf() {
    if (!this.state.files.length || !this.config.accept.includes('pdf')) return;
    this.cleanupPdfDoc();
    try {
      const ab = await this.state.files[0].arrayBuffer();
      const doc = await this.pdfjs.getDocument({ data: ab }).promise;
      this.state.pdfDoc = doc;
      this.state.pageCount = doc.numPages;
      this.state.currentPage = 1;
      this.updatePageOptionBounds();
      await this.renderPreview();
    } catch (e: any) {
      console.error('[MoonlightPDF] preview failed:', e);
      this.showAlert(e?.name === 'PasswordException' ? 'This PDF is password-protected.' : t('pdfLoadError'));
    }
  }

  updateFileDisplay() {
    const list = this.container.querySelector('#filesList');
    if (!list) return;
    this.state.thumbUrls.forEach(URL.revokeObjectURL);
    this.state.thumbUrls = [];

    const isImageTool = this.config.id === 'image-to-pdf';

    if (isImageTool) {
      list.innerHTML = this.state.files.map((f, i) => `
        <div class="file-item sortable-item" data-index="${i}">
          <div class="sort-handle" aria-hidden="true">⠿</div>
          <div class="file-info">
            <div class="img-thumb-wrap"><img class="img-thumb" src="${this.state.thumbUrls[i] = URL.createObjectURL(f)}" alt="${escapeHtml(f.name)}"></div>
            <div class="file-details">
              <div class="file-name">${escapeHtml(f.name)}</div>
              <div class="file-size">${this.fmt(f.size)}</div>
            </div>
          </div>
          <div class="sort-controls">
            <button type="button" class="sort-btn move-up" data-index="${i}" aria-label="Move up" ${i === 0 ? 'disabled' : ''}>↑</button>
            <span class="sort-num">${i + 1}</span>
            <button type="button" class="sort-btn move-down" data-index="${i}" aria-label="Move down" ${i === this.state.files.length - 1 ? 'disabled' : ''}>↓</button>
          </div>
          <button type="button" class="remove-file" data-index="${i}" aria-label="${t('removeFile')}"><i data-lucide="x"></i></button>
        </div>`).join('');
      this.bindSortEvents(list as HTMLElement);
    } else {
      list.innerHTML = this.state.files.map((f, i) => `
        <div class="file-item" data-index="${i}">
          <div class="file-info">
            <div class="file-icon"><i data-lucide="file-text"></i></div>
            <div class="file-details"><div class="file-name">${escapeHtml(f.name)}</div><div class="file-size">${this.fmt(f.size)}</div></div>
          </div>
          <button type="button" class="remove-file" data-index="${i}" aria-label="${t('removeFile')}"><i data-lucide="x"></i></button>
        </div>`).join('');
    }

    list.querySelectorAll('.remove-file').forEach(btn => btn.addEventListener('click', e => {
      const idx = parseInt((e.currentTarget as HTMLElement).dataset.index!, 10);
      this.removeFileWithAnimation(list as HTMLElement, idx);
    }));

    const pb = this.container.querySelector('#processBtn') as HTMLButtonElement | null;
    if (pb) pb.disabled = this.state.files.length === 0;
    renderIcons();
  }

  removeFileWithAnimation(list: HTMLElement, idx: number) {
    const item = list.querySelector(`.file-item[data-index="${idx}"]`) as HTMLElement | null;
    if (!item || item.dataset.removing) return;
    item.dataset.removing = '1';

    const target = this.state.files[idx];
    const wasFirst = idx === 0;

    item.style.transition = 'transform 0.2s ease, opacity 0.2s ease';
    item.style.transform = 'translateX(-100%)';
    item.style.opacity = '0';

    setTimeout(() => {
      const realIdx = this.state.files.indexOf(target);
      if (realIdx !== -1) this.state.files.splice(realIdx, 1);
      this.updateFileDisplay();
      if (!this.state.files.length) {
        this.cleanupPdfDoc();
        this.hide('filesSection');
        this.hide('optionsSection');
        this.hide('previewSection');
      } else if (wasFirst && this.config.accept.includes('pdf')) {
        this.loadFirstPdf();
      }
    }, 200);
  }

  bindSortEvents(list: HTMLElement) {
    let activeDragIdx = -1;
    let currentOverIdx = -1;
    let startY = 0;
    let draggedElement: HTMLElement | null = null;
    let placeholder: HTMLElement | null = null;
    let animFrame: number | null = null;
    let pendingDeltaY = 0;

    const items = () => Array.from(list.querySelectorAll('.sortable-item')) as HTMLElement[];

    const onPointerDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('button')) return;

      const item = (e.target as HTMLElement).closest('.sortable-item') as HTMLElement;
      if (!item) return;

      e.preventDefault();
      activeDragIdx = parseInt(item.dataset.index!);
      currentOverIdx = activeDragIdx;
      draggedElement = item;

      const rect = item.getBoundingClientRect();
      startY = e.clientY;

      // Set up dragging visuals - use transform for GPU acceleration
      item.classList.add('is-dragging');
      item.style.width = `${rect.width}px`;
      item.style.position = 'fixed';
      item.style.top = `${rect.top}px`;
      item.style.left = `${rect.left}px`;
      item.style.zIndex = '1000';
      item.style.transform = 'translateY(0)';
      item.setPointerCapture(e.pointerId);

      // Create a visual placeholder
      placeholder = document.createElement('div');
      placeholder.className = 'sortable-placeholder';
      placeholder.style.height = `${rect.height}px`;
      item.parentNode?.insertBefore(placeholder, item);

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);

      // Start animation loop
      animateDrag();
    };

    const animateDrag = () => {
      if (!draggedElement || activeDragIdx === -1) return;
      
      draggedElement.style.transform = `translateY(${pendingDeltaY}px)`;
      animFrame = requestAnimationFrame(animateDrag);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!draggedElement || activeDragIdx === -1) return;
      
      // Just update the pending delta, actual transform applied in rAF
      pendingDeltaY = e.clientY - startY;

      // Find the element currently hovered over based on vertical position
      const allItems = items().filter(el => el !== draggedElement);
      const cursorY = e.clientY;

      let targetIdx = activeDragIdx;

      for (let i = 0; i < allItems.length; i++) {
        const other = allItems[i];
        const rect = other.getBoundingClientRect();
        const middleY = rect.top + rect.height / 2;

        if (cursorY < middleY) {
          targetIdx = parseInt(other.dataset.index!);
          if (targetIdx > activeDragIdx) targetIdx--;
          break;
        } else if (i === allItems.length - 1) {
          targetIdx = parseInt(other.dataset.index!);
          if (targetIdx < activeDragIdx) targetIdx++;
        }
      }

      targetIdx = Math.max(0, Math.min(this.state.files.length - 1, targetIdx));

      if (targetIdx !== currentOverIdx) {
        currentOverIdx = targetIdx;

        // Shift placeholder to target position
        const currentItems = items().filter(el => el !== draggedElement);
        if (placeholder && placeholder.parentNode) {
          if (currentOverIdx >= currentItems.length) {
            list.appendChild(placeholder);
          } else {
            const targetEl = currentItems.find(el => parseInt(el.dataset.index!) === (currentOverIdx >= activeDragIdx ? currentOverIdx + 1 : currentOverIdx));
            if (targetEl) {
              list.insertBefore(placeholder, targetEl);
            } else {
              list.appendChild(placeholder);
            }
          }
        }
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);

      if (animFrame) {
        cancelAnimationFrame(animFrame);
        animFrame = null;
      }

      if (!draggedElement || activeDragIdx === -1) return;

      try {
        draggedElement.releasePointerCapture(e.pointerId);
      } catch {}

      const from = activeDragIdx;
      const to = currentOverIdx;

      // Clean up placeholder & dragging styles
      if (placeholder && placeholder.parentNode) {
        placeholder.parentNode.removeChild(placeholder);
        placeholder = null;
      }

      draggedElement.classList.remove('is-dragging');
      draggedElement.style.position = '';
      draggedElement.style.top = '';
      draggedElement.style.left = '';
      draggedElement.style.width = '';
      draggedElement.style.zIndex = '';
      draggedElement.style.transform = '';
      draggedElement = null;
      activeDragIdx = -1;
      currentOverIdx = -1;
      pendingDeltaY = 0;

      // Reorder data array
      if (from !== to && to >= 0 && to < this.state.files.length) {
        const moved = this.state.files.splice(from, 1)[0];
        this.state.files.splice(to, 0, moved);
      }

      this.updateFileDisplay();
    };

    list.querySelectorAll('.sortable-item').forEach(item => {
      (item as HTMLElement).addEventListener('pointerdown', onPointerDown);
    });

    list.querySelectorAll('.move-up').forEach(btn => btn.addEventListener('click', e => {
      const idx = parseInt((e.currentTarget as HTMLElement).dataset.index!);
      if (idx === 0) return;
      const moved = this.state.files.splice(idx, 1)[0];
      this.state.files.splice(idx - 1, 0, moved);
      this.updateFileDisplay();
    }));

    list.querySelectorAll('.move-down').forEach(btn => btn.addEventListener('click', e => {
      const idx = parseInt((e.currentTarget as HTMLElement).dataset.index!);
      if (idx >= this.state.files.length - 1) return;
      const moved = this.state.files.splice(idx, 1)[0];
      this.state.files.splice(idx + 1, 0, moved);
      this.updateFileDisplay();
    }));
  }

  async renderPreview() {
    const s = this.container.querySelector('#previewSection');
    const doc = this.state.pdfDoc;
    if (!s || !doc) return;

    this.previewObserver?.disconnect();
    const gen = ++this.previewRenderGen;
    s.innerHTML = '<div class="page-thumbnails" id="pageThumbnails"></div>';
    this.show('previewSection');

    const grid = s.querySelector('#pageThumbnails')!;
    grid.innerHTML = Array.from({ length: this.state.pageCount }, (_, i) => {
      const p = i + 1;
      return `<div class="page-thumbnail${p === this.state.currentPage ? ' active' : ''}" data-page="${p}" role="button" tabindex="0" aria-label="Page ${p}"></div>`;
    }).join('');

    const selectPage = (p: number) => {
      this.state.currentPage = p;
      grid.querySelectorAll('.page-thumbnail').forEach(el => {
        el.classList.toggle('active', Number((el as HTMLElement).dataset.page) === p);
      });
      const pageInput = this.container.querySelector('#opt-page') as HTMLInputElement | null;
      if (pageInput) {
        pageInput.value = String(p);
        const out = pageInput.parentElement?.querySelector('output');
        if (out) out.textContent = String(p);
      }
    };

    grid.querySelectorAll('.page-thumbnail').forEach(slot => {
      const p = Number((slot as HTMLElement).dataset.page);
      slot.addEventListener('click', () => selectPage(p));
      slot.addEventListener('keydown', (e: Event) => {
        const ke = e as KeyboardEvent;
        if (ke.key === 'Enter' || ke.key === ' ') {
          ke.preventDefault();
          selectPage(p);
        }
      });
    });

    this.previewObserver = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const slot = entry.target as HTMLElement;
        this.previewObserver?.unobserve(slot);
        if (gen !== this.previewRenderGen) continue;
        const pageNum = Number(slot.dataset.page);
        doc.getPage(pageNum).then(async (page: any) => {
          if (gen !== this.previewRenderGen) return;
          const viewport = page.getViewport({ scale: 0.6 });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d');
          if (ctx) await page.render({ canvasContext: ctx, viewport }).promise;
          if (gen !== this.previewRenderGen) return;
          slot.appendChild(canvas);
        }).catch(() => {});
      }
    }, { rootMargin: '200px' });

    grid.querySelectorAll('.page-thumbnail').forEach(slot => this.previewObserver?.observe(slot));
  }

  renderOptions() {
    const s = this.container.querySelector('#optionsSection');
    if (!s || !this.config.options?.length) return;
    s.innerHTML = `<h3 data-i18n="options">${t('options')}</h3><div class="options-grid">${this.config.options.map(o => this.renderOpt(o)).join('')}</div>`;
    s.querySelectorAll('.option-range input[type="range"]').forEach(input => {
      input.addEventListener('input', () => {
        const el = input as HTMLInputElement;
        const out = el.parentElement?.querySelector('output');
        if (out) out.textContent = el.value;
      });
    });
    this.show('optionsSection');
    this.updatePageOptionBounds();
  }

  updatePageOptionBounds() {
    const pageInput = this.container.querySelector('#opt-page') as HTMLInputElement | null;
    if (!pageInput) return;
    const max = Math.max(1, this.state.pageCount);
    pageInput.max = String(max);
    const val = Math.max(1, Math.min(Number(pageInput.value) || 1, max));
    pageInput.value = String(val);
    const out = pageInput.parentElement?.querySelector('output');
    if (out) out.textContent = String(val);
  }

  renderOpt(o: ToolOption) {
    const id = `opt-${o.id}`;
    const key = `tools:${this.config.id}.options.${o.id}`;
    switch (o.type) {
      case 'checkbox': return `<label class="option-checkbox"><input type="checkbox" id="${id}" ${o.default ? 'checked' : ''}><span data-i18n="${key}">${o.label}</span></label>`;
      case 'select': return `<label class="option-select"><span data-i18n="${key}">${o.label}</span><select id="${id}">${o.options?.map(x => `<option value="${x.value}" ${x.value === o.default ? 'selected' : ''}>${x.label}</option>`).join('')}</select></label>`;
      case 'range': return `<label class="option-range"><span data-i18n="${key}">${o.label}</span><input type="range" id="${id}" min="${o.min}" max="${o.max}" step="${o.step||1}" value="${o.default}"><output>${o.default}</output></label>`;
      case 'password': return `<label class="option-password"><span data-i18n="${key}">${o.label}</span><input type="password" id="${id}" value="${o.default||''}"></label>`;
      default: return `<label class="option-text"><span data-i18n="${key}">${o.label}</span><input type="text" id="${id}" value="${o.default||''}"></label>`;
    }
  }

  getOpts() { const r: Record<string, any> = {}; this.config.options?.forEach(o => { const e = this.container.querySelector(`#opt-${o.id}`) as HTMLInputElement|HTMLSelectElement; if (e) r[o.id] = e.type === 'checkbox' ? e.checked : e.value; }); return r; }

  async process() {
    this.showLoader(t('processing'));
    try {
      const opts = this.getOpts();
      const r = await this.execute(opts);
      this.callbacks.onProcessComplete?.(r, this.outName(opts));
    } catch (e) {
      console.error('[MoonlightPDF] process failed:', e);
      this.showAlert(e instanceof Error ? e.message : String(e));
    } finally {
      this.hideLoader();
    }
  }

  async execute(opts = this.getOpts()): Promise<Uint8Array | Blob> {
    if (!this.config.execute) throw new Error('No execute function');
    const ctx: ToolCtx = {
      pdfLib: this.pdfLib,
      pdfjs: this.pdfjs,
      onProgress: (pct: number, text?: string) => this.updateProgress(pct, text),
    };
    return await this.config.execute(this.state, opts, ctx);
  }

  outName(opts = this.getOpts()) {
    if (this.config.outputName) return this.config.outputName(this.state.files, this.config, opts);
    const b = this.state.files[0]?.name.replace(/\.pdf$/i, '') || 'output';
    return `${b}-${this.config.id}.pdf`;
  }

  showLoader(txt: string) {
    const m = this.container.querySelector('#loaderModal');
    const tEl = this.container.querySelector('#loaderText');
    const pEl = this.container.querySelector('#loaderProgress') as HTMLProgressElement | null;
    if (pEl) pEl.value = 0;
    if (m && tEl) { tEl.textContent = txt; m.classList.remove('hidden'); }
  }
  updateProgress(pct: number, txt?: string) {
    const pEl = this.container.querySelector('#loaderProgress') as HTMLProgressElement | null;
    if (pEl) pEl.value = Math.max(0, Math.min(100, pct));
    if (txt) {
      const tEl = this.container.querySelector('#loaderText');
      if (tEl) tEl.textContent = txt;
    }
  }
  hideLoader() { this.container.querySelector('#loaderModal')?.classList.add('hidden'); }
  showAlert(msg: string) { const m = this.container.querySelector('#alertModal'), tEl = this.container.querySelector('#alertText'); if (m && tEl) { tEl.textContent = msg; m.classList.remove('hidden'); } }
  show(id: string) { this.container.querySelector(`#${id}`)?.classList.remove('hidden'); }
  hide(id: string) { this.container.querySelector(`#${id}`)?.classList.add('hidden'); }
  fmt(b: number) { if (b === 0) return '0 B'; const k = 1024, s = ['B','KB','MB','GB']; const i = Math.floor(Math.log(b)/Math.log(k)); return parseFloat((b/Math.pow(k,i)).toFixed(2)) + ' ' + s[i]; }

  cleanupPdfDoc() {
    this.previewObserver?.disconnect();
    this.previewObserver = null;
    this.previewRenderGen++;
    if (this.state.pdfDoc) {
      try { this.state.pdfDoc.destroy?.(); } catch {}
      this.state.pdfDoc = null;
    }
    this.state.pageCount = 0;
  }

  cleanupResources() {
    this.cleanupPdfDoc();
    this.state.thumbUrls.forEach(URL.revokeObjectURL);
    this.state.thumbUrls = [];
    if (this.onKeyDown) {
      window.removeEventListener('keydown', this.onKeyDown);
      this.onKeyDown = null;
    }
  }

  reset() {
    this.cleanupResources();
    this.state = { files: [], pdfDoc: null, pageCount: 0, currentPage: 1, thumbUrls: [] };
    this.render();
    this.bindEvents();
  }
  destroy() {
    this.cleanupResources();
    this.container.innerHTML = '';
  }
}

let currentRunner: ToolRunner | null = null;

async function renderTool(config: ToolConfig) {
  const container = document.getElementById('app');
  if (!container) return;
  if (currentRunner) { currentRunner.destroy(); currentRunner = null; }
  currentRunner = new ToolRunner(config, container, {
    onProcessComplete: (result, filename) => download(result, filename),
  });
  await currentRunner.init();
}

async function renderHomepage() {
  const container = document.getElementById('app');
  if (!container) return;
  if (currentRunner) { currentRunner.destroy(); currentRunner = null; }
  container.innerHTML = `
    <div class="homepage">
      <h1 class="homepage-title" data-i18n="homepage.title">MoonlightPDF</h1>
      <p class="homepage-subtitle" data-i18n="homepage.subtitle">Privacy-first PDF toolkit that runs entirely in your browser</p>
      ${categories.map(category => `
        <section class="category-section">
          <h2 class="category-title">${category.name}</h2>
          <div class="tool-grid">
            ${category.tools.map(tool => `
              <a href="#/${tool.id}" class="tool-card${'disabled' in tool && tool.disabled ? ' is-disabled' : ''}" data-tool-id="${tool.id}" ${'disabled' in tool && tool.disabled ? 'aria-disabled="true" tabindex="-1"' : ''}>
                <div class="tool-card-icon"><i data-lucide="${tool.icon}"></i></div>
                <div class="tool-card-content">
                  <span class="tool-name" data-i18n="tools:${tool.id}.name">${tool.name}</span>
                  <span class="tool-subtitle" data-i18n="tools:${tool.id}.subtitle">${tool.subtitle}</span>
                </div>
              </a>
            `).join('')}
          </div>
        </section>
      `).join('')}
    </div>
  `;
  container.querySelectorAll('[data-i18n]').forEach(el => { const key = el.getAttribute('data-i18n'); if (key) el.textContent = t(key); });
  renderIcons();
}

async function handleRoute() {
  const hash = window.location.hash.slice(1) || '/';
  const toolMatch = hash.match(/^\/([a-z0-9-]+)$/);
  if (toolMatch) {
    const config = getToolConfig(toolMatch[1]);
    if (config && !config.disabled) { await renderTool(config); return; }
  }
  await renderHomepage();
}

async function init() {
  await initI18n();
  applyTranslations();
  renderIcons();
  initTheme();

  window.addEventListener('hashchange', handleRoute);
  await handleRoute();
  console.log('MoonlightPDF ready');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { void init(); });
} else {
  void init();
}