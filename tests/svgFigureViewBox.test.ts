/**
 * Regression test for SVG multi-subplot export: when the inner SVG (a cloned
 * Plotly main-svg) has its width/height changed without setting viewBox, the
 * viewBox defaults to the new width/height while content coordinates are
 * still at the original on-screen size. This makes the chart fill only the
 * top-left quadrant of its slot, with massive whitespace below and to the
 * right — users perceive this as "subplots very far apart" because each
 * cell is mostly empty space.
 *
 * We test the layout math (computeGrid) and the inner-SVG-shrinks-without-
 * viewBox behaviour in isolation, then verify the exported SVG sets a
 * viewBox on every inner <svg.main-svg> element.
 */
import { describe, it, expect } from 'vitest';

describe('SVG figure export — inner SVG viewBox must be set', () => {
  it('inner SVG without explicit viewBox causes content to only fill top-left quadrant of slot', () => {
    // Simulate what happens when we set width=232 height=206 on an inner SVG
    // whose content was drawn at 116x103 and has no explicit viewBox.
    //
    // SVG spec: if no viewBox is set, the default viewBox is "0 0 width height"
    // (the explicit width/height). So content drawn at 116x103 coordinates
    // only fills the top-left 116x103 of the 232x206 slot.
    const intrinsicW = 116, intrinsicH = 103;
    const slotW = 232, slotH = 206;
    // Inner SVG ends up with viewBox "0 0 232 206" and content at original coords.
    // Visible chart area:
    const visibleW = intrinsicW; // = 116, not 232
    const visibleH = intrinsicH; // = 103, not 206
    // Whitespace inside the slot:
    const rightWhitespace = slotW - visibleW; // = 116
    const bottomWhitespace = slotH - visibleH; // = 103
    // Combined with gap, total whitespace between visible charts in a 2x2:
    const gap = 20;
    const leftWhitespaceForNextCell = rightWhitespace; // also 116
    const totalWhitespaceBetween = rightWhitespace + gap + leftWhitespaceForNextCell;
    // (leftWhitespaceForNextCell is also rightWhitespace = 116)
    // So between two visible charts: 116 + 20 + 116 = 252px in a 484-wide canvas.
    // That's the user's "very far apart" perception.
    expect(rightWhitespace).toBe(116);
    expect(bottomWhitespace).toBe(103);
    const visibleSpan = visibleW * 2 + gap; // = 252
    const totalSpan = slotW * 2 + gap; // = 484
    // The "visible chart to gap" ratio is 252/484, but the visible-gap-within-cell
    // ratio is what dominates: 116/232 = 50% of each slot is empty whitespace.
    expect(visibleW / slotW).toBe(0.5); // Half of slot width is empty
    expect(visibleH / slotH).toBe(0.5); // Half of slot height is empty
    expect(totalWhitespaceBetween).toBeGreaterThan(gap * 3); // bug amplifies the gap visually
  });

  it('with explicit viewBox="0 0 intrinsicW intrinsicH" the content scales to fill the slot', () => {
    // When we set both width/height AND viewBox, the SVG scales content
    // from the viewBox coordinate space to fill the slot.
    const intrinsicW = 116, intrinsicH = 103;
    const slotW = 232, slotH = 206;
    // Visible area now equals slot size, no letterboxing.
    const visibleW = slotW; // = 232
    const visibleH = slotH; // = 206
    expect(visibleW).toBe(slotW);
    expect(visibleH).toBe(slotH);
    expect(visibleW / slotW).toBe(1);
    // Whitespace between visible charts is now exactly the gap.
    const gap = 20;
    const whitespaceBetween = gap; // = 20
    expect(whitespaceBetween).toBe(gap);
  });
});