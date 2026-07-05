import type { ChartConfig, Dataset, FigureConfig, LayerConfig, Annotation, ColorMapName } from '@/types';
import { isValidNumber } from '@/types';
import { is3DChart } from '@/utils/chart';
import { colToNumbers, axisLabelText, extractGridData } from '@/utils/tracesBuilder';

/** Map our line style to matplotlib linestyle string. */
function mplLineStyle(style: LayerConfig['lineStyle']): string {
  switch (style) {
    case 'dashed': return '--';
    case 'dotted': return ':';
    default: return '-';
  }
}

/** Map our point style to matplotlib marker string. Returns '' for 'none'. */
function mplMarker(style: LayerConfig['pointStyle']): string {
  switch (style) {
    case 'circle': return 'o';
    case 'square': return 's';
    case 'triangle': return '^';
    default: return '';
  }
}

/** Map our legend position to matplotlib loc string. */
function mplLegendLoc(pos: ChartConfig['legend']['position']): string {
  switch (pos) {
    case 'top': return 'upper center';
    case 'bottom': return 'lower center';
    case 'left': return 'center left';
    case 'right': return 'center right';
    case 'inside-top-right': return 'upper right';
    case 'inside-top-left': return 'upper left';
    case 'inside-bottom-right': return 'lower right';
    case 'inside-bottom-left': return 'lower left';
    default: return 'best';
  }
}

/** Map our colormap name to a matplotlib colormap name. */
function mplColorMap(name: ColorMapName): string {
  // Most of our names map directly to matplotlib colormaps
  const map: Record<ColorMapName, string> = {
    jet: 'jet',
    viridis: 'viridis',
    hot: 'hot',
    coolwarm: 'coolwarm',
    parula: 'viridis', // parula is MATLAB-specific; viridis is the closest matplotlib default
    plasma: 'plasma',
    cividis: 'cividis',
    inferno: 'inferno',
    magma: 'magma',
    turbo: 'turbo',
    batlow: 'batlow',
  };
  return map[name] ?? 'viridis';
}

/** Python-escape a string for use in a string literal. */
function pyEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
}

/** Format a number for Python source code (handles NaN/Inf gracefully). */
function fmtNum(v: number): string {
  if (!Number.isFinite(v)) return 'np.nan';
  // Avoid scientific notation for very small exponents that look noisy
  if (Number.isInteger(v) && Math.abs(v) < 1e15) return String(v);
  return String(v);
}

/** Build a numpy array literal from a number array. */
function npArray(values: number[]): string {
  return `np.array([${values.map(fmtNum).join(', ')}])`;
}

/** Build a 2D numpy array (list of rows). */
function np2DArray(matrix: (number | null)[][]): string {
  const rows = matrix.map((row) => `[${row.map((v) => (v == null || !Number.isFinite(v as number) ? 'np.nan' : fmtNum(v as number))).join(', ')}]`);
  return `np.array([\n    ${rows.join(',\n    ')}\n])`;
}

/** Build a Python list literal from strings. */
function pyStrList(values: string[]): string {
  return `[${values.map((v) => `'${pyEscape(v)}'`).join(', ')}]`;
}

/** Find a column by id in a dataset. */
function findColumn(ds: Dataset, colId?: string) {
  if (!colId) return undefined;
  return ds.columns.find((c) => c.id === colId);
}

/** Get the first column matching a type, fallback to first column. */
function findColumnByType(ds: Dataset, type: 'X' | 'Y' | 'Z') {
  return ds.columns.find((c) => c.type === type) ?? ds.columns[0];
}

interface ExpandedLayer {
  layer: LayerConfig;
  ds: Dataset;
  xCol: NonNullable<ReturnType<typeof findColumn>>;
  yCol: NonNullable<ReturnType<typeof findColumn>>;
  zCol?: NonNullable<ReturnType<typeof findColumn>>;
  label: string;
}

/** Expand chart layers into concrete column references (mirrors ChartView logic). */
function expandLayers(chartConfig: ChartConfig, datasets: Dataset[]): ExpandedLayer[] {
  const result: ExpandedLayer[] = [];
  const visibleLayers = chartConfig.layers.filter((l) => l.visible);
  const is3D = is3DChart(chartConfig.type);

  for (const layer of visibleLayers) {
    const ds = datasets.find((d) => d.id === layer.datasetId);
    if (!ds) continue;
    const xCol = findColumn(ds, layer.xColumn) ?? findColumnByType(ds, 'X');
    if (!xCol) continue;

    if (is3D) {
      const yCol = findColumn(ds, layer.yColumn) ?? findColumnByType(ds, 'Y');
      const zCol = layer.zColumn ? findColumn(ds, layer.zColumn) : findColumnByType(ds, 'Z');
      if (!yCol) continue;
      result.push({
        layer,
        ds,
        xCol,
        yCol,
        zCol,
        label: layer.displayName || yCol.name,
      });
    } else if (layer.yColumn) {
      const yCol = findColumn(ds, layer.yColumn);
      if (!yCol) continue;
      const zCol = chartConfig.type === 'heatmap'
        ? (layer.zColumn ? findColumn(ds, layer.zColumn) : findColumnByType(ds, 'Z'))
        : undefined;
      result.push({
        layer,
        ds,
        xCol,
        yCol,
        zCol,
        label: layer.displayName || yCol.name,
      });
    } else {
      // No explicit yColumn — expand to all Y-type columns
      const yCols = ds.columns.filter((c) => c.type === 'Y');
      const zCol = chartConfig.type === 'heatmap'
        ? (layer.zColumn ? findColumn(ds, layer.zColumn) : findColumnByType(ds, 'Z'))
        : undefined;
      yCols.forEach((yCol) => {
        result.push({
          layer,
          ds,
          xCol,
          yCol,
          zCol,
          label: layer.displayName || yCol.name,
        });
      });
    }
  }
  return result;
}

/** Generate a unique variable name from a prefix and index. */
function varName(prefix: string, idx: number): string {
  return `${prefix}${idx}`;
}

/**
 * Build the Python code for a single annotation (best-effort, common types only).
 * `axVar` is the Python axes variable name (e.g. 'ax' or 'axs[0]') — used for data-coord
 * annotations. Percent-coord annotations always use `fig.text` and are axVar-independent.
 */
function buildAnnotationCode(ann: Annotation, idx: number, axVar: string): string | null {
  if (!ann.visible) return null;
  const v = varName('ann', idx);
  // Convert $$..$$ (KaTeX-style) → $..$ (matplotlib mathtext inline math)
  const txt = latexForMatplotlib(ann.content || '');
  // Percent-coord annotations: use fig.text (figure-level coords 0-100)
  if (ann.coordMode === 'percent') {
    if (ann.type === 'text' || ann.type === 'latex' || ann.type === 'callout' || ann.type === 'fitEquation') {
      return `${v} = fig.text(${fmtNum(ann.x / 100)}, ${fmtNum(ann.y / 100)}, '${pyEscape(txt)}', fontsize=${ann.fontSize}, color='${pyEscape(ann.color)}', ha='center', va='center')`;
    }
    // Other types in percent mode: skip (best-effort)
    return null;
  }
  // Data-coord annotations — use the per-subplot axes variable
  switch (ann.type) {
    case 'text':
    case 'callout':
    case 'latex':
    case 'fitEquation': {
      // matplotlib mathtext uses $...$ inline; content with $$...$$ stays as-is
      return `${v} = ${axVar}.annotate(${pyStrList([txt])}[0], xy=(${fmtNum(ann.x)}, ${fmtNum(ann.y)}), fontsize=${ann.fontSize}, color='${pyEscape(ann.color)}')`;
    }
    case 'hline':
      return `${v} = ${axVar}.axhline(y=${fmtNum(ann.referenceValue as number ?? ann.y)}, color='${pyEscape(ann.color)}', linewidth=${ann.strokeWidth ?? 1})`;
    case 'vline':
      return `${v} = ${axVar}.axvline(x=${fmtNum(ann.referenceValue as number ?? ann.x)}, color='${pyEscape(ann.color)}', linewidth=${ann.strokeWidth ?? 1})`;
    case 'rect': {
      const w = ann.rectSize?.w ?? 1;
      const h = ann.rectSize?.h ?? 1;
      return `${v} = ${axVar}.add_patch(plt.Rectangle((${fmtNum(ann.x)}, ${fmtNum(ann.y)}), ${fmtNum(w)}, ${fmtNum(h)}, fill=True, facecolor='${pyEscape(ann.fillColor ?? ann.color)}', alpha=${ann.fillOpacity ?? 0.3}, edgecolor='${pyEscape(ann.color)}'))`;
    }
    case 'ellipse': {
      const rx = ann.ellipseRadii?.rx ?? 1;
      const ry = ann.ellipseRadii?.ry ?? 1;
      return `${v} = ${axVar}.add_patch(plt.Ellipse((${fmtNum(ann.x)}, ${fmtNum(ann.y)}), ${fmtNum(rx * 2)}, ${fmtNum(ry * 2)}, fill=True, facecolor='${pyEscape(ann.fillColor ?? ann.color)}', alpha=${ann.fillOpacity ?? 0.3}, edgecolor='${pyEscape(ann.color)}'))`;
    }
    case 'line':
    case 'arrow': {
      const ex = ann.endPoint?.x ?? ann.x;
      const ey = ann.endPoint?.y ?? ann.y;
      if (ann.type === 'arrow') {
        return `${v} = ${axVar}.annotate('', xy=(${fmtNum(ex)}, ${fmtNum(ey)}), xytext=(${fmtNum(ann.x)}, ${fmtNum(ann.y)}), arrowprops=dict(arrowstyle='->', color='${pyEscape(ann.color)}', lw=${ann.strokeWidth ?? 1}))`;
      }
      return `${v} = ${axVar}.plot([${fmtNum(ann.x)}, ${fmtNum(ex)}], [${fmtNum(ann.y)}, ${fmtNum(ey)}], color='${pyEscape(ann.color)}', linewidth=${ann.strokeWidth ?? 1})`;
    }
    default:
      return null;
  }
}

/**
 * Convert KaTeX-style display math `$$ ... $$` to matplotlib mathtext inline `$ ... $`.
 * matplotlib mathtext rejects `$$` (only supports single-`$` inline math mode),
 * so we strip the outer pair. Content without `$$` is returned unchanged.
 */
export function latexForMatplotlib(content: string): string {
  // Replace each occurrence of $$...$$ with $...$ (multi-line and inline alike).
  return content.replace(/\$\$([\s\S]*?)\$\$/g, (_, body) => '$' + body + '$');
}

/**
 * Emit a subplot's DATA section — numpy array literals for x/y/z and error bars.
 *
 * `idxPrefix` namespaces the generated Python variable names so multiple subplots in the same
 * script don't collide (e.g. 's0_x_0', 's1_x_0' for two subplots). Pass '' for a single chart
 * to preserve legacy variable names ('x_0', 'y_0', ...).
 */
function emitSubplotData(
  lines: string[],
  chartConfig: ChartConfig,
  datasets: Dataset[],
  idxPrefix: string,
): void {
  const expanded = expandLayers(chartConfig, datasets);
  expanded.forEach((entry, i) => {
    const xVals = colToNumbers(entry.xCol);
    lines.push(`${idxPrefix}${varName('x', i)} = ${npArray(xVals)}`);
    const yVals = colToNumbers(entry.yCol);
    lines.push(`${idxPrefix}${varName('y', i)} = ${npArray(yVals)}`);
    if (entry.zCol) {
      const zVals = colToNumbers(entry.zCol);
      lines.push(`${idxPrefix}${varName('z', i)} = ${npArray(zVals)}`);
    }
    // Error bar arrays
    const errCol = entry.layer.errorColumn ? findColumn(entry.ds, entry.layer.errorColumn) : undefined;
    if (errCol) {
      lines.push(`${idxPrefix}${varName('yerr', i)} = ${npArray(colToNumbers(errCol))}`);
    }
    const errPlusCol = entry.layer.errorPlusColumn ? findColumn(entry.ds, entry.layer.errorPlusColumn) : undefined;
    const errMinusCol = entry.layer.errorMinusColumn ? findColumn(entry.ds, entry.layer.errorMinusColumn) : undefined;
    if (errPlusCol) {
      lines.push(`${idxPrefix}${varName('yerr_plus', i)} = ${npArray(colToNumbers(errPlusCol))}`);
    }
    if (errMinusCol) {
      lines.push(`${idxPrefix}${varName('yerr_minus', i)} = ${npArray(colToNumbers(errMinusCol))}`);
    }
  });
}

/**
 * Emit a subplot's TRACES + ANNOTATIONS + AXES-TAIL + LEGEND section.
 *
 * `axVar` is the Python axes variable name to use in trace/annotation calls (e.g. 'ax' or
 * 'axs[0]'). Twin axes (for `yAxisSide === 'right'` layers) become `${axVar}2`. `idxPrefix`
 * namespaces Python variable names; pass '' for a single chart to preserve legacy names.
 */
function emitSubplotTracesAndTail(
  lines: string[],
  chartConfig: ChartConfig,
  datasets: Dataset[],
  axVar: string,
  idxPrefix: string,
): void {
  const chartType = chartConfig.type;
  const is3D = is3DChart(chartType);
  const expanded = expandLayers(chartConfig, datasets);
  const twinVar = `${axVar}2`;

  // ─── Traces ────────────────────────────────────────────
  lines.push('# ─── Traces ────────────────────────────────────────────────────');
  const hasRightAxis = expanded.some((e) => e.layer.yAxisSide === 'right');
  if (hasRightAxis) {
    lines.push('# Twin axis for layers with yAxisSide="right"');
    lines.push(`${twinVar} = ${axVar}.twinx()`);
    lines.push('');
  }

  expanded.forEach((entry, i) => {
    const { layer, label } = entry;
    const color = layer.color;
    const xVar = `${idxPrefix}${varName('x', i)}`;
    const yVar = `${idxPrefix}${varName('y', i)}`;
    const zVar = entry.zCol ? `${idxPrefix}${varName('z', i)}` : '';
    const labelStr = `'${pyEscape(label)}'`;
    const targetAx = layer.yAxisSide === 'right' ? twinVar : axVar;

    switch (chartType) {
      case 'line':
      case 'area': {
        const marker = mplMarker(layer.pointStyle);
        const markerArg = marker ? `, marker='${marker}', markersize=${layer.pointSize}` : '';
        lines.push(`${targetAx}.plot(${xVar}, ${yVar}, color='${color}', linewidth=${layer.lineWidth}, linestyle='${mplLineStyle(layer.lineStyle)}'${markerArg}, label=${labelStr})`);
        if (layer.fill || chartType === 'area') {
          const fillColor = layer.fillColor ?? color;
          const alpha = layer.fillOpacity ?? 0.35;
          lines.push(`${targetAx}.fill_between(${xVar}, ${yVar}, color='${fillColor}', alpha=${alpha})`);
        }
        break;
      }
      case 'scatter': {
        lines.push(`${targetAx}.scatter(${xVar}, ${yVar}, c='${color}', s=${Math.max(layer.pointSize * 4, 12)}, label=${labelStr})`);
        break;
      }
      case 'bar': {
        // Use categorical x positions if x column isn't numeric
        const xIsNumeric = entry.xCol.values.every((v) => isValidNumber(v));
        if (xIsNumeric) {
          lines.push(`${targetAx}.bar(${xVar}, ${yVar}, color='${color}', width=0.8, label=${labelStr})`);
        } else {
          const labelsVar = `${idxPrefix}labels_${i}`;
          lines.push(`${labelsVar} = ${pyStrList(entry.xCol.values.map(String))}`);
          lines.push(`${targetAx}.bar(range(len(${yVar})), ${yVar}, color='${color}', width=0.8, label=${labelStr})`);
          lines.push(`${targetAx}.set_xticks(range(len(${labelsVar})))`);
          lines.push(`${targetAx}.set_xticklabels(${labelsVar})`);
        }
        break;
      }
      case 'pie': {
        const labelsVar = `${idxPrefix}pie_labels_${i}`;
        lines.push(`${labelsVar} = ${pyStrList(entry.xCol.values.map(String))}`);
        lines.push(`${axVar}.pie(${yVar}, labels=${labelsVar}, colors=None, autopct='%1.1f%%', startangle=90)`);
        lines.push(`${axVar}.axis('equal')`);
        break;
      }
      case 'polar': {
        // Polar plot needs a separate polar subplot; for simplicity we create one here
        lines.push(`fig_polar, ax_polar = plt.subplots(subplot_kw={'projection': 'polar'})`);
        const marker = mplMarker(layer.pointStyle);
        const markerArg = marker ? `, marker='${marker}', markersize=${layer.pointSize}` : '';
        lines.push(`ax_polar.plot(${xVar}, ${yVar}, color='${color}', linewidth=${layer.lineWidth}, linestyle='${mplLineStyle(layer.lineStyle)}'${markerArg}, label=${labelStr})`);
        break;
      }
      case 'box': {
        lines.push(`${targetAx}.boxplot(${yVar}[~np.isnan(${yVar})], labels=[${labelStr}], patch_artist=True, boxprops=dict(facecolor='${color}', alpha=0.6))`);
        break;
      }
      case 'histogram': {
        const validY = `${idxPrefix}y_${i}_valid`;
        lines.push(`${validY} = ${yVar}[~np.isnan(${yVar})]`);
        const bins = Math.max(5, Math.min(50, Math.ceil(Math.sqrt(colToNumbers(entry.yCol).filter((v) => Number.isFinite(v)).length))));
        lines.push(`${targetAx}.hist(${validY}, bins=${bins}, color='${color}', alpha=0.7, edgecolor='${color}', label=${labelStr})`);
        break;
      }
      case 'violin': {
        const validY = `${idxPrefix}y_${i}_valid`;
        lines.push(`${validY} = ${yVar}[~np.isnan(${yVar})]`);
        lines.push(`${targetAx}.violinplot(${validY}, positions=[${i}], showmeans=True, showmedians=True)`);
        break;
      }
      case 'heatmap': {
        if (entry.zCol) {
          const xVals = colToNumbers(entry.xCol);
          const yVals = colToNumbers(entry.yCol);
          const zVals = colToNumbers(entry.zCol);
          const grid = extractGridData(xVals, yVals, zVals);
          const gxVar = `${idxPrefix}hm_x_${i}`;
          const gyVar = `${idxPrefix}hm_y_${i}`;
          const gzVar = `${idxPrefix}hm_z_${i}`;
          lines.push(`${gxVar} = ${npArray(grid.x)}`);
          lines.push(`${gyVar} = ${npArray(grid.y)}`);
          lines.push(`${gzVar} = ${np2DArray(grid.z)}`);
          lines.push(`im = ${axVar}.pcolormesh(${gxVar}, ${gyVar}, ${gzVar}.T, shading='auto', cmap='${mplColorMap(chartConfig.colorMap)}')`);
          lines.push(`cbar = fig.colorbar(im, ax=${axVar})`);
          const cbarTitle = chartConfig.zAxis?.label || entry.zCol.name;
          lines.push(`cbar.set_label('${pyEscape(cbarTitle)}')`);
        }
        break;
      }
      case 'surface3d': {
        if (entry.zCol) {
          const xVals = colToNumbers(entry.xCol);
          const yVals = colToNumbers(entry.yCol);
          const zVals = colToNumbers(entry.zCol);
          const grid = extractGridData(xVals, yVals, zVals);
          const gxVar = `${idxPrefix}sf_x_${i}`;
          const gyVar = `${idxPrefix}sf_y_${i}`;
          const gzVar = `${idxPrefix}sf_z_${i}`;
          lines.push(`${gxVar} = ${npArray(grid.x)}`);
          lines.push(`${gyVar} = ${npArray(grid.y)}`);
          lines.push(`${gzVar} = ${np2DArray(grid.z)}`);
          lines.push(`# Note: surface plots expect a regular grid. X and Y are 1D, Z is 2D.`);
          lines.push(`${gxVar}_g, ${gyVar}_g = np.meshgrid(${gxVar}, ${gyVar})`);
          lines.push(`surf = ${axVar}.plot_surface(${gxVar}_g, ${gyVar}_g, ${gzVar}, cmap='${mplColorMap(chartConfig.colorMap)}', edgecolor='none', alpha=${layer.fill ? 0.8 : 1})`);
          lines.push(`cbar = fig.colorbar(surf, ax=${axVar}, shrink=0.5)`);
          const cbarTitle = chartConfig.zAxis?.label || entry.zCol.name;
          lines.push(`cbar.set_label('${pyEscape(cbarTitle)}')`);
        }
        break;
      }
      case 'contour3d': {
        if (entry.zCol) {
          const xVals = colToNumbers(entry.xCol);
          const yVals = colToNumbers(entry.yCol);
          const zVals = colToNumbers(entry.zCol);
          const grid = extractGridData(xVals, yVals, zVals);
          const gxVar = `${idxPrefix}ct_x_${i}`;
          const gyVar = `${idxPrefix}ct_y_${i}`;
          const gzVar = `${idxPrefix}ct_z_${i}`;
          lines.push(`${gxVar} = ${npArray(grid.x)}`);
          lines.push(`${gyVar} = ${npArray(grid.y)}`);
          lines.push(`${gzVar} = ${np2DArray(grid.z)}`);
          lines.push(`${gxVar}_g, ${gyVar}_g = np.meshgrid(${gxVar}, ${gyVar})`);
          lines.push(`${axVar}.contour3D(${gxVar}_g, ${gyVar}_g, ${gzVar}, 50, cmap='${mplColorMap(chartConfig.colorMap)}')`);
        }
        break;
      }
      case 'scatter3d': {
        if (entry.zCol) {
          lines.push(`${axVar}.scatter(${xVar}, ${yVar}, ${zVar}, c='${color}', s=${Math.max(layer.pointSize * 4, 12)}, label=${labelStr})`);
        }
        break;
      }
      case 'bar3d': {
        if (entry.zCol) {
          lines.push(`${axVar}.bar3d(${xVar}, ${yVar}, np.zeros_like(${zVar}), dx=0.5, dy=0.5, dz=${zVar}, color='${color}', alpha=0.8)`);
        }
        break;
      }
      case 'isosurface3d':
      case 'volume3d': {
        lines.push(`# NOTE: '${chartType}' has no direct matplotlib equivalent.`);
        lines.push(`# Data is exported as a scatter3d placeholder; consider using Mayavi or PyVista for true isosurface/volume rendering.`);
        if (entry.zCol) {
          lines.push(`${axVar}.scatter(${xVar}, ${yVar}, ${zVar}, c='${color}', s=${Math.max(layer.pointSize * 4, 12)}, label=${labelStr})`);
        }
        break;
      }
      default: {
        // Fallback: simple line plot
        const marker = mplMarker(layer.pointStyle);
        const markerArg = marker ? `, marker='${marker}', markersize=${layer.pointSize}` : '';
        lines.push(`${targetAx}.plot(${xVar}, ${yVar}, color='${color}', linewidth=${layer.lineWidth}, linestyle='${mplLineStyle(layer.lineStyle)}'${markerArg}, label=${labelStr})`);
      }
    }

    // Error bars (custom column only; statistical grouping not supported in matplotlib export)
    const errCol = layer.errorColumn ? findColumn(entry.ds, layer.errorColumn) : undefined;
    if (errCol && (chartType === 'line' || chartType === 'scatter' || chartType === 'area')) {
      const errVar = `${idxPrefix}${varName('yerr', i)}`;
      lines.push(`${targetAx}.errorbar(${xVar}, ${yVar}, yerr=${errVar}, fmt='none', ecolor='${color}', capsize=3)`);
    } else if (layer.errorPlusColumn && layer.errorMinusColumn && (chartType === 'line' || chartType === 'scatter' || chartType === 'area')) {
      const errPlusVar = `${idxPrefix}${varName('yerr_plus', i)}`;
      const errMinusVar = `${idxPrefix}${varName('yerr_minus', i)}`;
      lines.push(`${targetAx}.errorbar(${xVar}, ${yVar}, yerr=[${errMinusVar}, ${errPlusVar}], fmt='none', ecolor='${color}', capsize=3)`);
    }
  });
  lines.push('');

  // ─── Annotations ──────────────────────────────────────
  const visibleAnnotations = chartConfig.annotations.filter((a) => a.visible);
  if (visibleAnnotations.length > 0) {
    lines.push('# ─── Annotations ──────────────────────────────────────────────');
    visibleAnnotations.forEach((ann, i) => {
      const code = buildAnnotationCode(ann, i, axVar);
      if (code) lines.push(code);
    });
    lines.push('');
  }

  // ─── Axes / labels ────────────────────────────────────
  lines.push('# ─── Axes & labels ────────────────────────────────────────────');
  if (chartConfig.title) {
    lines.push(`${axVar}.set_title('${pyEscape(chartConfig.title)}')`);
  }
  if (!is3D && chartType !== 'pie' && chartType !== 'polar') {
    lines.push(`${axVar}.set_xlabel('${pyEscape(axisLabelText(chartConfig.xAxis.label, chartConfig.xAxis.unit))}')`);
    lines.push(`${axVar}.set_ylabel('${pyEscape(axisLabelText(chartConfig.yAxis.label, chartConfig.yAxis.unit))}')`);
  } else if (is3D) {
    lines.push(`${axVar}.set_xlabel('${pyEscape(axisLabelText(chartConfig.xAxis.label, chartConfig.xAxis.unit))}')`);
    lines.push(`${axVar}.set_ylabel('${pyEscape(axisLabelText(chartConfig.yAxis.label, chartConfig.yAxis.unit))}')`);
    if (chartConfig.zAxis) {
      lines.push(`${axVar}.set_zlabel('${pyEscape(axisLabelText(chartConfig.zAxis.label, chartConfig.zAxis.unit))}')`);
    }
  }

  // Axis ranges
  if (!chartConfig.xAxis.autoRange && chartConfig.xAxis.min !== undefined && chartConfig.xAxis.max !== undefined) {
    lines.push(`${axVar}.set_xlim(${fmtNum(chartConfig.xAxis.min)}, ${fmtNum(chartConfig.xAxis.max)})`);
  }
  if (!chartConfig.yAxis.autoRange && chartConfig.yAxis.min !== undefined && chartConfig.yAxis.max !== undefined) {
    lines.push(`${axVar}.set_ylim(${fmtNum(chartConfig.yAxis.min)}, ${fmtNum(chartConfig.yAxis.max)})`);
  }

  // Log scale
  if (chartConfig.xAxis.logScale) lines.push(`${axVar}.set_xscale('log')`);
  if (chartConfig.yAxis.logScale) lines.push(`${axVar}.set_yscale('log')`);

  // Grid
  if (chartConfig.xAxis.gridVisible || chartConfig.yAxis.gridVisible) {
    lines.push(`${axVar}.grid(True, which='both', linestyle='-', alpha=0.3)`);
  } else {
    lines.push(`${axVar}.grid(False)`);
  }

  // Scientific notation
  if (chartConfig.xAxis.scientificNotation) {
    lines.push(`${axVar}.ticklabel_format(style='sci', axis='x', scilimits=(0, 0))`);
  }
  if (chartConfig.yAxis.scientificNotation) {
    lines.push(`${axVar}.ticklabel_format(style='sci', axis='y', scilimits=(0, 0))`);
  }
  lines.push('');

  // ─── Legend ───────────────────────────────────────────
  if (chartConfig.legend.visible) {
    lines.push('# ─── Legend ────────────────────────────────────────────────────');
    const loc = mplLegendLoc(chartConfig.legend.position);
    lines.push(`${axVar}.legend(loc='${loc}'${chartConfig.legend.bordered ? ', frameon=True' : ', frameon=False'})`);
    lines.push('');
  }
}

/**
 * Main entry point: generate a self-contained matplotlib script from a single chart config + datasets.
 *
 * Emits HEADER → DATA → FIGURE SETUP → TRACES → ANNOTATIONS → AXES/LEGEND → SAVE/SHOW.
 * DATA is emitted via `emitSubplotData` so multi-subplot code paths can reuse the same
 * variable-naming logic; TRACES+TAIL via `emitSubplotTracesAndTail`. The `axVar='ax'` and
 * `idxPrefix=''` arguments preserve the historical single-chart output (legacy variable names
 * like `x_0`, `y_0` and `ax.plot/x.label/...` calls), keeping the snapshot test green.
 */
export function generateMatplotlibScript(
  chartConfig: ChartConfig,
  datasets: Dataset[],
  options: { dpi?: number; filename?: string } = {},
): string {
  const dpi = options.dpi ?? 300;
  const filename = (options.filename ?? chartConfig.title ?? 'chart').replace(/\.py$/i, '') || 'chart';
  const is3D = is3DChart(chartConfig.type);

  const lines: string[] = [];
  lines.push('#!/usr/bin/env python3');
  lines.push('"""');
  lines.push(`Generated by plot3d.xyz`);
  lines.push(`Chart: ${filename}`);
  lines.push('');
  lines.push('Requirements: numpy, matplotlib (pip install numpy matplotlib)');
  lines.push('"""');
  lines.push('import numpy as np');
  lines.push('import matplotlib');
  lines.push('import matplotlib.pyplot as plt');
  if (is3D) {
    lines.push('from mpl_toolkits.mplot3d import Axes3D  # noqa: F401, required for 3D projection');
  }
  lines.push('');

  // ─── Data ─────────────────────────────────────────────
  lines.push('# ─── Data ──────────────────────────────────────────────────────');
  emitSubplotData(lines, chartConfig, datasets, '');
  lines.push('');

  // ─── Figure setup ─────────────────────────────────────
  lines.push('# ─── Figure ────────────────────────────────────────────────────');
  // Approximate figure size from margins (convert px → inches at 96 DPI)
  const figW = (chartConfig.marginLeft + chartConfig.marginRight + 480) / 96;
  const figH = (chartConfig.marginTop + chartConfig.marginBottom + 360) / 96;
  const projection = is3D ? "projection='3d'" : '';
  lines.push(`fig, ax = plt.subplots(figsize=(${figW.toFixed(2)}, ${figH.toFixed(2)})${projection ? ', subplot_kw={' + projection + '}' : ''})`);
  lines.push('');

  // ─── Traces / annotations / axes / legend ─────────────
  emitSubplotTracesAndTail(lines, chartConfig, datasets, 'ax', '');

  // ─── Save & show ──────────────────────────────────────
  lines.push('# ─── Save & show ──────────────────────────────────────────────');
  lines.push('plt.tight_layout()');
  lines.push(`plt.savefig('${pyEscape(filename)}.png', dpi=${dpi}, bbox_inches='tight')`);
  lines.push('plt.show()');
  lines.push('');

  return lines.join('\n');
}

/**
 * Generate a self-contained matplotlib script for a multi-subplot figure.
 *
 * For a 1×1 figure, delegates to `generateMatplotlibScript` (preserves single-chart snapshot).
 * For larger grids, emits a single `fig, axs = plt.subplots(rows, cols, ...)` call, then for
 * each subplot writes data + traces + annotations + axes-tail into the same script, with each
 * subplot's Python variable names prefixed (e.g. `s0_x_0`, `s1_x_0`) to avoid collisions.
 *
 * Mixed 2D+3D grids: matplotlib requires a `projection='3d'` kwarg per-axes. We detect any 3D
 * subplot and, if mixed, fall back to `fig.add_subplot(rows, cols, i+1, projection=...)` per
 * cell instead of `plt.subplots`. All-2D grids use the normal `plt.subplots` path. This mixed
 * branch is best-effort and is not covered by the unit tests.
 */
export function generateFigureMatplotlibScript(
  figure: FigureConfig,
  datasets: Dataset[],
  options: { dpi?: number; filename?: string } = {},
): string {
  if (figure.subplots.length === 1) {
    return generateMatplotlibScript(figure.subplots[0], datasets, options);
  }

  const dpi = options.dpi ?? 300;
  const firstTitle = figure.subplots[0]?.title ?? 'figure';
  const filename = (options.filename ?? firstTitle ?? 'figure').replace(/\.py$/i, '') || 'figure';
  const any3D = figure.subplots.some((s) => is3DChart(s.type));
  // Pick the largest subplot's margins for the overall figure size
  const maxMargins = figure.subplots.reduce(
    (acc, s) => ({
      top: Math.max(acc.top, s.marginTop),
      right: Math.max(acc.right, s.marginRight),
      bottom: Math.max(acc.bottom, s.marginBottom),
      left: Math.max(acc.left, s.marginLeft),
    }),
    { top: 0, right: 0, bottom: 0, left: 0 },
  );
  const figW = (maxMargins.left + maxMargins.right + 480 * figure.cols) / 96;
  const figH = (maxMargins.top + maxMargins.bottom + 360 * figure.rows) / 96;

  const lines: string[] = [];
  lines.push('#!/usr/bin/env python3');
  lines.push('"""');
  lines.push(`Generated by plot3d.xyz`);
  lines.push(`Figure: ${filename} (${figure.rows}x${figure.cols})`);
  lines.push('');
  lines.push('Requirements: numpy, matplotlib (pip install numpy matplotlib)');
  lines.push('"""');
  lines.push('import numpy as np');
  lines.push('import matplotlib');
  lines.push('import matplotlib.pyplot as plt');
  if (any3D) {
    lines.push('from mpl_toolkits.mplot3d import Axes3D  # noqa: F401, required for 3D projection');
  }
  lines.push('');

  // ─── Figure setup ─────────────────────────────────────
  lines.push('# ─── Figure ────────────────────────────────────────────────────');
  if (any3D && !figure.subplots.every((s) => is3DChart(s.type))) {
    // Mixed 2D+3D: create a plain figure and add each axes with its own projection.
    lines.push(`fig = plt.figure(figsize=(${figW.toFixed(2)}, ${figH.toFixed(2)}))`);
    figure.subplots.forEach((cfg, i) => {
      const is3D = is3DChart(cfg.type);
      const proj = is3D ? ", projection='3d'" : '';
      lines.push(`axs${i} = fig.add_subplot(${figure.rows}, ${figure.cols}, ${i + 1}${proj})`);
    });
  } else {
    // All-2D or all-3D: a single plt.subplots call handles it.
    const projection = any3D ? ", subplot_kw={'projection': '3d'}" : '';
    lines.push(`fig, axs = plt.subplots(${figure.rows}, ${figure.cols}, figsize=(${figW.toFixed(2)}, ${figH.toFixed(2)})${projection})`);
    if (figure.rows * figure.cols > 1) {
      lines.push('axs = np.atleast_1d(axs).ravel()');
    }
  }
  lines.push('');

  // ─── Per-subplot bodies ───────────────────────────────
  figure.subplots.forEach((cfg, i) => {
    const axVar = any3D && !figure.subplots.every((s) => is3DChart(s.type))
      ? `axs${i}` // mixed: each cell has its own named axes variable
      : `axs[${i}]`;
    const idxPrefix = `s${i}_`;

    // Data block (with comments noting which subplot these arrays belong to).
    lines.push(`# ─── Subplot ${i + 1} ──────────────────────────────────────────────`);
    emitSubplotData(lines, cfg, datasets, idxPrefix);

    // Traces / annotations / axes / legend.
    emitSubplotTracesAndTail(lines, cfg, datasets, axVar, idxPrefix);
  });

  // ─── Save & show ──────────────────────────────────────
  lines.push('# ─── Save & show ──────────────────────────────────────────────');
  lines.push('fig.tight_layout()');
  lines.push(`plt.savefig('${pyEscape(filename)}.png', dpi=${dpi}, bbox_inches='tight')`);
  lines.push('plt.show()');
  lines.push('');

  return lines.join('\n');
}

/** Trigger a browser download of the generated matplotlib script. */
export function downloadMatplotlibScript(
  chartConfig: ChartConfig,
  datasets: Dataset[],
  options: { dpi?: number; filename?: string } = {},
) {
  const script = generateMatplotlibScript(chartConfig, datasets, options);
  const filename = (options.filename ?? chartConfig.title ?? 'chart').replace(/\.py$/i, '') || 'chart';
  const blob = new Blob([script], { type: 'text/x-python;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = `${filename}.py`;
  link.href = url;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Trigger a browser download of the matplotlib script for a multi-subplot figure. */
export function downloadFigureMatplotlibScript(
  figure: FigureConfig,
  datasets: Dataset[],
  options: { dpi?: number; filename?: string } = {},
) {
  const script = generateFigureMatplotlibScript(figure, datasets, options);
  const firstTitle = figure.subplots[0]?.title ?? 'figure';
  const filename = (options.filename ?? firstTitle).replace(/\.py$/i, '') || 'figure';
  const blob = new Blob([script], { type: 'text/x-python;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = `${filename}.py`;
  link.href = url;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
