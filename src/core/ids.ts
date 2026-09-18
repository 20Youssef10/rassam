let counter = 0;

export function createId(prefix = "el"): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}
