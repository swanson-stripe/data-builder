/**
 * Performance instrumentation utilities
 * Tracks timing marks for measuring app responsiveness
 */

export const perf = {
  marks: new Map<string, number>(),

  /**
   * Mark a point in time for later measurement
   * @param name - Identifier for this mark
   */
  mark(name: string) {
    this.marks.set(name, performance.now());
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      console.log(`[PERF] Mark: ${name} at ${Math.round(performance.now())}ms`);
    }
  },

  /**
   * Calculate time elapsed since a mark
   * @param name - Identifier of the mark
   * @returns Milliseconds elapsed, or -1 if mark not found
   */
  since(name: string): number {
    const t = this.marks.get(name);
    return t ? Math.round(performance.now() - t) : -1;
  },

  /**
   * Log time elapsed since a mark
   * @param name - Identifier of the mark
   * @param label - Optional label for the log
   */
  logSince(name: string, label?: string) {
    const elapsed = this.since(name);
    if (elapsed >= 0 && typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      console.log(`[PERF] ${label || name}: ${elapsed}ms`);
    }
    return elapsed;
  },

  /**
   * Clear all marks
   */
  clear() {
    this.marks.clear();
  }
};
