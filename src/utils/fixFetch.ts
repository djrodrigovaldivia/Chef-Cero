// Fix for iframe and sandboxed environments where Window.prototype.fetch has only a getter without a setter
(function () {
  try {
    const globalObj: any =
      typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
        ? globalThis
        : null;

    if (!globalObj) return;

    const currentFetch = globalObj.fetch;

    // 1. Prototype level patch if Window.prototype exists
    if (typeof Window !== 'undefined' && Window.prototype) {
      try {
        const protoDesc = Object.getOwnPropertyDescriptor(Window.prototype, 'fetch');
        if (protoDesc && (!protoDesc.set || !protoDesc.writable)) {
          const protoGetter = protoDesc.get;
          let storedFetch = currentFetch;
          Object.defineProperty(Window.prototype, 'fetch', {
            get() {
              return storedFetch || (protoGetter ? protoGetter.call(this) : currentFetch);
            },
            set(newVal) {
              storedFetch = newVal;
            },
            configurable: true,
            enumerable: true,
          });
        }
      } catch {
        // Ignore if prototype is sealed
      }
    }

    // 2. Window instance level patch
    try {
      const winDesc = Object.getOwnPropertyDescriptor(globalObj, 'fetch');
      if (!winDesc || !winDesc.set || !winDesc.writable) {
        let localFetch = currentFetch;
        Object.defineProperty(globalObj, 'fetch', {
          get() {
            return localFetch;
          },
          set(newVal) {
            localFetch = newVal;
          },
          configurable: true,
          enumerable: true,
        });
      }
    } catch {
      // Ignore if window is sealed
    }
  } catch {
    // Top level safe guard
  }
})();

export {};
