// Mock for wxt/utils/storage
// Use a module-level Map that can be cleared between tests
let mockStorage = new Map<string, unknown>();

export const storage = {
  defineItem: <T>(key: string, options?: { fallback: T }) => ({
    getValue: async () => {
      const value = mockStorage.get(key);
      if (value === undefined) {
        return options?.fallback;
      }
      return value as T;
    },
    setValue: async (value: T) => {
      mockStorage.set(key, value);
    },
    watch: () => {},
    removeValue: async () => {
      mockStorage.delete(key);
    },
  }),
};

// Helper functions for tests
export function clearMockStorage() {
  mockStorage = new Map<string, unknown>();
}

export function setMockStorageValue(key: string, value: unknown) {
  mockStorage.set(key, value);
}

export function getMockStorageValue(key: string) {
  return mockStorage.get(key);
}

// Reset function that clears the internal map reference
export function resetMockStorage() {
  mockStorage.clear();
}
