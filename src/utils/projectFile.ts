import type { Dataset, ChartConfig } from '@/types';

/** .plot3d project file format version */
const PROJECT_VERSION = 2;

export interface ProjectFile {
  version: number;
  createdAt: string;
  updatedAt: string;
  datasets: Dataset[];
  chartConfig: ChartConfig;
  theme: 'light' | 'dark';
  lang: 'zh' | 'en';
}

/** Serialize current application state into a ProjectFile */
export function serializeProject(state: {
  datasets: Dataset[];
  chartConfig: ChartConfig;
  theme: 'light' | 'dark';
  lang: 'zh' | 'en';
}): ProjectFile {
  return {
    version: PROJECT_VERSION,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    datasets: JSON.parse(JSON.stringify(state.datasets)),
    chartConfig: JSON.parse(JSON.stringify(state.chartConfig)),
    theme: state.theme,
    lang: state.lang,
  };
}

/** Validate a parsed object has the shape of a ProjectFile */
export function isValidProjectFile(data: unknown): data is ProjectFile {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.version === 'number' &&
    Array.isArray(obj.datasets) &&
    typeof obj.chartConfig === 'object' && obj.chartConfig !== null
  );
}

/** Save project to a .plot3d JSON file */
export function saveProjectFile(project: ProjectFile, filename: string): void {
  const json = JSON.stringify(project, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const link = document.createElement('a');
  link.download = filename.endsWith('.plot3d') ? filename : `${filename}.plot3d`;
  link.href = URL.createObjectURL(blob);
  link.click();
  URL.revokeObjectURL(link.href);
}

/** Load and parse a .plot3d file, returns ProjectFile or null on error */
export async function loadProjectFile(file: File): Promise<ProjectFile | null> {
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!isValidProjectFile(data)) return null;
    // Migrate v1 files that had scene3D field
    if (data.version === 1) {
      delete (data as unknown as Record<string, unknown>).scene3D;
      data.version = PROJECT_VERSION;
    }
    return data;
  } catch {
    return null;
  }
}
