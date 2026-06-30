import katex from 'katex';
import 'katex/dist/katex.min.css';

/**
 * Strip potentially dangerous LaTeX commands before rendering.
 * Removes \input, \include, \write, \openout, \closeout, \immediate,
 * \catcode, \special, \shipout, and \def/\newcommand that redefine core commands.
 */
function sanitizeLatex(latex: string): string {
  // Strip dangerous commands that can read/write files or change catcodes
  const dangerousCommands = [
    '\\input', '\\include', '\\write', '\\openout', '\\closeout',
    '\\immediate', '\\catcode', '\\special', '\\shipout',
  ];
  let sanitized = latex;
  for (const cmd of dangerousCommands) {
    // Match the command followed by optional braces/brackets and their content
    sanitized = sanitized.replace(new RegExp(`\\\\${cmd.slice(1)}\\s*(\\{[^}]*\\}|\\[[^\\]]*\\])*`, 'g'), '');
  }
  // Strip \def or \newcommand that tries to redefine core commands (starting with \)
  sanitized = sanitized.replace(/\\(?:def|newcommand)\s*\{?\s*\\[a-zA-Z]+/, '');
  return sanitized;
}

export function renderLatexToHTML(latex: string, displayMode = false): string {
  try {
    const sanitized = sanitizeLatex(latex);
    return katex.renderToString(sanitized, {
      displayMode,
      throwOnError: false,
      strict: 'warn',
    });
  } catch {
    return `<span style="color:#f87171">${latex}</span>`;
  }
}

export function isLatexContent(content: string): boolean {
  const trimmed = content.trim();
  return trimmed.startsWith('$') && trimmed.endsWith('$');
}

export function extractLatex(content: string): { latex: string; displayMode: boolean } {
  const trimmed = content.trim();
  if (trimmed.startsWith('$$') && trimmed.endsWith('$$')) {
    return { latex: trimmed.slice(2, -2).trim(), displayMode: true };
  }
  if (trimmed.startsWith('$') && trimmed.endsWith('$')) {
    return { latex: trimmed.slice(1, -1).trim(), displayMode: false };
  }
  return { latex: content, displayMode: false };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** Render text that may contain interspersed $...$ / $$...$$ LaTeX segments. */
export function renderMixedContent(content: string): string {
  // Match $$...$$ first, then $...$ (non-greedy, multi-line)
  const regex = /(\$\$[\s\S]*?\$\$)|(\$[\s\S]*?\$)/g;
  let result = '';
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    // Escape plain text before this match
    result += escapeHtml(content.slice(lastIndex, match.index));

    const full = match[0];
    if (full.startsWith('$$')) {
      const latex = full.slice(2, -2).trim();
      result += renderLatexToHTML(latex, true);
    } else {
      const latex = full.slice(1, -1).trim();
      result += renderLatexToHTML(latex, false);
    }

    lastIndex = regex.lastIndex;
  }

  // Remaining plain text
  result += escapeHtml(content.slice(lastIndex));
  return result;
}
