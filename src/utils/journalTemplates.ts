import type { ChartConfig, ExportBackground } from '@/types';

/**
 * Journal template definition.
 * Captures figure dimensions, font sizes, margins, and color palette
 * to match common academic journal submission requirements.
 */
export interface JournalTemplate {
  id: string;
  name: string;
  /** Figure width in inches (used to compute pixel dimensions at given DPI). */
  widthInches: number;
  /** Figure height in inches. */
  heightInches: number;
  /** Export DPI (dots per inch). */
  dpi: number;
  /** Base font size in points. */
  fontSize: number;
  /** Plot margins in pixels. */
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
  /** Whether axis grids are visible. */
  gridVisible: boolean;
  /** Whether to use scientific notation on axes. */
  scientificNotation: boolean;
  /** Export background. */
  background: ExportBackground;
  /** Color palette cycled across layers. */
  colorPalette: string[];
}

/**
 * Built-in journal templates.
 * Dimensions follow typical single-column / double-column specs:
 * - Nature: single 89mm (3.5"), double 183mm (7.2")
 * - Science: single ~3.5", double ~7.0"
 * - ACS: single 3.25", double 7.0"
 * - Elsevier: single 90mm (3.54"), double 190mm (7.48")
 * - Angewandte Chemie: similar to single/double column
 */
export const JOURNAL_TEMPLATES: JournalTemplate[] = [
  {
    id: 'nature-single',
    name: 'Nature (Single Column)',
    widthInches: 3.5,
    heightInches: 2.6,
    dpi: 300,
    fontSize: 7,
    marginTop: 28,
    marginRight: 14,
    marginBottom: 32,
    marginLeft: 36,
    gridVisible: true,
    scientificNotation: false,
    background: 'white',
    colorPalette: ['#E64B35', '#4DBBD5', '#00A087', '#3C5488', '#F39B7F', '#8491B4', '#91D1C2', '#DC0000'],
  },
  {
    id: 'nature-double',
    name: 'Nature (Double Column)',
    widthInches: 7.2,
    heightInches: 4.5,
    dpi: 300,
    fontSize: 8,
    marginTop: 32,
    marginRight: 16,
    marginBottom: 36,
    marginLeft: 40,
    gridVisible: true,
    scientificNotation: false,
    background: 'white',
    colorPalette: ['#E64B35', '#4DBBD5', '#00A087', '#3C5488', '#F39B7F', '#8491B4', '#91D1C2', '#DC0000'],
  },
  {
    id: 'science-single',
    name: 'Science (Single Column)',
    widthInches: 3.5,
    heightInches: 2.8,
    dpi: 300,
    fontSize: 7,
    marginTop: 28,
    marginRight: 14,
    marginBottom: 32,
    marginLeft: 36,
    gridVisible: true,
    scientificNotation: false,
    background: 'white',
    colorPalette: ['#0173B2', '#DE8F05', '#029E73', '#CC78BC', '#CA9161', '#FBAFE4', '#949494', '#ECE133'],
  },
  {
    id: 'science-double',
    name: 'Science (Double Column)',
    widthInches: 7.0,
    heightInches: 4.4,
    dpi: 300,
    fontSize: 8,
    marginTop: 32,
    marginRight: 16,
    marginBottom: 36,
    marginLeft: 40,
    gridVisible: true,
    scientificNotation: false,
    background: 'white',
    colorPalette: ['#0173B2', '#DE8F05', '#029E73', '#CC78BC', '#CA9161', '#FBAFE4', '#949494', '#ECE133'],
  },
  {
    id: 'acs-single',
    name: 'ACS (Single Column)',
    widthInches: 3.25,
    heightInches: 2.5,
    dpi: 300,
    fontSize: 7,
    marginTop: 26,
    marginRight: 14,
    marginBottom: 30,
    marginLeft: 34,
    gridVisible: true,
    scientificNotation: false,
    background: 'white',
    colorPalette: ['#0C5DA5', '#00B5B8', '#FF9500', '#FF2A00', '#845B97', '#4795D2', '#FF2A6A', '#3D4B5A'],
  },
  {
    id: 'acs-double',
    name: 'ACS (Double Column)',
    widthInches: 7.0,
    heightInches: 4.3,
    dpi: 300,
    fontSize: 8,
    marginTop: 32,
    marginRight: 16,
    marginBottom: 36,
    marginLeft: 40,
    gridVisible: true,
    scientificNotation: false,
    background: 'white',
    colorPalette: ['#0C5DA5', '#00B5B8', '#FF9500', '#FF2A00', '#845B97', '#4795D2', '#FF2A6A', '#3D4B5A'],
  },
  {
    id: 'elsevier-single',
    name: 'Elsevier (Single Column)',
    widthInches: 3.54,
    heightInches: 2.7,
    dpi: 300,
    fontSize: 7,
    marginTop: 28,
    marginRight: 14,
    marginBottom: 32,
    marginLeft: 36,
    gridVisible: true,
    scientificNotation: false,
    background: 'white',
    colorPalette: ['#1F77B4', '#FF7F0E', '#2CA02C', '#D62728', '#9467BD', '#8C564B', '#E377C2', '#7F7F7F'],
  },
  {
    id: 'elsevier-double',
    name: 'Elsevier (Double Column)',
    widthInches: 7.48,
    heightInches: 4.6,
    dpi: 300,
    fontSize: 8,
    marginTop: 32,
    marginRight: 16,
    marginBottom: 36,
    marginLeft: 40,
    gridVisible: true,
    scientificNotation: false,
    background: 'white',
    colorPalette: ['#1F77B4', '#FF7F0E', '#2CA02C', '#D62728', '#9467BD', '#8C564B', '#E377C2', '#7F7F7F'],
  },
  {
    id: 'angewandte-single',
    name: 'Angew. Chemie (Single)',
    widthInches: 3.5,
    heightInches: 2.6,
    dpi: 300,
    fontSize: 7,
    marginTop: 28,
    marginRight: 14,
    marginBottom: 32,
    marginLeft: 36,
    gridVisible: true,
    scientificNotation: false,
    background: 'white',
    colorPalette: ['#0072BD', '#D95319', '#EDB120', '#7E2F8E', '#77AC30', '#4DBEEE', '#A2142F', '#000000'],
  },
  {
    id: 'angewandte-double',
    name: 'Angew. Chemie (Double)',
    widthInches: 7.0,
    heightInches: 4.4,
    dpi: 300,
    fontSize: 8,
    marginTop: 32,
    marginRight: 16,
    marginBottom: 36,
    marginLeft: 40,
    gridVisible: true,
    scientificNotation: false,
    background: 'white',
    colorPalette: ['#0072BD', '#D95319', '#EDB120', '#7E2F8E', '#77AC30', '#4DBEEE', '#A2142F', '#000000'],
  },
];

const CUSTOM_TEMPLATES_KEY = 'plot3d-custom-templates';

/** Load user-saved custom templates from localStorage. */
export function loadCustomTemplates(): JournalTemplate[] {
  try {
    const raw = localStorage.getItem(CUSTOM_TEMPLATES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((t): t is JournalTemplate =>
      t && typeof t.id === 'string' && typeof t.name === 'string'
    );
  } catch {
    return [];
  }
}

/** Save custom templates to localStorage. */
export function saveCustomTemplates(templates: JournalTemplate[]): void {
  try {
    localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(templates));
  } catch {
    // ignore quota errors
  }
}

/**
 * Apply a journal template to the current chart config, returning a partial
 * config that can be merged. Layer colors are updated from the palette.
 */
export function applyTemplate(
  config: ChartConfig,
  template: JournalTemplate,
): Partial<ChartConfig> {
  const resolutionMultiplier = template.dpi >= 600 ? 4 : template.dpi >= 300 ? 2 : 1;

  return {
    fontSize: template.fontSize,
    marginTop: template.marginTop,
    marginRight: template.marginRight,
    marginBottom: template.marginBottom,
    marginLeft: template.marginLeft,
    xAxis: { ...config.xAxis, gridVisible: template.gridVisible, scientificNotation: template.scientificNotation },
    yAxis: { ...config.yAxis, gridVisible: template.gridVisible, scientificNotation: template.scientificNotation },
    exportConfig: {
      resolutionMultiplier: resolutionMultiplier as 1 | 2 | 4,
      background: template.background,
      figureMultiplier: 1,
    },
    layers: config.layers.map((layer, i) => ({
      ...layer,
      color: template.colorPalette[i % template.colorPalette.length],
    })),
  };
}

/** Create a custom template from the current chart config. */
export function templateFromConfig(
  config: ChartConfig,
  name: string,
  widthInches = 3.5,
  heightInches = 2.6,
): JournalTemplate {
  return {
    id: `custom-${Date.now()}`,
    name,
    widthInches,
    heightInches,
    dpi: config.exportConfig.resolutionMultiplier >= 4 ? 600 : config.exportConfig.resolutionMultiplier >= 2 ? 300 : 150,
    fontSize: config.fontSize,
    marginTop: config.marginTop,
    marginRight: config.marginRight,
    marginBottom: config.marginBottom,
    marginLeft: config.marginLeft,
    gridVisible: config.xAxis.gridVisible,
    scientificNotation: config.xAxis.scientificNotation,
    background: config.exportConfig.background,
    colorPalette: config.layers.map((l) => l.color),
  };
}
