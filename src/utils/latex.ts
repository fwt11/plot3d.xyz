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
