import katex from 'katex';
import 'katex/dist/katex.min.css';

export function renderLatexToHTML(latex: string, displayMode = false): string {
  try {
    return katex.renderToString(latex, {
      displayMode,
      throwOnError: false,
      strict: false,
      trust: true,
    });
  } catch {
    return `<span style="color:#f87171">${latex}</span>`;
  }
}

export function isLatexContent(content: string): boolean {
  return content.startsWith('$') && content.endsWith('$');
}

export function extractLatex(content: string): { latex: string; displayMode: boolean } {
  if (content.startsWith('$$') && content.endsWith('$$')) {
    return { latex: content.slice(2, -2).trim(), displayMode: true };
  }
  if (content.startsWith('$') && content.endsWith('$')) {
    return { latex: content.slice(1, -1).trim(), displayMode: false };
  }
  return { latex: content, displayMode: false };
}
