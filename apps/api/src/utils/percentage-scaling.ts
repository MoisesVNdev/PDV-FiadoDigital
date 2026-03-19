const PERCENTAGE_SCALE = 100;
const RATIO_SCALE = 10000;

export function toStoredPercentage(value: number): number {
  return Math.round(value * PERCENTAGE_SCALE);
}

export function fromStoredPercentage(value: number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  return value / PERCENTAGE_SCALE;
}

export function toStoredRatio(value: number): number {
  return Math.round(value * RATIO_SCALE);
}

export function fromStoredRatio(value: number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  return value / RATIO_SCALE;
}