import resourceData from './resources.json' with { type: 'json' };
import programs from './programs.json' with { type: 'json' };

// These sourced records enrich live API results and remain available if it is offline.
export const resources = [...resourceData, ...programs];
