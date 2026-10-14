import i18next from 'i18next';

const resources = {
  en: {
    common: {
      back: 'Back',
      ok: 'OK',
      processing: 'Processing...',
      options: 'Options',
      dropFilesHere: 'Drop files here',
      browseFiles: 'Browse Files',
      clearFiles: 'Clear Files',
      pdfLoadError: 'Failed to load PDF. The file may be invalid, corrupted, or password-protected.',
      homepage: {
        title: 'MoonlightPDF',
        subtitle: 'Privacy-first PDF toolkit that runs entirely in your browser'
      },
      nav: { home: 'Home' },
      footer: { copyright: '© 2026 MoonlightPDF. Open source under AGPL-3.0.' },
      removeFile: 'Remove file',
      process: 'Process'
    },
    tools: {
      'merge-pdf': { name: 'Merge PDF', subtitle: 'Combine multiple PDFs', processBtn: 'Merge PDFs', options: {} },
      'split-pdf': { name: 'Split PDF', subtitle: 'Split PDF into parts', processBtn: 'Split PDF', options: { mode: 'Split mode', range: 'Page range (e.g. 1-3,5)' } },
      'compress-pdf': { name: 'Compress PDF', subtitle: 'Reduce PDF size', processBtn: 'Compress PDF', options: { quality: 'Quality' } },
      'protect-pdf': { name: 'Protect PDF', subtitle: 'Password protect PDF', processBtn: 'Protect PDF', options: { userPass: 'User password', ownerPass: 'Owner password (optional)', perms: 'Allow printing', perms2: 'Allow copying' } },
      'unlock-pdf': { name: 'Unlock PDF', subtitle: 'Remove password', processBtn: 'Unlock PDF', options: { password: 'Password' } },
      'rotate-pdf': { name: 'Rotate PDF', subtitle: 'Rotate pages', processBtn: 'Rotate PDF', options: { angle: 'Rotation', pages: 'Apply to' } },
      'sign-pdf': { name: 'Sign PDF', subtitle: 'Add signature', processBtn: 'Sign PDF', options: { type: 'Type', text: 'Signature text', font: 'Font', page: 'Page' } },
      'ocr-pdf': { name: 'OCR PDF', subtitle: 'Make searchable', processBtn: 'OCR PDF', options: { lang: 'Language' } },
      'image-to-pdf': { name: 'Images to PDF', subtitle: 'Convert images', processBtn: 'Convert to PDF', options: { pageSize: 'Page size', margin: 'Margin' } },
      'pdf-to-images': { name: 'PDF to Images', subtitle: 'Extract images', processBtn: 'Extract Images', options: { format: 'Format', dpi: 'DPI' } },
      'docx-to-pdf': { name: 'DOCX to PDF', subtitle: 'Convert Word documents to PDF', processBtn: 'Convert to PDF', options: {} },
      'pdf-to-docx': { name: 'PDF to DOCX', subtitle: 'Convert PDF to Word document', processBtn: 'Convert to DOCX', options: {} },
      'excel-to-pdf': { name: 'Excel to PDF', subtitle: 'Convert spreadsheets to PDF', processBtn: 'Convert to PDF', options: { orientation: 'Orientation' } },
      'pdf-to-excel': { name: 'PDF to Excel', subtitle: 'Extract tables to XLSX', processBtn: 'Convert to Excel', options: {} }
    }
  }
} as const;

let initialized = false;

export async function initI18n(): Promise<typeof i18next> {
  if (initialized) return i18next;
  await i18next.init({
    lng: 'en', fallbackLng: 'en', ns: ['common', 'tools'], defaultNS: 'common',
    resources,
    interpolation: { escapeValue: false },
  });
  initialized = true;
  return i18next;
}

export function t(key: string, options?: Record<string, unknown>): string {
  return i18next.t(key, options);
}

export function applyTranslations(): void {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (key) el.textContent = t(key);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (key && el instanceof HTMLInputElement) el.placeholder = t(key);
  });
}
