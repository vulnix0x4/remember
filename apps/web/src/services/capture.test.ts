import { describe, expect, it } from "vitest";
import { imprints } from "../fixtures";
import { buildCaptureDraft } from "./capture";

describe("buildCaptureDraft", () => {
  it("saves plain words as a thought", () => {
    const result = buildCaptureDraft("The first quiet hour matters", [], "t1");
    expect(result.kind).toBe("thought");
    if (result.kind === "thought") expect(result.draft).toMatchObject({ id: "t1", sourceType: "Thought", noteText: "The first quiet hour matters", url: "remember://thought/t1" });
  });
  it("saves a link and keeps the other words as a note", () => {
    const result = buildCaptureDraft("https://youtube.com/watch?v=abc so good for mornings", [], "l1");
    expect(result.kind).toBe("link");
    if (result.kind === "link") expect(result.draft).toMatchObject({ sourceType: "YouTube", title: "New YouTube save", url: "https://youtube.com/watch?v=abc", personalReaction: "so good for mornings" });
  });
  it("accepts bare domains and upgrades http", () => {
    const bare = buildCaptureDraft("example.com/post", []);
    expect(bare.kind === "link" && bare.draft.url).toBe("https://example.com/post");
    const insecure = buildCaptureDraft("http://example.com/a", []);
    expect(insecure.kind === "link" && insecure.draft.url).toBe("https://example.com/a");
  });
  it("recognizes TikTok links", () => {
    const result = buildCaptureDraft("https://www.tiktok.com/@scout2015/video/6718335390845095173", []);
    expect(result.kind === "link" && result.draft.title).toBe("New TikTok save");
  });
  it("refuses a duplicate", () => {
    expect(buildCaptureDraft(imprints[0].url, imprints)).toEqual({ kind: "error", message: "You already saved this. It’s in your library." });
  });
});
