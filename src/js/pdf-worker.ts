// Worker entry: apply the Uint8Array polyfill before pdf.js worker code runs.
import './pdf-shim.js';
import 'pdfjs-dist/build/pdf.worker.min.mjs';
