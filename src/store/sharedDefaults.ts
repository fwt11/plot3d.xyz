import { createSampleSineDataset } from '@/utils/sampleData';

// Module-level singleton. Extracted to break the circular import between
// chartStore.ts (which exposes it) and datasetStore.ts (which reads it).
export const sharedDefaultDataset = createSampleSineDataset();
