import { useEffect, useRef } from 'react';

import type { BossTelemetry } from '@/shared/contract';

import edges from '../../data/readout-edges.json';

/**
 * The instrument's canvases. The scope keeps its own dark palette in both
 * themes on purpose: it is a measuring screen, and a measuring screen does not
 * go white. Everything drawn here arrives measured from the running model.
 */

export const SCOPE = {
  bg: '#101418',
  panel: '#161c22',
  line: '#262f39',
  ink: '#e0e8ef',
  ink2: '#8d9bab',
  ink3: '#5c6b7a',
  neural: '#4fd6cf',
  neuralHot: '#b6fff9',
  inhib: '#f0876a',
} as const;

const NEURAL_RGB = '126, 232, 224';
const INHIB_RGB = '240, 135, 106';

function prepare(canvas: HTMLCanvasElement | null) {
  if (!canvas) return null;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);
  return { ctx, w: rect.width, h: rect.height };
}

/**
 * One row per descending cell, one tick per spike. `windowMs` is the span the
 * spike times were measured over: 150 ms for a decision, 20 ms for a live
 * slice. Getting it wrong squeezes every spike into the left edge.
 */
export const SpikeRaster = ({
  telemetry,
  windowMs,
}: {
  telemetry: BossTelemetry;
  windowMs: number;
}) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const prepared = prepare(ref.current);
    if (!prepared) return;
    const { ctx, w, h } = prepared;
    const rows = telemetry.raster;
    if (rows.length === 0) return;
    const rowH = h / rows.length;
    ctx.fillStyle = 'rgba(92,107,122,0.16)';
    for (let i = 1; i < rows.length; i += 2) ctx.fillRect(0, i * rowH, w, rowH);
    ctx.fillStyle = `rgba(${NEURAL_RGB},0.92)`;
    rows.forEach((spikes, i) => {
      for (const at of spikes) {
        ctx.fillRect((at / windowMs) * w, i * rowH + rowH * 0.2, 1.5, rowH * 0.6);
      }
    });
    ctx.fillStyle = 'rgba(92,107,122,0.75)';
    ctx.font = '8px monospace';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < rows.length; i += 4) ctx.fillText(`c${i}`, 2, i * rowH + rowH / 2);
  }, [telemetry, windowMs]);
  return <canvas ref={ref} className="block h-full w-full" />;
};

/** Membrane voltage across all 138,639 neurons. */
export const VoltageHistogram = ({ telemetry }: { telemetry: BossTelemetry }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const prepared = prepare(ref.current);
    if (!prepared) return;
    const { ctx, w, h } = prepared;
    const bins = telemetry.voltage;
    if (bins.length === 0) return;
    const max = Math.max(1, ...bins);
    const bw = w / bins.length;
    bins.forEach((value, i) => {
      const share = value / max;
      const bh = share * (h - 14);
      ctx.fillStyle = `rgba(79,214,207,${(0.28 + share * 0.6).toFixed(2)})`;
      ctx.fillRect(i * bw + 0.5, h - 11 - bh, bw - 1, bh);
    });
    const at = ((-45 - -54) / (-43 - -54)) * w;
    ctx.strokeStyle = `rgba(${INHIB_RGB},0.85)`;
    ctx.beginPath();
    ctx.moveTo(at, 0);
    ctx.lineTo(at, h - 11);
    ctx.stroke();
    ctx.fillStyle = 'rgba(92,107,122,0.9)';
    ctx.font = '8px monospace';
    ctx.textBaseline = 'bottom';
    ctx.fillText('−54', 2, h - 1);
    ctx.fillStyle = `rgba(${INHIB_RGB},0.95)`;
    ctx.fillText('umbral −45 mV', at - 30, h - 1);
  }, [telemetry]);
  return <canvas ref={ref} className="block h-full w-full" />;
};

/**
 * The trained readout, drawn with its own weights: descending rates in, 27
 * letters out, one linear matrix and nothing between. Teal edges excite, coral
 * ones inhibit, and the brightness of every node is its real activation this
 * turn.
 */
export const DecisionNetwork = ({ telemetry }: { telemetry: BossTelemetry }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const prepared = prepare(ref.current);
    if (!prepared) return;
    const { ctx, w, h } = prepared;
    // The panel has room to label 16 inputs. The readout reads all 1,299
    // descending cells; drawing them all would be a pixel a row, so it draws
    // the first 16 and says so rather than letting the picture imply otherwise.
    const rows = 16;
    const letters = telemetry.letterPreference;
    const descending = telemetry.descending;
    if (letters.length === 0) return;

    // Two columns, because the readout is one matrix: there is no hidden layer
    // any more, and drawing one would be drawing something that is not there.
    const xName = 6;
    const xValue = w * 0.2;
    const xIn = w * 0.26;
    const xOut = w * 0.82;
    const topIn = 26;
    const gapIn = (h - 42) / (rows - 1);
    const topOut = 22;
    const gapOut = (h - 34) / (letters.length - 1);
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZÑ';

    ctx.font = '9px monospace';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = SCOPE.ink3;
    ctx.textAlign = 'left';
    ctx.fillText(`DESCENDENTES Hz · ${rows} de ${edges.inputs}`, xName, 12);
    ctx.textAlign = 'center';
    ctx.fillText('LETRAS', xOut, 12);

    // Every line is one real weight of the fitted matrix, input to letter.
    for (let i = 0; i < rows; i += 1) {
      const y = topIn + i * gapIn;
      const strength = Math.min(1, (descending[i] ?? 0) / 160);
      for (let l = 0; l < letters.length; l += 1) {
        const weight = edges.w[l * edges.shownInputs + i] ?? 0;
        const alpha = (0.01 + strength * Math.min(1, Math.abs(weight) * 12)).toFixed(3);
        ctx.strokeStyle =
          weight > 0 ? `rgba(${NEURAL_RGB},${alpha})` : `rgba(${INHIB_RGB},${alpha})`;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(xIn + 4, y);
        ctx.lineTo(xOut - 8, topOut + l * gapOut);
        ctx.stroke();
      }
    }

    ctx.font = '9px monospace';
    for (let i = 0; i < rows; i += 1) {
      const y = topIn + i * gapIn;
      ctx.fillStyle = SCOPE.ink2;
      ctx.textAlign = 'left';
      ctx.fillText(`c${i < 10 ? '0' : ''}${i}`, xName, y);
      ctx.fillStyle = '#c8d4de';
      ctx.textAlign = 'right';
      ctx.fillText(String(Math.round(descending[i] ?? 0)), xValue, y);
      ctx.beginPath();
      ctx.arc(xIn, y, 2.6, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${NEURAL_RGB},${(0.24 + Math.min(1, (descending[i] ?? 0) / 160) * 0.76).toFixed(2)})`;
      ctx.fill();
    }
    const best = letters.indexOf(Math.max(...letters));
    for (let l = 0; l < letters.length; l += 1) {
      const y = topOut + l * gapOut;
      const value = letters[l] ?? 0;
      ctx.beginPath();
      ctx.arc(xOut, y, l === best ? 4.6 : 3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${NEURAL_RGB},${(0.15 + value * 0.85).toFixed(2)})`;
      ctx.fill();
      ctx.textAlign = 'left';
      ctx.fillStyle = l === best ? SCOPE.neuralHot : value > 0.55 ? SCOPE.ink : SCOPE.ink3;
      ctx.font = l === best ? 'bold 9px monospace' : '9px monospace';
      ctx.fillText(alphabet[l] ?? '', xOut + 8, y);
    }
  }, [telemetry]);
  return <canvas ref={ref} className="block h-full w-full" />;
};
