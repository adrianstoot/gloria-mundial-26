/** Stable 32-bit FNV-1a hash so string seeds behave identically in every runtime. */
export function hashSeed(seed: number | string): number {
  if (typeof seed === 'number') {
    const value = Number.isFinite(seed) ? seed : 0
    return (Math.trunc(value) >>> 0) || 0x6d2b79f5
  }

  let hash = 0x811c9dc5
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0) || 0x6d2b79f5
}

/** Mulberry32 PRNG. Small, reproducible and suitable for gameplay (not cryptography). */
export class DeterministicRandom {
  private state: number

  constructor(seed: number | string) {
    this.state = hashSeed(seed)
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0
    let value = this.state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296
  }

  float(min = 0, max = 1): number {
    return min + (max - min) * this.next()
  }

  int(min: number, max: number): number {
    const low = Math.ceil(Math.min(min, max))
    const high = Math.floor(Math.max(min, max))
    return low + Math.floor(this.next() * (high - low + 1))
  }

  chance(probability: number): boolean {
    return this.next() < Math.max(0, Math.min(1, probability))
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Cannot pick from an empty collection')
    return items[this.int(0, items.length - 1)] as T
  }

  shuffle<T>(items: readonly T[]): T[] {
    const result = [...items]
    for (let index = result.length - 1; index > 0; index -= 1) {
      const other = this.int(0, index)
      ;[result[index], result[other]] = [result[other] as T, result[index] as T]
    }
    return result
  }

  fork(label: number | string): DeterministicRandom {
    return new DeterministicRandom(`${this.state}:${String(label)}`)
  }

  getState(): number {
    return this.state >>> 0
  }
}

