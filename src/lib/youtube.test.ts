import { describe, expect, it } from "vitest";
import { parseYouTube } from "./youtube";

const ID = "dQw4w9WgXcQ";

describe("parseYouTube", () => {
  it.each([
    `https://www.youtube.com/watch?v=${ID}`,
    `https://youtube.com/watch?v=${ID}&t=42s`,
    `https://m.youtube.com/watch?v=${ID}`,
    `https://youtu.be/${ID}`,
    `https://youtu.be/${ID}?si=abc123`,
    `https://www.youtube.com/live/${ID}`,
    `https://www.youtube.com/live/${ID}?feature=share`,
    `  https://www.youtube.com/watch?v=${ID}  `,
    `http://www.youtube.com/watch?v=${ID}`,
  ])("accepts %s", (link) => {
    expect(parseYouTube(link)?.videoId).toBe(ID);
  });

  it("rebuilds clean addresses from the id alone", () => {
    expect(parseYouTube(`https://youtu.be/${ID}?si=tracking&x=<script>`)).toEqual({
      videoId: ID,
      watchUrl: `https://www.youtube.com/watch?v=${ID}`,
      embedUrl: `https://www.youtube-nocookie.com/embed/${ID}`,
    });
  });

  it.each([
    "",
    "not a link",
    `https://example.com/watch?v=${ID}`,
    `https://youtube.com.evil.com/watch?v=${ID}`,
    `https://evil.com/?u=https://youtube.com/watch?v=${ID}`,
    `https://notyoutube.com/live/${ID}`,
    `https://user:pass@www.youtube.com/watch?v=${ID}`,
    `javascript:alert(1)`,
    `ftp://www.youtube.com/watch?v=${ID}`,
    `https://www.youtube.com/watch`,
    `https://www.youtube.com/watch?v=short`,
    `https://www.youtube.com/watch?v=${ID}extra`,
    `https://www.youtube.com/channel/${ID}`,
    `https://www.youtube.com/embed/${ID}`,
    `https://youtu.be/`,
    `https://www.youtube.com/live/`,
  ])("refuses %s", (link) => {
    expect(parseYouTube(link)).toBeNull();
  });
});
