// Fit result export utilities: CSV, LaTeX equation, clipboard text.
// Operates on the FitResult shape used by FitTab.

import type { FitStatistics } from '@/utils/curveFitting';

export interface FitExportData {
  type: string;
  equation: string;
  rSquared: number;
  adjustedRSquared: number;
  rmse: number;
  mae: number;
  residualSE: number;
  n: number;
  dof: number;
  stats: FitStatistics;
}

/** Build a CSV string of the fit parameters table. */
export function fitResultToCSV(data: FitExportData): string {
  const lines: string[] = [];
  lines.push(`# Fit Type,${data.type}`);
  lines.push(`# Equation,${data.equation}`);
  lines.push(`# R²,${data.rSquared.toFixed(6)}`);
  lines.push(`# Adjusted R²,${data.adjustedRSquared.toFixed(6)}`);
  lines.push(`# RMSE,${data.rmse.toFixed(6)}`);
  lines.push(`# MAE,${data.mae.toFixed(6)}`);
  lines.push(`# Residual SE,${data.residualSE.toFixed(6)}`);
  lines.push(`# N,${data.n}`);
  lines.push(`# DoF,${data.dof}`);
  lines.push('');
  lines.push('Parameter,Estimate,Std Error,CI95 Low,CI95 High');
  data.stats.parameterNames.forEach((name, i) => {
    const est = data.stats.parameterEstimates[i];
    const se = data.stats.parameterSE[i];
    const ci = data.stats.parameterCI[i];
    lines.push(
      `${name},${est.toFixed(6)},${Number.isFinite(se) ? se.toFixed(6) : 'NA'},${Number.isFinite(se) ? ci[0].toFixed(6) : 'NA'},${Number.isFinite(se) ? ci[1].toFixed(6) : 'NA'}`
    );
  });
  return lines.join('\n');
}

/** Convert the plain-text equation string to a LaTeX-formatted equation.
 *  Handles common patterns: y =, x^N, e^(...), ln(x), sqrt, etc. */
export function equationToLatex(equation: string): string {
  let latex = equation;
  // Replace x^N with x^{N} for multi-digit exponents
  latex = latex.replace(/x\^(\d+)/g, 'x^{$1}');
  // Replace e^(...) — keep as is, Plotly-style already uses e^(...)
  // Replace ln(x) with \ln(x)
  latex = latex.replace(/\bln\(/g, '\\ln(');
  // Replace exp(...) with \exp(...)
  latex = latex.replace(/\bexp\(/g, '\\exp(');
  // Replace sqrt(...) with \sqrt{...}
  latex = latex.replace(/\bsqrt\(/g, '\\sqrt{');
  // Replace ² (superscript 2) with ^{2}
  latex = latex.replace(/²/g, '^{2}');
  // Wrap in display math
  return `$$ ${latex} $$`;
}

/** Build a plain-text summary suitable for clipboard. */
export function fitResultToText(data: FitExportData): string {
  const lines: string[] = [];
  lines.push(`Fit Type: ${data.type}`);
  lines.push(`Equation: ${data.equation}`);
  lines.push(`LaTeX: ${equationToLatex(data.equation)}`);
  lines.push('');
  lines.push('Statistics:');
  lines.push(`  R² = ${data.rSquared.toFixed(6)}`);
  lines.push(`  Adjusted R² = ${data.adjustedRSquared.toFixed(6)}`);
  lines.push(`  RMSE = ${data.rmse.toFixed(6)}`);
  lines.push(`  MAE = ${data.mae.toFixed(6)}`);
  lines.push(`  Residual SE = ${data.residualSE.toFixed(6)}`);
  lines.push(`  N = ${data.n}`);
  lines.push(`  DoF = ${data.dof}`);
  lines.push('');
  lines.push('Parameters:');
  lines.push('  Name\tEstimate\tStd Error\tCI95 Low\tCI95 High');
  data.stats.parameterNames.forEach((name, i) => {
    const est = data.stats.parameterEstimates[i];
    const se = data.stats.parameterSE[i];
    const ci = data.stats.parameterCI[i];
    lines.push(
      `  ${name}\t${est.toFixed(6)}\t${Number.isFinite(se) ? se.toFixed(6) : 'NA'}\t${Number.isFinite(se) ? ci[0].toFixed(6) : 'NA'}\t${Number.isFinite(se) ? ci[1].toFixed(6) : 'NA'}`
    );
  });
  return lines.join('\n');
}

/** Trigger a browser download of a text blob. */
export function downloadTextFile(content: string, filename: string, mime = 'text/plain;charset=utf-8'): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
