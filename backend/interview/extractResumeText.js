import { createRequire } from 'module';
import mammoth from 'mammoth';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse/lib/pdf-parse.js');

function toUint8Array(buffer) {
  if (Buffer.isBuffer(buffer)) return new Uint8Array(buffer);
  if (buffer instanceof Uint8Array) return buffer;
  return new Uint8Array(buffer);
}

function sanitizeLine(line) {
  return line
    .replace(/\u0000/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[•●▪◦]/g, '-')
    .trim();
}

function cleanResumeText(rawText) {
  if (!rawText) return '';

  const normalized = rawText
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[ \u00A0]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n');

  const cleanedLines = normalized
    .split('\n')
    .map(sanitizeLine)
    .filter(Boolean)
    .filter((line) => !/^(page\s+\d+|resume|curriculum vitae)$/i.test(line));

  return cleanedLines.join('\n').trim();
}

async function extractPdfText(buffer) {
  try {
    const result = await pdfParse(buffer);
    const cleaned = cleanResumeText(result.text || '');
    if (cleaned.length >= 40) return cleaned;
  } catch (error) {
    // Fall through to pdfjs fallback for malformed/corrupted PDFs.
  }

  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const loadingTask = pdfjs.getDocument({
    data: toUint8Array(buffer),
    useWorkerFetch: false,
  });

  const pdf = await loadingTask.promise;
  const pages = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const line = textContent.items
      .map((item) => (item && typeof item.str === 'string' ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (line) pages.push(line);
  }

  const cleaned = cleanResumeText(pages.join('\n'));
  if (!cleaned) {
    throw new Error('Could not extract text from PDF. The file may be image-only or corrupted. Please upload a text-based PDF, DOCX, or TXT.');
  }

  return cleaned;
}

async function extractDocxText(buffer) {
  const result = await mammoth.extractRawText({ buffer });
  return cleanResumeText(result.value || '');
}

function extractTxtText(buffer) {
  return cleanResumeText(buffer.toString('utf-8'));
}

async function extractResumeTextFromFile(file) {
  if (!file || !file.buffer) {
    throw new Error('Resume file is required');
  }

  const mime = (file.mimetype || '').toLowerCase();
  const fileName = (file.originalname || '').toLowerCase();

  if (mime.includes('pdf') || fileName.endsWith('.pdf')) {
    return extractPdfText(file.buffer);
  }

  if (
    mime.includes('word') ||
    mime.includes('officedocument.wordprocessingml.document') ||
    fileName.endsWith('.docx')
  ) {
    return extractDocxText(file.buffer);
  }

  if (mime.includes('text') || fileName.endsWith('.txt')) {
    return extractTxtText(file.buffer);
  }

  throw new Error('Unsupported file format. Please upload PDF, DOCX, or TXT');
}

export {
  cleanResumeText,
  extractResumeTextFromFile,
};
