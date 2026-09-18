export function createRafBatcher() {
  let handle = 0;
  return function schedule(fn: () => void): void {
    if (handle) {
      return;
    }
    handle = requestAnimationFrame(() => {
      handle = 0;
      fn();
    });
  };
}

export function createThrottle<T extends (...args: never[]) => void>(
  fn: T,
  ms: number,
): T & { flush: () => void; cancel: () => void } {
  let last = 0;
  let timer: number | null = null;
  let pending: Parameters<T> | null = null;

  const invoke = (args: Parameters<T>) => {
    last = Date.now();
    pending = null;
    fn(...args);
  };

  const throttled = ((...args: Parameters<T>) => {
    const now = Date.now();
    const remaining = ms - (now - last);
    pending = args;
    if (remaining <= 0) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      invoke(args);
      return;
    }
    if (!timer) {
      timer = window.setTimeout(() => {
        timer = null;
        if (pending) {
          invoke(pending);
        }
      }, remaining);
    }
  }) as T & { flush: () => void; cancel: () => void };

  throttled.flush = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (pending) {
      invoke(pending);
    }
  };
  throttled.cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    pending = null;
  };

  return throttled;
}

/** Rough guidance for when to skip expensive extras (handles, shadows). */
export function isLargeScene(elementCount: number): boolean {
  return elementCount > 250;
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}
