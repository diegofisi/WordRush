import { useState } from 'react';

import type { Dictionary } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';

import cloud from '../../data/cloud.json';
import circuit from '../../data/readout-circuit.json';
import edges from '../../data/readout-edges.json';
import type { BossViewModel } from '../../models/boss-view.model';
import { FlyScene } from './FlyScene';
import { CLOUD_MODES, type CloudMode } from './cloud-modes';
import { NeuronCloud3D, type CloudState } from './NeuronCloud3D';
import { DecisionNetwork, SCOPE, SpikeRaster, VoltageHistogram } from './ScopePanels';

interface BossInstrumentProps {
  t: Dictionary;
  boss: BossViewModel;
}

const Label = ({ children }: { children: React.ReactNode }) => (
  <p
    className="m-0 font-mono text-[9.5px] tracking-[0.16em] uppercase"
    style={{ color: SCOPE.ink3 }}
  >
    {children}
  </p>
);

const Note = ({ children }: { children: React.ReactNode }) => (
  <p className="m-0 font-mono text-[9px] leading-relaxed" style={{ color: SCOPE.ink3 }}>
    {children}
  </p>
);

const Stat = ({ label, value, unit }: { label: string; value: string; unit: string }) => (
  <div
    className="flex flex-col gap-0.5 rounded border px-2.5 py-2"
    style={{ background: SCOPE.panel, borderColor: SCOPE.line }}
  >
    <span
      className="font-mono text-[8.5px] tracking-[0.1em] uppercase"
      style={{ color: SCOPE.ink3 }}
    >
      {label}
    </span>
    <span className="font-mono text-lg tabular-nums" style={{ color: SCOPE.neural }}>
      {value}
    </span>
    <span className="font-mono text-[8.5px]" style={{ color: SCOPE.ink3 }}>
      {unit}
    </span>
  </div>
);

/** A small square control, on when `active`. */
const Toggle = ({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className="rounded border px-2 py-1 font-mono text-[9px] tracking-[0.1em] uppercase transition-colors"
    style={{
      borderColor: active ? SCOPE.neural : SCOPE.line,
      color: active ? SCOPE.neural : SCOPE.ink3,
      background: active ? 'rgba(79,214,207,0.08)' : 'transparent',
    }}
  >
    {label}
  </button>
);

const Box = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div
    className={cn('overflow-hidden rounded-md border', className)}
    style={{ background: SCOPE.panel, borderColor: SCOPE.line }}
  >
    {children}
  </div>
);

/**
 * The instrument. Same shape as the design canvas, but every number is measured
 * on the brain that is running right now, not generated for the picture
 * (docs/context/08-boss-mode.md).
 *
 * It draws what it is given and nothing else: the page around it owns the
 * connection, so the same component serves the brain tab and anything else that
 * can hand it a `BossViewModel`.
 */
export const BossInstrument = ({ t, boss }: BossInstrumentProps) => {
  const [mode, setMode] = useState<CloudMode>('transmitter');
  const [orbit, setOrbit] = useState(true);
  // Read straight off the buffer the renderer is drawing, several times a
  // second: it is the state of the model, not a number about the model.
  const [live, setLive] = useState<CloudState>({ mean: 0, firing: 0 });

  const decision = boss.decision;
  const snapshot = decision?.telemetry ?? null;
  const frame = boss.frame;

  // The live slice wins wherever it exists; the decision snapshot is the
  // fallback for the first moments and for the panels only it carries.
  const telemetry = snapshot
    ? {
        ...snapshot,
        ...(frame
          ? {
              voltage: frame.voltage,
              raster: frame.raster,
              descending: frame.descending,
              letterPreference:
                frame.letters.length > 0 ? frame.letters : snapshot.letterPreference,
              excitatory: frame.excitatory,
              inhibitory: frame.inhibitory,
              populations: snapshot.populations.map((population, index) => ({
                name: population.name,
                hz: frame.populations[index] ?? population.hz,
              })),
            }
          : {}),
      }
    : null;
  const motorHz = telemetry?.populations.find((p) => p.name === 'motor')?.hz ?? 0;
  const balance = telemetry ? telemetry.excitatory + telemetry.inhibitory || 1 : 1;
  const excitatory = telemetry ? Math.round((telemetry.excitatory / balance) * 100) : 0;
  const liveMs = frame ? `${frame.biologicalMs} / ${frame.wallMs}` : null;
  // The window the picture actually covers: a live slice, or the decision.
  const windowMs = frame?.biologicalMs ?? decision?.biologicalMs ?? 150;

  return (
    <section
      className="flex w-full max-w-[1400px] flex-col gap-4 rounded-2xl border px-4 py-4 sm:px-6"
      style={{ background: SCOPE.bg, color: SCOPE.ink, borderColor: SCOPE.line }}
      aria-label={t.boss.brainTitle}
    >
      <header className="flex flex-wrap items-center gap-3">
        <span className="font-display text-lg font-extrabold">{t.boss.name}</span>
        <span
          className="rounded border px-2 py-1 font-mono text-[9.5px] tracking-[0.1em] uppercase"
          style={{ borderColor: SCOPE.line, color: SCOPE.ink2 }}
        >
          {telemetry
            ? `${telemetry.neurons.toLocaleString()} · ${telemetry.synapses.toLocaleString()} · flywire 783`
            : t.boss.noBrain}
        </span>
        <span
          className="rounded border px-2 py-1 font-mono text-[9.5px] tracking-[0.1em] uppercase"
          style={{ borderColor: SCOPE.line, color: SCOPE.ink2 }}
        >
          {decision ? t.boss.action[decision.action] : '—'}
        </span>
      </header>

      {!telemetry ? (
        <p className="m-0 text-sm" style={{ color: SCOPE.ink2 }}>
          {t.boss.noBrain}
        </p>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
            <div className="flex flex-col gap-1.5">
              <Box className="h-[320px]">
                <FlyScene motorHz={motorHz} typing={decision?.typing ?? ''} />
              </Box>
              <Note>{t.boss.flyNote(Math.round(motorHz))}</Note>
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <Label>{t.boss.cloud}</Label>
                <div className="ml-auto flex gap-1.5">
                  <Toggle
                    label={t.boss.mode[mode]}
                    active
                    onClick={() =>
                      setMode(
                        CLOUD_MODES[(CLOUD_MODES.indexOf(mode) + 1) % CLOUD_MODES.length] ??
                          'transmitter',
                      )
                    }
                  />
                  <Toggle
                    label={orbit ? t.boss.orbitOn : t.boss.orbitOff}
                    active={orbit}
                    onClick={() => setOrbit(!orbit)}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 font-mono text-[9.5px]">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: frame ? SCOPE.neural : SCOPE.ink3 }}
                  aria-hidden="true"
                />
                <span style={{ color: frame ? SCOPE.neural : SCOPE.ink3 }}>
                  {frame ? t.boss.stateLive : t.boss.stateHeld}
                </span>
                <span style={{ color: SCOPE.ink2 }}>
                  {t.boss.stateMean(live.mean.toFixed(3), live.firing)}
                </span>
              </div>
              <Box className="h-[360px]">
                <NeuronCloud3D
                  telemetry={telemetry}
                  bits={frame?.cloud ?? null}
                  mode={mode}
                  orbit={orbit}
                  onState={setLive}
                />
              </Box>
              <Note>
                {t.boss.cloudNote(
                  cloud.count,
                  frame ? live.firing : telemetry.cloud.length,
                  windowMs,
                )}
              </Note>
              <Note>{t.boss.modeNote[mode](circuit.edges.from.length)}</Note>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_1.15fr_0.9fr]">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>{t.boss.raster}</Label>
                <Box className="h-[150px]">
                  <SpikeRaster telemetry={telemetry} windowMs={windowMs} />
                </Box>
                <Note>{t.boss.rasterNote(telemetry.raster.length, windowMs)}</Note>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t.boss.voltage}</Label>
                <Box className="h-[96px]">
                  <VoltageHistogram telemetry={telemetry} />
                </Box>
                <Note>{t.boss.voltageNote}</Note>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Stat
                  label={t.boss.balance}
                  value={`${excitatory} / ${100 - excitatory}`}
                  unit={t.boss.balanceUnit}
                />
                <Stat
                  label={t.boss.bio}
                  value={liveMs ?? String(decision?.biologicalMs ?? 0)}
                  unit={liveMs ? t.boss.live : t.boss.bioUnit(decision?.wallMs ?? 0)}
                />
                <Stat
                  label={t.boss.confidenceLabel}
                  value={(decision?.confidence ?? 0).toFixed(2)}
                  unit={t.boss.confidenceUnit}
                />
                <Stat
                  label={t.boss.letters}
                  value={(decision?.letters ?? [])[0] ?? '—'}
                  unit={t.boss.lettersUnit}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>{t.boss.network}</Label>
              <Box className="h-[430px]">
                <DecisionNetwork telemetry={telemetry} />
              </Box>
              <div className="flex flex-wrap justify-between gap-2">
                <Note>
                  {edges.inputs} → {edges.outputs} ·{' '}
                  {t.boss.params(edges.inputs * edges.outputs + edges.outputs, edges.samples)}
                </Note>
                <Note>
                  <span style={{ color: SCOPE.neural }}>●</span> {t.boss.excites}{' '}
                  <span style={{ color: SCOPE.inhib }}>●</span> {t.boss.inhibits}
                </Note>
              </div>
              <Note>{t.boss.networkNote}</Note>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>{t.boss.populations}</Label>
                {telemetry.populations.map((population) => (
                  <div key={population.name} className="flex items-center gap-2">
                    <span className="w-24 font-mono text-[10px]" style={{ color: SCOPE.ink2 }}>
                      {population.name}
                    </span>
                    <div
                      className="h-1.5 flex-1 overflow-hidden rounded-full"
                      style={{ background: SCOPE.line }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(100, population.hz * 1.6)}%`,
                          background: SCOPE.neural,
                        }}
                      />
                    </div>
                    <span
                      className="w-10 text-right font-mono text-[10px] tabular-nums"
                      style={{ color: SCOPE.neural }}
                    >
                      {population.hz}
                    </span>
                  </div>
                ))}
                <Note>{t.boss.populationsNote}</Note>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>{t.boss.stimulus}</Label>
                <div className="grid grid-cols-5 gap-1.5">
                  {[0, 1, 2, 3, 4].map((slot) => {
                    const rates = telemetry.stimulus.slice(slot * 4, slot * 4 + 4);
                    const hz = Math.max(0, ...rates);
                    const state = rates.indexOf(hz);
                    const tone =
                      state === 0
                        ? '#3fa66b'
                        : state === 1
                          ? '#e5b537'
                          : state === 2
                            ? '#3a444e'
                            : SCOPE.line;
                    return (
                      <div
                        key={slot}
                        className="flex flex-col items-center gap-1 rounded border px-1 py-1.5"
                        style={{ background: SCOPE.panel, borderColor: SCOPE.line }}
                      >
                        <span className="font-mono text-[8.5px]" style={{ color: SCOPE.ink3 }}>
                          {slot + 1}
                        </span>
                        <span className="h-3 w-full rounded-sm" style={{ background: tone }} />
                        <span
                          className="font-mono text-[8.5px] tabular-nums"
                          style={{ color: SCOPE.neural }}
                        >
                          {hz.toFixed(0)}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <Note>{t.boss.stimulusNote}</Note>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>{t.boss.wants}</Label>
                <div className="flex flex-wrap gap-1">
                  {(decision?.letters ?? []).map((letter, index) => (
                    <span
                      key={letter}
                      className="flex h-7 w-7 items-center justify-center rounded font-display text-xs font-bold"
                      style={{
                        background: index === 0 ? SCOPE.neural : SCOPE.panel,
                        color: index === 0 ? SCOPE.bg : SCOPE.ink2,
                        border: `1px solid ${SCOPE.line}`,
                      }}
                    >
                      {letter}
                    </span>
                  ))}
                </div>
                <Note>{t.boss.wantsNote}</Note>
              </div>
            </div>
          </div>

          {/* How she was trained, on the same page as what she does with it. */}
          <div className="flex flex-col gap-2 border-t pt-3" style={{ borderColor: SCOPE.line }}>
            <Label>{t.boss.training}</Label>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <Stat
                label={t.boss.trainShape}
                value={`${edges.inputs}·${edges.outputs}`}
                unit={t.boss.trainShapeUnit}
              />
              <Stat
                label={t.boss.trainSamples}
                value={String(edges.samples)}
                unit={t.boss.trainSamplesUnit}
              />
              <Stat
                label={t.boss.trainError}
                value={edges.heldOutError.toFixed(3)}
                unit={t.boss.trainErrorUnit(edges.flatError.toFixed(3))}
              />
              <Stat
                label={t.boss.trainGain}
                value={`${(((edges.flatError - edges.heldOutError) / edges.flatError) * 100).toFixed(1)}%`}
                unit={t.boss.trainGainUnit}
              />
            </div>
            <Note>{t.boss.trainTeacher}</Note>
            <Note>{t.boss.trainHint}</Note>
            <Note>{t.boss.trainFixed}</Note>
            <Note>{t.boss.trainWhen(edges.trainedAt, edges.lambda)}</Note>
          </div>

          <p
            className="m-0 border-t pt-3 font-mono text-[9px] leading-relaxed"
            style={{ borderColor: SCOPE.line, color: SCOPE.ink3 }}
          >
            {t.boss.provenance}
          </p>
        </>
      )}
    </section>
  );
};
