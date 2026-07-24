import { describe, it, expect } from 'vitest';
import { renderLatexToHTML, renderMixedContent } from './latex';

describe('renderLatexToHTML', () => {
  it('renders valid LaTeX', () => {
    const html = renderLatexToHTML('x^2');
    expect(html).toContain('katex');
  });

  it('escapes raw HTML in the fallback path when KaTeX throws (XSS guard)', () => {
    // Deeply nested groups overflow the KaTeX parser stack (RangeError),
    // which is not a ParseError and therefore reaches the catch branch.
    const evil = '<img src=x onerror=alert(1)>' + '{'.repeat(50000) + '}'.repeat(50000);
    const html = renderLatexToHTML(evil);
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
    expect(html).toContain('onerror=alert(1)'); // kept as inert text
  });

  it('escapes raw HTML in plain-text segments of mixed content', () => {
    const html = renderMixedContent('value <script>alert(1)</script> and $x^2$');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
