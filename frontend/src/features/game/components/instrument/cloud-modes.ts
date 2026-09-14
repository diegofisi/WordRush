/** How the brain is drawn. Its own file so the renderer stays fast-refreshable. */
export type CloudMode =
  /** Every cell in its own neurotransmitter's colour: the anatomy as it is. */
  | 'transmitter'
  /** The brain as a dim atlas, with only what is firing picked out by sign. */
  | 'atlas'
  /** Only the decision network's 64 cells and the real synapses between them. */
  | 'circuit';

/** The cycle order of the mode button. The index is what the shader branches on. */
export const CLOUD_MODES: CloudMode[] = ['transmitter', 'atlas', 'circuit'];
