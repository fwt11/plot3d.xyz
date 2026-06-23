import type { ChartConfig } from '@/types';
import { axisLabelText, type ExpandedEntry } from '@/utils/tracesBuilder';

export interface ChartCssVars {
  textColor: string;
  textSecondary: string;
  textMuted: string;
  borderColor: string;
  gridColor: string;
}

/** Build the Plotly layout object from chart config, CSS variables, and other params. */
export function buildLayout(
  chartConfig: ChartConfig,
  cssVars: ChartCssVars,
  is3DType: boolean,
  isNoAxes: boolean,
  isPolar: boolean,
  expandedDatasets: ExpandedEntry[],
  useNumericX: boolean,
): Record<string, unknown> {
  const legendPositionMap: Record<string, { x: number; y: number; xanchor: string; yanchor: string }> = {
    top: { x: 0.5, y: 1.1, xanchor: 'center', yanchor: 'bottom' },
    bottom: { x: 0.5, y: -0.1, xanchor: 'center', yanchor: 'top' },
    left: { x: -0.1, y: 0.5, xanchor: 'right', yanchor: 'middle' },
    right: { x: 1.1, y: 0.5, xanchor: 'left', yanchor: 'middle' },
  };

  const legendPos = legendPositionMap[chartConfig.legend.position] || legendPositionMap.top;

  const result: Record<string, unknown> = {
    title: {
      text: chartConfig.title || '',
      font: { size: 14, color: cssVars.textColor },
      xref: 'paper',
      x: 0.5,
    },
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    font: {
      color: cssVars.textSecondary,
      size: chartConfig.fontSize,
    },
    margin: {
      t: chartConfig.marginTop,
      r: chartConfig.marginRight,
      b: chartConfig.marginBottom,
      l: chartConfig.marginLeft,
    },
    showlegend: chartConfig.legend.visible,
    legend: {
      ...legendPos,
      font: { size: 11, color: cssVars.textSecondary },
      bgcolor: 'transparent',
      borderwidth: 0,
    },
    autosize: true,
  };

  if (is3DType) {
    const sceneConfig: Record<string, unknown> = {
      xaxis: {
        title: { text: axisLabelText(chartConfig.xAxis.label, chartConfig.xAxis.unit), font: { size: chartConfig.fontSize, color: cssVars.textSecondary } },
        gridcolor: chartConfig.xAxis.gridVisible ? cssVars.gridColor : 'transparent',
        zerolinecolor: cssVars.gridColor,
        showgrid: chartConfig.xAxis.gridVisible,
        tickfont: { color: cssVars.textMuted, size: chartConfig.fontSize },
      },
      yaxis: {
        title: { text: axisLabelText(chartConfig.yAxis.label, chartConfig.yAxis.unit), font: { size: chartConfig.fontSize, color: cssVars.textSecondary } },
        gridcolor: chartConfig.yAxis.gridVisible ? cssVars.gridColor : 'transparent',
        zerolinecolor: cssVars.gridColor,
        showgrid: chartConfig.yAxis.gridVisible,
        tickfont: { color: cssVars.textMuted, size: chartConfig.fontSize },
      },
      zaxis: {
        title: { text: axisLabelText(chartConfig.zAxis?.label, chartConfig.zAxis?.unit), font: { size: chartConfig.fontSize, color: cssVars.textSecondary } },
        gridcolor: chartConfig.zAxis?.gridVisible !== false ? cssVars.gridColor : 'transparent',
        zerolinecolor: cssVars.gridColor,
        showgrid: chartConfig.zAxis?.gridVisible !== false,
        tickfont: { color: cssVars.textMuted, size: chartConfig.fontSize },
      },
      bgcolor: 'transparent',
      camera: {
        eye: { x: 1.5, y: 1.5, z: 1.5 },
      },
      aspectmode: 'cube',
    };

    if (!chartConfig.xAxis.autoRange && chartConfig.xAxis.min !== undefined && chartConfig.xAxis.max !== undefined) {
      (sceneConfig.xaxis as Record<string, unknown>).range = [chartConfig.xAxis.min, chartConfig.xAxis.max];
      (sceneConfig.xaxis as Record<string, unknown>).autorange = false;
    }
    if (!chartConfig.yAxis.autoRange && chartConfig.yAxis.min !== undefined && chartConfig.yAxis.max !== undefined) {
      (sceneConfig.yaxis as Record<string, unknown>).range = [chartConfig.yAxis.min, chartConfig.yAxis.max];
      (sceneConfig.yaxis as Record<string, unknown>).autorange = false;
    }
    if (chartConfig.zAxis && !chartConfig.zAxis.autoRange && chartConfig.zAxis.min !== undefined && chartConfig.zAxis.max !== undefined) {
      (sceneConfig.zaxis as Record<string, unknown>).range = [chartConfig.zAxis.min, chartConfig.zAxis.max];
      (sceneConfig.zaxis as Record<string, unknown>).autorange = false;
    }

    result.scene = sceneConfig;
  } else if (!isNoAxes) {
    const hasRightYAxis = expandedDatasets.some((e) => e.layer.yAxisSide === 'right');

    const xAxisConfig: Record<string, unknown> = {
      title: { text: axisLabelText(chartConfig.xAxis.label, chartConfig.xAxis.unit), font: { size: chartConfig.fontSize, color: cssVars.textSecondary } },
      type: chartConfig.xAxis.logScale ? 'log' : (useNumericX ? 'linear' : 'category'),
      gridcolor: chartConfig.xAxis.gridVisible ? cssVars.gridColor : 'transparent',
      gridwidth: 1,
      zerolinecolor: cssVars.gridColor,
      linecolor: cssVars.borderColor,
      tickfont: { color: cssVars.textMuted, size: chartConfig.fontSize },
      exponentformat: chartConfig.xAxis.scientificNotation ? 'e' : 'none',
    };
    if (chartConfig.xAxis.scientificNotation) xAxisConfig.tickformat = '.2e';
    if (!chartConfig.xAxis.autoRange && chartConfig.xAxis.min !== undefined && chartConfig.xAxis.max !== undefined) {
      xAxisConfig.range = [chartConfig.xAxis.min, chartConfig.xAxis.max];
      xAxisConfig.autorange = false;
    }

    const yAxisConfig: Record<string, unknown> = {
      title: { text: axisLabelText(chartConfig.yAxis.label, chartConfig.yAxis.unit), font: { size: chartConfig.fontSize, color: cssVars.textSecondary } },
      type: chartConfig.yAxis.logScale ? 'log' : 'linear',
      gridcolor: chartConfig.yAxis.gridVisible ? cssVars.gridColor : 'transparent',
      gridwidth: 1,
      zerolinecolor: cssVars.gridColor,
      linecolor: cssVars.borderColor,
      tickfont: { color: cssVars.textMuted, size: chartConfig.fontSize },
      exponentformat: chartConfig.yAxis.scientificNotation ? 'e' : 'none',
    };
    if (chartConfig.yAxis.scientificNotation) yAxisConfig.tickformat = '.2e';
    if (!chartConfig.yAxis.autoRange && chartConfig.yAxis.min !== undefined && chartConfig.yAxis.max !== undefined) {
      yAxisConfig.range = [chartConfig.yAxis.min, chartConfig.yAxis.max];
      yAxisConfig.autorange = false;
    }

    result.xaxis = xAxisConfig;
    result.yaxis = yAxisConfig;

    if (hasRightYAxis) {
      const rightAxis = chartConfig.yAxisRight;
      const yaxis2: Record<string, unknown> = {
        title: {
          text: axisLabelText(rightAxis?.label, rightAxis?.unit),
          font: { size: chartConfig.fontSize, color: cssVars.textSecondary },
        },
        overlaying: 'y',
        side: 'right',
        type: rightAxis?.logScale ? 'log' : 'linear',
        gridcolor: rightAxis?.gridVisible ? cssVars.gridColor : 'transparent',
        gridwidth: 1,
        zerolinecolor: cssVars.gridColor,
        linecolor: cssVars.borderColor,
        tickfont: { color: cssVars.textMuted, size: chartConfig.fontSize },
        exponentformat: rightAxis?.scientificNotation ? 'e' : 'none',
        showgrid: rightAxis?.gridVisible ?? false,
      };
      if (rightAxis?.scientificNotation) yaxis2.tickformat = '.2e';
      if (rightAxis && !rightAxis.autoRange && rightAxis.min !== undefined && rightAxis.max !== undefined) {
        yaxis2.range = [rightAxis.min, rightAxis.max];
        yaxis2.autorange = false;
      }
      result.yaxis2 = yaxis2;
    }
  }

  if (isPolar) {
    result.polar = {
      radialaxis: { gridcolor: chartConfig.yAxis.gridVisible ? cssVars.gridColor : 'transparent', tickfont: { color: cssVars.textMuted }, visible: true },
      angularaxis: { gridcolor: chartConfig.xAxis.gridVisible ? cssVars.gridColor : 'transparent', tickfont: { color: cssVars.textMuted } },
    };
    delete result.xaxis;
    delete result.yaxis;
  }

  return result;
}
