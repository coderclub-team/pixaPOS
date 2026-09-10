class Mutex {
  private locks: Map<string, Promise<void>> = new Map();

  async acquire(key: string): Promise<() => void> {
    const previous = this.locks.get(key) || Promise.resolve();
    let resolve: () => void;
    const current = new Promise<void>((r) => {
      resolve = r;
    });

    this.locks.set(key, current);

    await previous;

    return () => {
      if (this.locks.get(key) === current) {
        this.locks.delete(key);
      }
      resolve();
    };
  }
}

export const entityMutex = new Mutex();
