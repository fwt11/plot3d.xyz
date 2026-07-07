// Drive detectColumnType + buildLayout through Vitest (no DOM needed) to
// confirm the real xlsx in /home/fwt/Downloads/request-usage-2026-07-07.xlsx
// gets parsed as a date column.
import { describe, it, expect } from 'vitest';
import XLSX from 'xlsx';
import { readFileSync } from 'node:fs';
import { enrichColumns, colToDateMs, colToXValues } from '../src/utils/tracesBuilder';
import { buildLayout, LIGHT_CHART_CSS_VARS } from '../src/utils/layoutBuilder';
import type { ChartConfig, DataColumn } from '../src/types';

const FILE = '/home/fwt/Downloads/request-usage-2026-07-07.xlsx';

describe('real-world xlsx — request-usage-2026-07-07.xlsx', () => {
  it('parses the time column as date and credits column as number', () => {
    const wb = XLSX.read(readFileSync(FILE));
    const ws = wb.Sheets[wb.SheetNames[0]];
    // Mirror FileTab's call exactly (no `raw` option).
    const rows = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1 });
    expect(rows[0]).toEqual(['时间', '积分消耗']);

    const headers = rows[0] as string[];
    const cols: DataColumn[] = enrichColumns(headers.map((h, i) => ({
      id: `c${i}`,
      name: h || `Col${i + 1}`,
      type: (i === 0 ? 'X' : i === 1 ? 'Y' : 'Z') as DataColumn['type'],
      values: rows.slice(1).map((row) => row[i] ?? ''),
    })));

    expect(cols[0].valueType).toBe('date');
    expect(cols[1].valueType).toBe('number');
    console.log(
      `[xlsx-date-test] row count=${rows.length - 1}, x.valueType=${cols[0].valueType}, y.valueType=${cols[1].valueType}`,
    );
    console.log(
      `[xlsx-date-test] sample x values: ${JSON.stringify(cols[0].values.slice(0, 3))}`,
    );

    // layoutBuilder should now select 'date' type for x axis under useNumericX=true.
    const cfg: ChartConfig = {
      id: 'c1',
      type: 'line',
      title: 'Usage',
      xAxis: {
        label: 'Time',
        autoRange: true,
        gridVisible: true,
        logScale: false,
        scientificNotation: false,
      },
      yAxis: {
        label: 'Credits',
        autoRange: true,
        gridVisible: true,
        logScale: false,
        scientificNotation: false,
      },
      legend: { visible: false, position: 'top' },
      colorMap: 'viridis',
      layers: [],
      annotations: [],
      marginTop: 60,
      marginRight: 60,
      marginBottom: 60,
      marginLeft: 60,
      exportConfig: { resolutionMultiplier: 2, background: 'theme', figureMultiplier: 1 },
      fontSize: 12,
    };
    const expanded = [
      {
        layer: {
          id: 'l1', datasetId: 'd1', xColumn: 'c0', yColumn: 'c1',
          color: '#000', visible: true,
          lineStyle: 'solid' as const, lineWidth: 1,
          pointStyle: 'circle' as const, pointSize: 4,
          fill: false,
        },
        xCol: cols[0],
        yCol: cols[1],
      },
    ];
    const layout = buildLayout(cfg, LIGHT_CHART_CSS_VARS, false, false, false, expanded as never, true);
    const xaxis = layout.xaxis as { type: string; timezone?: string; tickformatstops?: unknown[] };
    expect(xaxis.type).toBe('date');
    expect(xaxis.timezone).toBe('UTC');
    expect(Array.isArray(xaxis.tickformatstops)).toBe(true);
    console.log(
      `[xlsx-date-test] xaxis.type=${xaxis.type} timezone=${xaxis.timezone} tickformatstops.length=${(xaxis.tickformatstops ?? []).length}`,
    );

    // Round-trip: colToDateMs should turn the same strings into valid epoch ms.
    const ms = colToDateMs(cols[0]);
    const finite = ms.filter((v) => Number.isFinite(v));
    expect(finite.length).toBeGreaterThan(700);
    console.log(
      `[xlsx-date-test] valid epoch ms count: ${finite.length} / ${ms.length}`,
    );
    expect(finite.length).toBe(ms.length);

    // Simulating SubplotView's per-trace x computation: with the buggy
    // `colToNumbers` path, every x value would be NaN and the chart would
    // render empty (the bug the user just hit). With `colToXValues`, all 716
    // are finite epoch ms.
    const xForPlotly = colToXValues(cols[0]);
    const xFinite = xForPlotly.filter((v) => Number.isFinite(v)).length;
    expect(xFinite).toBe(xForPlotly.length);
    expect(xFinite).toBeGreaterThan(700);
    console.log(
      `[xlsx-date-test] x values fed into Plotly trace: ${xFinite} finite / ${xForPlotly.length}`,
    );
  });
});
