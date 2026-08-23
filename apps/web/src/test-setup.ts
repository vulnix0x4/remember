import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

Object.defineProperty(window, "scrollTo", { writable: true, value: vi.fn() });

const storage = new Map<string, string>();
const localStorageMock: Storage = {
  get length() { return storage.size; },
  clear: () => storage.clear(),
  getItem: (key) => storage.get(key) ?? null,
  key: (index) => Array.from(storage.keys())[index] ?? null,
  removeItem: (key) => { storage.delete(key); },
  setItem: (key, value) => { storage.set(key, String(value)); },
};
Object.defineProperty(window, "localStorage", { configurable: true, value: localStorageMock });
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: localStorageMock });

if (!globalThis.crypto.randomUUID) {
  Object.defineProperty(globalThis.crypto, "randomUUID", { value: () => "test-imprint-id" });
}
