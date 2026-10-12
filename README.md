# MoonlightPDF

A small PDF toolkit that runs entirely in your browser. Files open and get processed on your own device; nothing is uploaded to a server.

It is a personal project, built to do a handful of PDF jobs well and stay small. There is no account, no tracking, and no backend to run.

## Tools

| Tool | What it does |
|------|--------------|
| Merge PDF | Combine several PDFs into one file. |
| Split PDF | Break a PDF into separate pages or a page range, delivered as a zip. |
| Compress PDF | Re-save a PDF with object streams to shrink it a little. |
| Protect PDF | Add a password (currently broken, see Limitations). |
| Unlock PDF | Open a password-protected PDF when you know the password. |
| Rotate PDF | Turn all, odd, even, or a single page by 90, 180, or 270 degrees. |
| Sign PDF | Stamp a typed signature onto a chosen page. |
| OCR PDF | Run text recognition on a PDF and lay the text over the pages. |
| Images to PDF | Turn a set of images into a single PDF. |
| PDF to Images | Render each page to PNG, JPEG, or WebP, delivered as a zip. |

## How it works

Every tool uses a JavaScript library (pdf-lib, pdf.js, and tesseract.js) compiled into the page. Your file is read from local disk into the browser, processed in memory, and handed back as a download. No file, and no part of it, is sent anywhere.

Because there is no server, the whole site is static files. That is also why it is cheap and simple to host.

## Getting started

You need Node.js 20.19 or newer (Vite 8 requires `^20.19.0 || >=22.12.0`).

```
npm install
npm run dev
```

Open the URL that Vite prints (usually `http://localhost:5173`).

### Scripts

| Command | Effect |
|---------|--------|
| `npm run dev` | Start the dev server with hot reload. |
| `npm run build` | Build the production site into `dist/`. |
| `npm run preview` | Serve the built `dist/` locally to check it. |

## Deployment

The build output in `dist/` is a plain static site, so it drops onto any static host.

- Vercel: import the repository. Vercel detects Vite and builds `dist/` for you.
- GitHub Pages, or any host at a domain root: works as-is.
- GitHub Pages project site (`username.github.io/REPO/`): change `base` in `vite.config.ts` to `'/REPO/'` (or `'./'` for any path). The router is hash-based (`#/merge-pdf`), so no server-side rewrite rules are needed.

One tool needs a network connection: OCR. tesseract.js fetches its worker and language data from a CDN the first time it runs. The other nine tools work offline.

## Limitations

These are real and worth knowing before you rely on a tool.

- Protect PDF cannot create password-protected files. The pdf-lib version in use has no encryption support, so this tool does not work yet.
- Unlock PDF only handles encryption schemes pdf-lib can read, and only with the correct password.
- Sign PDF draws typed text only. The draw and upload modes are not implemented.
- Images to PDF ignores the page-size and margin options and always fits the page to the image.
- Compress PDF re-saves the file; it is not a full re-encode, so savings are modest.
- OCR paints a visible layer of text over the page rather than an invisible, selectable one.
- The interface is English only.

## Tech

Vite, TypeScript, Tailwind CSS v4, pdf-lib, pdfjs-dist, tesseract.js, JSZip, i18next, and Lucide icons.

## License

AGPL-3.0.
