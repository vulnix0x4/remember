import { describe, expect, it } from "vitest";
import { captureRequestSchema } from "../src/imprint";

describe("captureRequestSchema", () => {
  it("accepts either a link or a first-class thought", () => {
    expect(captureRequestSchema.parse({ url: "https://example.com/idea" })).toMatchObject({ url: "https://example.com/idea" });
    expect(captureRequestSchema.parse({ thought: "I do my best work before I start reacting to everyone else." })).toMatchObject({
      thought: "I do my best work before I start reacting to everyone else.",
    });
  });

  it("requires exactly one thing to remember", () => {
    expect(captureRequestSchema.safeParse({}).success).toBe(false);
    expect(captureRequestSchema.safeParse({ url: "https://example.com", thought: "Keep this too" }).success).toBe(false);
  });
});
