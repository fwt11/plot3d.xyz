/**
 * Helpers for preparing Plotly data/layout for high-quality export.
 *
 * The web UI uses modest pixel sizes that look good on screen. When the chart
 * is exported to a high-resolution image and embedded in documents, those same
 * pixel fonts and thin curves can appear too small. We therefore scale font
 * sizes, margins, and trace line widths only for the export render, leaving
 * the workspace view unchanged.
 */

import type { ChartConfig, ExportBackground } from '@/types';
import {
  type ChartCssVars,
  LIGHT_CHART_CSS_VARS,
  getThemeCssVars,
} from '@/utils/layoutBuilder';

const FONT_KEYS = new Set([
  'font',
  'tickfont',
  'titlefont',
  'rangefont',
  'labelfont',
  'cfont',
  'colorbar',
]);

function scaleFontSizes(obj: unknown, scale: number): void {
  if (typeof obj !== 'object' || obj === null) return;
  if (Array.isArray(obj)) {
    obj.forEach((item) => scaleFontSizes(item, scale));
    return;
  }
  const record = obj as Record<string, unknown>;
  for (const [key, value] of Object.entries(record)) {
    if (FONT_KEYS.has(key) && typeof value === 'object' && value !== null) {
      const font = value as Record<string, unknown>;
      if (typeof font.size === 'number') {
        font.size = font.size * scale;
      }
    }
    if (typeof value === 'object' && value !== null) {
      scaleFontSizes(value, scale);
    }
  }
}

function scaleMargins(layout: Record<string, unknown>, scale: number): void {
  const margin = layout.margin as Record<string, number> | undefined;
  if (!margin) return;
  for (const key of ['t', 'r', 'b', 'l']) {
    if (typeof margin[key] === 'number') {
      margin[key] = margin[key] * scale;
    }
  }
}

function scaleTraceLineWidths(data: Record<string, unknown>[], scale: number): void {
  for (const trace of data) {
    const line = trace.line as Record<string, unknown> | undefined;
    if (line && typeof line.width === 'number') {
      line.width = line.width * scale;
    }
    const marker = trace.marker as Record<string, unknown> | undefined;
    if (marker) {
      if (typeof marker.size === 'number') {
        marker.size = marker.size * scale;
      }
      const markerLine = marker.line as Record<string, unknown> | undefined;
      if (markerLine && typeof markerLine.width === 'number') {
        markerLine.width = markerLine.width * scale;
      }
    }
    for (const key of ['error_y', 'error_x'] as const) {
      const err = trace[key] as Record<string, unknown> | undefined;
      if (err && typeof err.thickness === 'number') {
        err.thickness = err.thickness * scale;
      }
    }
  }
}

function deepClone<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Return a deep-cloned layout with font sizes and margins scaled by `scale`.
 * The original layout object is not mutated.
 */
export function scaleLayoutForExport(
  layout: Record<string, unknown>,
  scale = 2,
): Record<string, unknown> {
  const cloned = deepClone(layout);
  scaleFontSizes(cloned, scale);
  scaleMargins(cloned, scale);
  return cloned;
}

/** Keys whose string values are colors and should be remapped for export. */
const COLOR_KEYS = new Set([
  'color',
  'colors',
  'bgcolor',
  'backgroundcolor',
  'paper_bgcolor',
  'plot_bgcolor',
  'gridcolor',
  'linecolor',
  'tickcolor',
  'zerolinecolor',
  'bordercolor',
  'fillcolor',
  'outlinecolor',
  'outliercolor',
  'highlightcolor',
]);

function replaceColorsInObject(obj: unknown, colorMap: Record<string, string>): void {
  if (typeof obj !== 'object' || obj === null) return;
  if (Array.isArray(obj)) {
    obj.forEach((item) => replaceColorsInObject(item, colorMap));
    return;
  }
  const record = obj as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    const value = record[key];
    if (typeof value === 'string' && COLOR_KEYS.has(key.toLowerCase()) && value in colorMap) {
      record[key] = colorMap[value];
    } else if (typeof value === 'object' && value !== null) {
      replaceColorsInObject(value, colorMap);
    }
  }
}

/**
 * Remap the cloned data/layout colors so that the exported image honors the
 * configured export background independently of the app's current theme.
 */
function applyExportColors(
  data: Record<string, unknown>[],
  layout: Record<string, unknown>,
  exportBackground: ExportBackground,
): void {
  const currentVars = getThemeCssVars();
  const exportVars: ChartCssVars =
    exportBackground === 'white' ? LIGHT_CHART_CSS_VARS : currentVars;

  const colorMap: Record<string, string> = {};
  for (const key of Object.keys(currentVars) as Array<keyof ChartCssVars>) {
    const from = currentVars[key];
    const to = exportVars[key];
    if (from !== to) colorMap[from] = to;
  }

  if (Object.keys(colorMap).length > 0) {
    replaceColorsInObject(data, colorMap);
    replaceColorsInObject(layout, colorMap);
  }

  if (exportBackground === 'transparent') {
    layout.paper_bgcolor = 'rgba(0,0,0,0)';
    layout.plot_bgcolor = 'rgba(0,0,0,0)';
    if (typeof layout.scene === 'object' && layout.scene !== null) {
      const scene = layout.scene as Record<string, unknown>;
      scene.bgcolor = 'rgba(0,0,0,0)';
      for (const axis of ['xaxis', 'yaxis', 'zaxis'] as const) {
        const ax = scene[axis] as Record<string, unknown> | undefined;
        if (ax) ax.backgroundcolor = 'rgba(0,0,0,0)';
      }
    }
  }
}

interface PlotlyDivLike extends HTMLElement {
  data: Record<string, unknown>[];
  layout: Record<string, unknown>;
  _fullLayout?: { width?: number; height?: number };
}

/**
 * Build the `{ data, layout }` payload used by Plotly.toImage / downloadImage
 * with fonts and margins scaled for export. Width/height are read from the
 * rendered Plotly div so the exported aspect ratio matches the workspace.
 *
 * Colors are adjusted based on `chartConfig.exportConfig.background` so that
 * exports keep their configured background even when the workspace is using a
 * different theme.
 */
export function buildExportPayload(
  plotlyDiv: HTMLElement,
  chartConfig: ChartConfig,
  exportScale = 2,
  figureMultiplier = 1,
): {
  data: Record<string, unknown>[];
  layout: Record<string, unknown>;
  width: number;
  height: number;
} {
  const div = plotlyDiv as PlotlyDivLike;
  const data = deepClone(div.data);
  const layout = deepClone(div.layout);
  applyExportColors(data, layout, chartConfig.exportConfig.background);
  const totalScale = exportScale * figureMultiplier;
  scaleTraceLineWidths(data, totalScale);
  const scaledLayout = scaleLayoutForExport(layout, totalScale);
  const width = (div._fullLayout?.width ?? div.clientWidth) * figureMultiplier;
  const height = (div._fullLayout?.height ?? div.clientHeight) * figureMultiplier;
  return { data, layout: scaledLayout, width, height };
}

/**
 * Export a 3D chart to PNG using a temporary off-screen render so that the
 * configured export background is honored independently of the workspace theme.
 */
export async function export3DToPng(
  plotlyDiv: HTMLElement,
  chartConfig: ChartConfig,
  options: {
    scale?: number;
    backgroundColor?: string;
    width?: number;
    height?: number;
    figureMultiplier?: number;
  } = {},
): Promise<string> {
  const figureMultiplier = options.figureMultiplier ?? 1;
  const { data, layout, width, height } = buildExportPayload(plotlyDiv, chartConfig, 1, figureMultiplier);
  const targetWidth = options.width ?? width;
  const targetHeight = options.height ?? height;

  const tempDiv = document.createElement('div');
  tempDiv.style.position = 'fixed';
  tempDiv.style.left = '-9999px';
  tempDiv.style.top = '-9999px';
  tempDiv.style.width = `${targetWidth}px`;
  tempDiv.style.height = `${targetHeight}px`;
  document.body.appendChild(tempDiv);

  try {
    const Plotly = (await import('plotly.js-dist-min')).default;
    await Plotly.newPlot(tempDiv, data, layout, {
      responsive: false,
      displayModeBar: false,
    });
    // Give WebGL a frame to finish rendering before capturing.
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    // Use Plotly.toImage instead of html-to-image to properly capture
    // WebGL canvas content (cloneNode loses WebGL context).
    return await Plotly.toImage(tempDiv, {
      format: 'png',
      scale: options.scale ?? 1,
      width: targetWidth,
      height: targetHeight,
    });
  } finally {
    document.body.removeChild(tempDiv);
  }
}

/**
 * Serialize the browser's rendered 2D chart (Plotly SVG + annotation overlay)
 * into a single standalone SVG string. Gives a 1:1 visual match with the
 * on-screen rendering, avoiding coordinate conversion and re-rendering
 * artifacts.
 *
 * Plotly v3 renders 2D charts using multiple stacked `<svg.main-svg>` elements:
 *   - SVG #0: background, drag layer, cartesianlayer (axes, grid, traces)
 *   - SVG #1: infolayer (legend, axis titles, chart title), menulayer, zoomlayer
 *   - SVG #2: hoverlayer (interactive only, not needed for export)
 *
 * We clone SVGs #0 and #1 and merge their child `<g>` elements into a single
 * SVG, preserving the correct z-order. The annotation overlay (mixed HTML +
 * SVG with percentage-based positioning) is converted to a `<foreignObject>`
 * via `html-to-image.toSvg`, which inlines all computed CSS styles so the
 * result renders correctly as standalone SVG.
 */
export async function serialize2DChartSVG(
  plotlyDiv: HTMLElement,
  options: {
    backgroundColor?: string;
  } = {},
): Promise<string> {
  // 1. Find all Plotly main SVG elements (Plotly v3 uses multiple stacked SVGs)
  const plotlySvgs = plotlyDiv.querySelectorAll('svg.main-svg');
  if (plotlySvgs.length === 0) throw new Error('Plotly main SVG not found');

  // 2. Use the first SVG as the base clone (it has the correct dimensions)
  const baseSvg = plotlySvgs[0] as SVGSVGElement;
  const svgClone = baseSvg.cloneNode(true) as SVGSVGElement;
  svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svgClone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

  // 3. Merge child elements from SVG #1 (infolayer with legend, axis titles,
  //    chart title) into the clone. Skip SVG #2 (hoverlayer — interactive only).
  //    Also merge <defs> from SVG #1 to ensure referenced elements (gradients,
  //    clipPaths etc.) are available.
  if (plotlySvgs.length > 1) {
    const infoSvg = plotlySvgs[1] as SVGSVGElement;
    for (const child of Array.from(infoSvg.children)) {
      // Skip hoverlayer (only useful for interactive display)
      const className = child.getAttribute('class') || '';
      if (className.includes('hoverlayer')) continue;
      svgClone.appendChild(child.cloneNode(true));
    }
  }

  // 4. Insert a background rect if a background color is specified.
  //    This goes behind all Plotly content. If Plotly's own paper_bgcolor is
  //    opaque it will cover this rect; if transparent, the rect shows through.
  if (options.backgroundColor) {
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('width', '100%');
    bg.setAttribute('height', '100%');
    bg.setAttribute('fill', options.backgroundColor);
    svgClone.insertBefore(bg, svgClone.firstChild);
  }

  // 5. Find the annotation canvas (sibling of plotlyDiv within the chart
  //    container — both are direct children of the container div)
  const chartContainer = plotlyDiv.parentElement;
  const annotationCanvas = chartContainer?.querySelector('.annotation-canvas') as HTMLElement | null;

  if (annotationCanvas) {
    try {
      // 6. Convert annotation canvas to an SVG fragment via html-to-image.
      //    This produces a full <svg> with a <foreignObject> wrapping the
      //    cloned DOM tree, with all computed CSS styles inlined.
      const { toSvg } = await import('html-to-image');
      const annotationSvgDataUrl = await toSvg(annotationCanvas, {
        filter: (node: Node) => {
          if (node.nodeType !== Node.ELEMENT_NODE) return true;
          const el = node as HTMLElement | SVGElement;
          if (typeof el.getAttribute === 'function' && el.getAttribute('data-export-exclude') === 'true') {
            return false;
          }
          if (typeof (el as HTMLElement).closest === 'function') {
            if ((el as HTMLElement).closest('[data-export-exclude="true"]')) return false;
          }
          return true;
        },
        backgroundColor: undefined,
      });

      // 7. Parse the annotation SVG and extract the <foreignObject>.
      //    html-to-image returns: data:image/svg+xml;charset=utf-8,<encoded SVG>
      const annotationSvgText = decodeURIComponent(
        annotationSvgDataUrl.replace(/^data:image\/svg\+xml;charset=utf-8,/, ''),
      );
      const parser = new DOMParser();
      const annotationDoc = parser.parseFromString(annotationSvgText, 'image/svg+xml');
      const foreignObject = annotationDoc.querySelector('foreignObject');

      if (foreignObject) {
        // 8. Make the inner wrapper div fill the foreignObject so that
        //    percentage-based annotation positions resolve correctly when
        //    the SVG is resized or rendered at a different resolution.
        const innerDiv = foreignObject.querySelector('div');
        if (innerDiv) {
          innerDiv.style.width = '100%';
          innerDiv.style.height = '100%';
        }
        // 9. Append the foreignObject (with annotations) to the Plotly SVG
        svgClone.appendChild(foreignObject);
      }
    } catch {
      // If annotation capture fails (e.g. tainted canvas), return just the
      // Plotly SVG without annotations — still better than failing entirely.
    }
  }

  // 10. Serialize the combined SVG to a string
  const serializer = new XMLSerializer();
  let svgString = serializer.serializeToString(svgClone);
  if (!svgString.startsWith('<?xml')) {
    svgString = '<?xml version="1.0" encoding="UTF-8"?>\n' + svgString;
  }
  return svgString;
}

/**
 * Export a 2D chart to PNG by rendering the serialized browser SVG to a
 * canvas at the desired resolution. This gives a 1:1 visual match with the
 * on-screen rendering, avoiding the distortion issues of the previous
 * Plotly.toImage + html-to-image composite approach.
 *
 * High resolution is achieved by setting a `viewBox` at the original screen
 * dimensions and scaling the SVG's `width`/`height` attributes — the browser
 * then rasterizes the vector content (including foreignObject HTML) at the
 * target resolution, giving crisp output at any scale.
 */
export async function export2DChartPNGFromSVG(
  plotlyDiv: HTMLElement,
  options: {
    scale?: number;
    width?: number;
    height?: number;
    backgroundColor?: string;
    figureMultiplier?: number;
  } = {},
): Promise<string> {
  const { scale: scaleOpt = 1, width, height, backgroundColor, figureMultiplier = 1 } = options;

  // 1. Serialize the chart to SVG at screen resolution
  const svgString = await serialize2DChartSVG(plotlyDiv, { backgroundColor });

  // 2. Parse the SVG to set viewBox + scaled dimensions for high-res rendering
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  const svg = doc.documentElement as unknown as SVGSVGElement;

  const originalWidth = parseFloat(svg.getAttribute('width') || '800');
  const originalHeight = parseFloat(svg.getAttribute('height') || '600');

  // Compute effective scale: combine scale and figureMultiplier
  let effectiveScale = scaleOpt * figureMultiplier;

  // If width/height are specified, compute scale to fit within those
  // dimensions while preserving the screen aspect ratio (avoids distortion)
  if (width && height) {
    effectiveScale = Math.min(width / originalWidth, height / originalHeight);
  } else if (width) {
    effectiveScale = width / originalWidth;
  } else if (height) {
    effectiveScale = height / originalHeight;
  }

  const targetWidth = originalWidth * effectiveScale;
  const targetHeight = originalHeight * effectiveScale;

  // Set viewBox to original screen dimensions, then scale width/height.
  // The browser rasterizes all vector content (Plotly SVG + foreignObject
  // HTML) at the target resolution, giving crisp high-res output.
  svg.setAttribute('viewBox', `0 0 ${originalWidth} ${originalHeight}`);
  svg.setAttribute('width', String(targetWidth));
  svg.setAttribute('height', String(targetHeight));

  // 3. Serialize the modified SVG and create a data URL
  const serializer = new XMLSerializer();
  const scaledSvgString = serializer.serializeToString(svg);
  const svgDataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(scaledSvgString);

  // 4. Load the SVG into an Image and render to canvas
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Failed to load SVG for PNG rendering'));
    img.src = svgDataUrl;
  });

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(targetWidth);
  canvas.height = Math.round(targetHeight);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Cannot get canvas 2d context');

  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
}
