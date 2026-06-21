import type { Dataset, ChartConfig, Scene3DConfig } from '@/types';

/** .plot3d project file format version */
const PROJECT_VERSION = 1;

export interface ProjectFile {
  version: number;
  createdAt: string;
  updatedAt: string;
  datasets: Dataset[];
  chartConfig: ChartConfig;
  scene3D: Scene3DConfig;
  theme: 'light' | 'dark';
  lang: 'zh' | 'en';
}

/** Serialize current application state into a ProjectFile */
export function serializeProject(state: {
  datasets: Dataset[];
  chartConfig: ChartConfig;
  scene3D: Scene3DConfig;
  theme: 'light' | 'dark';
  lang: 'zh' | 'en';
}): ProjectFile {
  return {
    version: PROJECT_VERSION,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    datasets: JSON.parse(JSON.stringify(state.datasets)),
    chartConfig: JSON.parse(JSON.stringify(state.chartConfig)),
    scene3D: JSON.parse(JSON.stringify(state.scene3D)),
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
    typeof obj.chartConfig === 'object' && obj.chartConfig !== null &&
    typeof obj.scene3D === 'object' && obj.scene3D !== null
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
    return data;
  } catch {
    return null;
  }
}
