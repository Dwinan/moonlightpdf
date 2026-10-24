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
  type: 'checkbox' | 'select' | 'text' | 'range';
  label: string;
  default?: string | boolean | number;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
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
  execute?: (state: any, options: any, ctx: { pdfLib: any; pdfjs: any }) => Promise<Uint8Array | Blob>;
  outputName?: (files: File[], config: ToolConfig) => string;
}

const categories = [
  {
    name: 'Popular Tools',
    tools: [
      {
        id: 'merge-pdf', name: 'Merge PDF', icon: 'merge', subtitle: 'Combine multiple PDFs',
        accept: 'application/pdf', multiple: true,
        outputName: (f: File[]) => `merged-${f[0]?.name?.replace(/\.pdf$/i,'') || 'output'}.pdf`,
        execute: async (s: any, o: any, ctx: any) => {
          const { PDFDocument } = ctx.pdfLib;
          const mergedDoc = await PDFDocument.create();
          for (const f of s.files) {
            const doc = await PDFDocument.load(await f.arrayBuffer());
            const pages = await mergedDoc.copyPages(doc, doc.getPageIndices());
            pages.forEach((p: any) => mergedDoc.addPage(p));
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
        outputName: (f: File[]) => `split-${f[0]?.name?.replace(/\.pdf$/i,'') || 'output'}.zip`,
        execute: async (s: any, o: any, ctx: any) => {
          const { PDFDocument } = ctx.pdfLib;
          const JSZip = (await import('jszip')).default;
          const doc = await PDFDocument.load(await s.files[0].arrayBuffer());
          const zip = new JSZip();
          const pageCount = doc.getPageCount();

          let pages: number[] = [];
          if (o.mode === 'all') pages = Array.from({length: pageCount}, (_,i) => i+1);
          else if (o.mode === 'single') {
            const p = parseInt(o.range) || 1;
            if (p < 1 || p > pageCount) throw new Error(`Page ${p} out of range (1-${pageCount})`);
            pages = [p];
          }
          else if (o.mode === 'range') {
            const seen = new Set<number>();
            for (const r of o.range.split(',')) {
              const [a,b] = r.split('-').map(Number);
              const start = Math.min(a,b);
              const end = Math.max(a,b);
              if (start < 1 || end > pageCount) throw new Error(`Range ${r} out of bounds (1-${pageCount})`);
              for (let i=start;i<=end;i++) if (!seen.has(i)) { seen.add(i); pages.push(i); }
            }
          }

          for (const p of pages) {
            const nd = await PDFDocument.create();
            const [cp] = await nd.copyPages(doc, [p-1]);
            nd.addPage(cp);
            zip.file(`page-${p}.pdf`, await nd.save());
          }
          return await zip.generateAsync({type:'uint8array'});
        }
      },
      {
        id: 'compress-pdf', name: 'Compress PDF', icon: 'zap', subtitle: 'Reduce PDF size',
        accept: 'application/pdf', multiple: true,
        options: [
          { id: 'quality', type: 'select', label: 'Quality', default: 'medium', options: [{value:'low',label:'Low (smallest)'},{value:'medium',label:'Medium'},{value:'high',label:'High (largest)'}] },
        ],
        outputName: (f: File[]) => `compressed-${f[0]?.name?.replace(/\.pdf$/i,'') || 'output'}.pdf`,
        execute: async (s: any, o: any, ctx: any) => {
          const { PDFDocument } = ctx.pdfLib;
          const doc = await PDFDocument.load(await s.files[0].arrayBuffer());
          return await doc.save({ useObjectStreams: true, objectsPerTick: 50 });
        }
      },
      {
        id: 'protect-pdf', name: 'Protect PDF', icon: 'lock', subtitle: 'Password protect PDF (unavailable)',
        accept: 'application/pdf', multiple: true,
        disabled: true,
        options: [
          { id: 'userPass', type: 'text', label: 'User password', default: '' },
          { id: 'ownerPass', type: 'text', label: 'Owner password (optional)', default: '' },
          { id: 'perms', type: 'checkbox', label: 'Allow printing', default: true },
          { id: 'perms2', type: 'checkbox', label: 'Allow copying', default: true },
        ],
        outputName: (f: File[]) => `protected-${f[0]?.name?.replace(/\.pdf$/i,'') || 'output'}.pdf`,
        execute: async (_s: any, _o: any, _ctx: any) => { throw new Error('Protect PDF not supported: pdf-lib encryption unavailable'); }
      },
      {
        id: 'unlock-pdf', name: 'Unlock PDF', icon: 'unlock', subtitle: 'Remove password',
        accept: 'application/pdf', multiple: true,
        options: [
          { id: 'password', type: 'text', label: 'Password', default: '' },
        ],
        outputName: (f: File[]) => `unlocked-${f[0]?.name?.replace(/\.pdf$/i,'') || 'output'}.pdf`,
        execute: async (s: any, o: any, ctx: any) => {
          const { PDFDocument } = ctx.pdfLib;
          const doc = await PDFDocument.load(await s.files[0].arrayBuffer(), { password: o.password });
          return await doc.save({ useObjectStreams: false });
        }
      },
      {
        id: 'rotate-pdf', name: 'Rotate PDF', icon: 'rotate-cw', subtitle: 'Rotate pages',
        accept: 'application/pdf', multiple: true,
        options: [
          { id: 'angle', type: 'select', label: 'Rotation', default: '90', options: [{value:'90',label:'90° CW'},{value:'180',label:'180°'},{value:'270',label:'90° CCW'}] },
          { id: 'pages', type: 'select', label: 'Apply to', default: 'all', options: [{value:'all',label:'All pages'},{value:'current',label:'Current page'},{value:'even',label:'Even pages'},{value:'odd',label:'Odd pages'}] },
        ],
        outputName: (f: File[]) => `rotated-${f[0]?.name?.replace(/\.pdf$/i,'') || 'output'}.pdf`,
        execute: async (s: any, o: any, ctx: any) => {
          const { PDFDocument, degrees } = ctx.pdfLib;
          const angle = parseInt(o.angle);
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
            page.setRotation(degrees(currentRotation + angle));
          }
          return await doc.save();
        }
      },
      {
        id: 'sign-pdf', name: 'Sign PDF', icon: 'pen-tool', subtitle: 'Add signature',
        accept: 'application/pdf', multiple: false,
        options: [
          { id: 'type', type: 'select', label: 'Type', default: 'draw', options: [{value:'draw',label:'Draw'},{value:'type',label:'Type'},{value:'upload',label:'Upload image'}] },
          { id: 'text', type: 'text', label: 'Signature text', default: '' },
          { id: 'font', type: 'select', label: 'Font', default: 'Helvetica', options: [{value:'Helvetica',label:'Helvetica'},{value:'Courier',label:'Courier'},{value:'Times-Roman',label:'Times'}] },
          { id: 'page', type: 'range', label: 'Page', default: 1, min: 1, max: 1 },
        ],
        outputName: (f: File[]) => `signed-${f[0]?.name?.replace(/\.pdf$/i,'') || 'output'}.pdf`,
        execute: async (s: any, o: any, ctx: any) => {
          const { PDFDocument, StandardFonts, rgb } = ctx.pdfLib;
          const doc = await PDFDocument.load(await s.files[0].arrayBuffer());
          const pageNum = Math.min(o.page || 1, doc.getPageCount()) - 1;
          const page = doc.getPages()[pageNum];
          const font = await doc.embedFont(StandardFonts[o.font as keyof typeof StandardFonts]);

          if (o.type === 'type' && o.text) {
            page.drawText(o.text, { x: 50, y: 50, size: 24, font, color: rgb(0,0,0) });
          }
          return await doc.save();
        }
      },
      {
        id: 'ocr-pdf', name: 'OCR PDF', icon: 'scan', subtitle: 'Make searchable',
        accept: 'application/pdf', multiple: true,
        options: [
          { id: 'lang', type: 'select', label: 'Language', default: 'eng', options: [{value:'eng',label:'English'},{value:'fra',label:'French'},{value:'deu',label:'German'},{value:'spa',label:'Spanish'},{value:'chi_sim',label:'Chinese Simplified'}] },
        ],
        outputName: (f: File[]) => `ocr-${f[0]?.name?.replace(/\.pdf$/i,'') || 'output'}.pdf`,
        execute: async (s: any, o: any, ctx: any) => {
          const Tesseract = (await import('tesseract.js')).default;
          const { PDFDocument, StandardFonts, rgb } = ctx.pdfLib;
          const buf = await s.files[0].arrayBuffer();
          const doc = await PDFDocument.load(buf);
          const font = await doc.embedFont(StandardFonts.Helvetica);
          const src = await ctx.pdfjs.getDocument({ data: buf.slice(0) }).promise;

          for (let i = 0; i < doc.getPageCount(); i++) {
            const page = await src.getPage(i + 1);
            const vp = page.getViewport({ scale: 2 });
            const canvas = document.createElement('canvas');
            canvas.width = vp.width; canvas.height = vp.height;
            await page.render({ canvasContext: canvas.getContext('2d')!, viewport: vp }).promise;

            const { data: { text } } = await Tesseract.recognize(canvas, o.lang);
            if (text.trim()) {
              const p = doc.getPages()[i];
              p.drawText(text.slice(0, 3000), { x: 20, y: 20, size: 8, font, color: rgb(0, 0, 0), lineHeight: 10, maxWidth: p.getWidth() - 40 });
            }
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
        execute: async (s: any, o: any, ctx: any) => {
          const { PDFDocument } = ctx.pdfLib;
          const doc = await PDFDocument.create();

          for (const f of s.files) {
            const buf = await f.arrayBuffer();
            let img;
            try { img = await doc.embedPng(buf); } catch { img = await doc.embedJpg(buf); }
            const page = doc.addPage([img.width, img.height]);
            page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
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
        execute: async (s: any, o: any, ctx: any) => {
          const JSZip = (await import('jszip')).default;
          const zip = new JSZip();
          const scale = parseInt(o.dpi) / 72;

          for (const f of s.files) {
            const pdfjs = ctx.pdfjs;
            const doc = await pdfjs.getDocument({data: await f.arrayBuffer()}).promise;

            for (let i=1;i<=doc.numPages;i++) {
              const page = await doc.getPage(i);
              const vp = page.getViewport({scale});
              const canvas = document.createElement('canvas');
              canvas.width = vp.width; canvas.height = vp.height;
              await page.render({canvasContext: canvas.getContext('2d')!, viewport: vp}).promise;

              const blob = await new Promise<Blob>(r => canvas.toBlob(b => r(b!), `image/${o.format}`, o.format==='jpeg'?0.9:1));
              zip.file(`${f.name.replace(/\.pdf$/i,'')}-page-${i}.${o.format}`, blob);
              await new Promise(r => setTimeout(r, 0));
            }
          }
          return await zip.generateAsync({type:'uint8array', compression: 'STORE'});
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

async function renderPages(pdfDoc: any, container: HTMLElement, scale = 1, maxPages?: number) {
  const pageCount = maxPages || pdfDoc.numPages;
  container.innerHTML = '';
  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = viewport.width; canvas.height = viewport.height;
    canvas.className = 'page-thumbnail'; canvas.dataset.page = String(pageNum);
    if (ctx) await page.render({ canvasContext: ctx, viewport }).promise;
    container.appendChild(canvas);
    if (pageNum % 5 === 0) await new Promise(r => requestAnimationFrame(r));
  }
}

class ToolRunner {
  config: ToolConfig;
  state: ToolState;
  callbacks: ToolCallbacks;
  container: HTMLElement;
  pdfLib: any = null;
  pdfjs: any = null;

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
        <div class="tool-header"><button class="back-btn" data-i18n="back" aria-label="${t('back')}"><i data-lucide="arrow-left"></i></button><div class="tool-title"><i data-lucide="${this.config.icon}"></i><h1 data-i18n="tools:${this.config.id}.name">${this.config.name}</h1></div></div>
        <p class="tool-subtitle" data-i18n="tools:${this.config.id}.subtitle">${this.config.subtitle}</p>
        <div class="upload-section" id="uploadSection"><div class="drop-zone" id="dropZone"><input type="file" id="fileInput" accept="${this.config.accept}" ${this.config.multiple ? 'multiple' : ''} hidden><i data-lucide="upload" class="drop-icon"></i><p data-i18n="dropFilesHere">${t('dropFilesHere')}</p><p class="file-types">${this.config.accept}</p><button type="button" class="btn btn-primary browse-btn" data-i18n="browseFiles">${t('browseFiles')}</button></div></div>
        <div class="files-section hidden" id="filesSection"><div class="files-list" id="filesList"></div><div class="file-actions"><button type="button" class="btn btn-secondary clear-btn" data-i18n="clearFiles">${t('clearFiles')}</button><button type="button" class="btn btn-primary process-btn" id="processBtn" disabled data-i18n="tools:${this.config.id}.processBtn">${t('process')}</button></div></div>
        <div class="options-section hidden" id="optionsSection"></div>
        <div class="preview-section hidden" id="previewSection"></div>
        <div class="loader-modal hidden" id="loaderModal" role="dialog" aria-live="polite"><div class="loader-content"><div class="spinner"></div><p id="loaderText" data-i18n="processing">${t('processing')}</p><progress id="loaderProgress" value="0" max="100"></progress></div></div>
        <div class="alert-modal hidden" id="alertModal" role="alertdialog"><div class="alert-content"><p id="alertText"></p><button type="button" class="btn btn-primary alert-ok" data-i18n="ok">${t('ok')}</button></div></div>
      </div>`;
  }

  bindEvents() {
    const dz = this.container.querySelector('#dropZone');
    const fi = this.container.querySelector('#fileInput') as HTMLInputElement;
    const bb = this.container.querySelector('.browse-btn');
    const cb = this.container.querySelector('.clear-btn');
    const pb = this.container.querySelector('#processBtn');
    const bkb = this.container.querySelector('.back-btn');
    dz?.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag-over'); });
    dz?.addEventListener('dragleave', () => dz.classList.remove('drag-over'));
    dz?.addEventListener('drop', (e: Event) => { const de = e as DragEvent; de.preventDefault(); dz.classList.remove('drag-over'); this.handleFiles(de.dataTransfer?.files); });
    bb?.addEventListener('click', () => fi?.click());
    fi?.addEventListener('change', e => this.handleFiles((e.target as HTMLInputElement).files));
    cb?.addEventListener('click', () => this.reset());
    pb?.addEventListener('click', () => this.process());
    bkb?.addEventListener('click', () => window.history.back());
  }

  async handleFiles(files: FileList | null) {
    if (!files?.length) return;
    const fa = Array.from(files);
    this.state.files = fa;
    this.updateFileDisplay();
    this.show('filesSection');
    this.renderOptions();
    await this.loadFirstPdf();
  }

  async loadFirstPdf() {
    if (!this.state.files.length) return;
    if (!this.config.accept.includes('pdf')) return;
    try {
      const ab = await this.state.files[0].arrayBuffer();
      const doc = await this.pdfjs.getDocument({ data: ab }).promise;
      this.state.pdfDoc = doc; this.state.pageCount = doc.numPages;
      this.renderPreview();
    } catch (e) { console.error('[MoonlightPDF] preview failed:', e); this.showAlert(t('pdfLoadError')); }
  }

  updateFileDisplay() {
    const list = this.container.querySelector('#filesList');
    if (!list) return;
    this.state.thumbUrls.forEach(URL.revokeObjectURL);
    this.state.thumbUrls = [];

    const isImageTool = this.config.id === 'image-to-pdf';

    if (isImageTool) {
      const safeName = (name: string) => name.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
      list.innerHTML = this.state.files.map((f, i) => `
        <div class="file-item sortable-item" data-index="${i}">
          <div class="sort-handle" aria-hidden="true">⠿</div>
          <div class="file-info">
            <div class="img-thumb-wrap"><img class="img-thumb" src="${this.state.thumbUrls[i] = URL.createObjectURL(f)}" alt="${safeName(f.name)}"></div>
            <div class="file-details">
              <div class="file-name">${safeName(f.name)}</div>
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
        <div class="file-item">
          <div class="file-info">
            <div class="file-icon"><i data-lucide="file-text"></i></div>
            <div class="file-details"><div class="file-name">${f.name.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)}</div><div class="file-size">${this.fmt(f.size)}</div></div>
          </div>
          <button type="button" class="remove-file" data-index="${i}" aria-label="${t('removeFile')}"><i data-lucide="x"></i></button>
        </div>`).join('');
    }

    list.querySelectorAll('.remove-file').forEach(btn => btn.addEventListener('click', e => {
      const idx = parseInt((e.currentTarget as HTMLElement).dataset.index!);
      this.removeFileWithAnimation(list as HTMLElement, idx);
    }));

    const pb = this.container.querySelector('#processBtn') as HTMLButtonElement | null;
    if (pb) pb.disabled = this.state.files.length === 0;
    renderIcons();
  }

  removeFileWithAnimation(list: HTMLElement, idx: number) {
    const item = list.querySelector(`.sortable-item[data-index="${idx}"]`) as HTMLElement;
    if (!item) return;
    
    if (this.state.thumbUrls[idx]) { URL.revokeObjectURL(this.state.thumbUrls[idx]); this.state.thumbUrls.splice(idx, 1); }
    
    item.style.transition = 'transform 0.2s ease, opacity 0.2s ease';
    item.style.transform = 'translateX(-100%)';
    item.style.opacity = '0';
    
    setTimeout(() => {
      this.state.files.splice(idx, 1);
      this.updateFileDisplay();
      if (!this.state.files.length) this.hide('filesSection');
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
    if (!s || !this.state.pdfDoc) return;
    s.innerHTML = '<div class="page-thumbnails" id="pageThumbnails"></div>';
    this.show('previewSection');
    await renderPages(this.state.pdfDoc, s.querySelector('#pageThumbnails')!, 0.8, this.state.pageCount);
  }

  renderOptions() {
    const s = this.container.querySelector('#optionsSection');
    if (!s || !this.config.options?.length) return;
    s.innerHTML = `<h3 data-i18n="options">${t('options')}</h3><div class="options-grid">${this.config.options.map(o => this.renderOpt(o)).join('')}</div>`;
    this.show('optionsSection');
  }

  renderOpt(o: any) {
    const id = `opt-${o.id}`;
    const key = `tools:${this.config.id}.options.${o.id}`;
    switch (o.type) {
      case 'checkbox': return `<label class="option-checkbox"><input type="checkbox" id="${id}" ${o.default ? 'checked' : ''}><span data-i18n="${key}">${o.label}</span></label>`;
      case 'select': return `<label class="option-select"><span data-i18n="${key}">${o.label}</span><select id="${id}">${o.options?.map((x: any) => `<option value="${x.value}" ${x.value === o.default ? 'selected' : ''}>${x.label}</option>`).join('')}</select></label>`;
      case 'range': return `<label class="option-range"><span data-i18n="${key}">${o.label}</span><input type="range" id="${id}" min="${o.min}" max="${o.max}" step="${o.step||1}" value="${o.default}"><output>${o.default}</output></label>`;
      default: return `<label class="option-text"><span data-i18n="${key}">${o.label}</span><input type="text" id="${id}" value="${o.default||''}"></label>`;
    }
  }

  getOpts() { const r: Record<string, any> = {}; this.config.options?.forEach(o => { const e = this.container.querySelector(`#opt-${o.id}`) as HTMLInputElement|HTMLSelectElement; if (e) r[o.id] = e.type === 'checkbox' ? e.checked : e.value; }); return r; }

  async process() { this.showLoader(t('processing')); try { const r = await this.execute(); this.callbacks.onProcessComplete?.(r, this.outName()); } catch (e) { console.error('[MoonlightPDF] process failed:', e); this.showAlert(e instanceof Error ? e.message : String(e)); } finally { this.hideLoader(); } }

  async execute(): Promise<Uint8Array | Blob> {
    if (!this.config.execute) throw new Error('No execute function');
    const ctx = {
      pdfLib: this.pdfLib,
      pdfjs: this.pdfjs,
    };
    return await this.config.execute(this.state, this.getOpts(), ctx);
  }

  outName() {
    if (this.config.outputName) return this.config.outputName(this.state.files, this.config);
    const b = this.state.files[0]?.name.replace(/\.pdf$/i, '') || 'output';
    return `${b}-${this.config.id}.pdf`;
  }

  showLoader(txt: string) { const m = this.container.querySelector('#loaderModal'), tEl = this.container.querySelector('#loaderText'); if (m && tEl) { tEl.textContent = txt; m.classList.remove('hidden'); } }
  hideLoader() { this.container.querySelector('#loaderModal')?.classList.add('hidden'); }
  showAlert(msg: string) { const m = this.container.querySelector('#alertModal'), tEl = this.container.querySelector('#alertText'); if (m && tEl) { tEl.textContent = msg; m.classList.remove('hidden'); } }
  show(id: string) { this.container.querySelector(`#${id}`)?.classList.remove('hidden'); }
  hide(id: string) { this.container.querySelector(`#${id}`)?.classList.add('hidden'); }
  fmt(b: number) { if (b === 0) return '0 B'; const k = 1024, s = ['B','KB','MB','GB']; const i = Math.floor(Math.log(b)/Math.log(k)); return parseFloat((b/Math.pow(k,i)).toFixed(2)) + ' ' + s[i]; }

  reset() { this.state.thumbUrls.forEach(URL.revokeObjectURL); this.state = { files: [], pdfDoc: null, pageCount: 0, currentPage: 1, thumbUrls: [] }; (this.container.querySelector('#fileInput') as HTMLInputElement).value = ''; this.hide('filesSection'); this.hide('optionsSection'); this.hide('previewSection'); this.render(); this.bindEvents(); }
  destroy() { this.container.innerHTML = ''; }
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
                <i data-lucide="${tool.icon}"></i>
                <span class="tool-name" data-i18n="tools:${tool.id}.name">${tool.name}</span>
                <span class="tool-subtitle" data-i18n="tools:${tool.id}.subtitle">${tool.subtitle}</span>
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
  document.querySelectorAll('[data-i18n]').forEach(el => { const key = el.getAttribute('data-i18n'); if (key) el.textContent = t(key); });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => { const key = el.getAttribute('data-i18n-placeholder'); if (key) el.setAttribute('placeholder', t(key)); });
  renderIcons();
  initTheme();

  document.getElementById('alertModal')?.querySelector('.alert-ok')?.addEventListener('click', () => document.getElementById('alertModal')?.classList.add('hidden'));
  document.getElementById('alertModal')?.addEventListener('click', (e) => { if (e.target === e.currentTarget) (e.currentTarget as HTMLElement).classList.add('hidden'); });

  window.addEventListener('hashchange', handleRoute);
  await handleRoute();
  console.log('MoonlightPDF ready');
}

window.addEventListener('load', init);