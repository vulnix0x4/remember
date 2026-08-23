import { describe, expect, it } from "vitest";
import { UnsafeUrlError, canonicalizeSourceUrl, youtubeTimestampUrl } from "../src";

describe("canonicalizeSourceUrl", () => {
  it.each([
    "https://youtu.be/dQw4w9WgXcQ?si=noise&t=1m2s",
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ&utm_source=test",
    "https://m.youtube.com/shorts/dQw4w9WgXcQ",
  ])("normalizes YouTube form %s", (value) => {
    expect(canonicalizeSourceUrl(value).canonicalUrl).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  });

  it("preserves timestamp as capture context", () => {
    expect(canonicalizeSourceUrl("https://youtu.be/dQw4w9WgXcQ?t=1h2m3s").timestampSeconds).toBe(3_723);
  });

  it("removes tracking and orders remaining parameters", () => {
    expect(canonicalizeSourceUrl("https://Example.com/read/?z=2&utm_source=x&a=1#part").canonicalUrl).toBe(
      "https://example.com/read?a=1&z=2",
    );
  });

  it.each(["file:///etc/passwd", "http://localhost:8787/x", "http://192.168.1.2", "https://user:pass@example.com"])(
    "rejects unsafe URL %s",
    (value) => expect(() => canonicalizeSourceUrl(value)).toThrow(UnsafeUrlError),
  );
});

describe("youtubeTimestampUrl", () => {
  it("adds a source timestamp", () => {
    expect(youtubeTimestampUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ", 93)).toBe(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=93s",
    );
  });
});
