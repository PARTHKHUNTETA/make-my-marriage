import { describe, expect, it } from "vitest";
import { escapeHtml, renderEmail } from "./email-templates";

const url = "https://makemymarriage.com/reset-password/abc123TOKEN";

describe("renderEmail", () => {
  it.each([
    ["verify", { name: "Priya", url }],
    ["reset", { name: "Priya", url }],
    [
      "member_invite",
      { inviterName: "Priya", weddingTitle: "Priya weds Aarav", url, expiresInDays: "7" },
    ],
  ])("%s has a subject, html, text and the link in both bodies", (type, payload) => {
    const mail = renderEmail(type, payload);
    expect(mail.subject.length).toBeGreaterThan(5);
    expect(mail.html).toContain(url);
    expect(mail.text).toContain(url);
    expect(mail.html.startsWith("<!doctype html>")).toBe(true);
  });

  it("escapes everything a person typed, so a name cannot inject markup", () => {
    const mail = renderEmail("verify", { name: `<script>alert("x")</script>`, url });
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("&lt;script&gt;");
    expect(mail.html).toContain("&quot;x&quot;");
  });

  it("escapes the wedding title and inviter in an invitation", () => {
    const mail = renderEmail("member_invite", {
      inviterName: `A "B" <i>`,
      weddingTitle: "Tom & Jerry's <b>day</b>",
      url,
      expiresInDays: "7",
    });
    expect(mail.html).not.toContain("<b>day</b>");
    expect(mail.html).toContain("Tom &amp; Jerry&#39;s &lt;b&gt;day&lt;/b&gt;");
  });

  it("keeps the subject on one line even if a name contains line breaks", () => {
    const mail = renderEmail("member_invite", {
      inviterName: "Eve\r\nBcc: attacker@example.com",
      weddingTitle: "Wedding\nTitle",
      url,
      expiresInDays: "7",
    });
    expect(mail.subject).not.toMatch(/[\r\n]/);
    expect(mail.subject).toBe(
      "Eve Bcc: attacker@example.com invited you to help plan Wedding Title",
    );
  });

  it.each(["javascript:alert(1)", "data:text/html,hi", "ftp://x.test/a", "not a url", ""])(
    "refuses to render a link that is not http(s): %s",
    (bad) => {
      expect(() => renderEmail("verify", { name: "P", url: bad })).toThrow();
    },
  );

  it("refuses a payload with missing fields rather than sending a half-empty email", () => {
    expect(() => renderEmail("reset", { name: "P" })).toThrow();
    expect(() => renderEmail("member_invite", { inviterName: "P", url })).toThrow();
    expect(() => renderEmail("reset", undefined)).toThrow();
  });

  it("refuses an unknown email type", () => {
    expect(() => renderEmail("newsletter", {})).toThrow(/Unknown email type/);
  });

  it("states how long each link works", () => {
    expect(renderEmail("verify", { name: "P", url }).text).toContain("24 hours");
    expect(renderEmail("reset", { name: "P", url }).text).toContain("1 hour");
    expect(
      renderEmail("member_invite", { inviterName: "P", weddingTitle: "W", url, expiresInDays: "7" })
        .text,
    ).toContain("7 days");
  });
});

describe("escapeHtml", () => {
  it("escapes the five dangerous characters", () => {
    expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
  });
});

describe("guest emails", () => {
  const events = JSON.stringify([
    {
      name: "Sangeet <b>",
      when: "Saturday, 13 February 2027 at 7:00 PM",
      venue: "Royal Garden",
      address: "1 Palace Road",
      dressCode: "Green traditional",
      mapUrl: "https://www.google.com/maps/search/?api=1&query=Royal%20Garden",
    },
    { name: "Wedding", when: "Sunday, 14 February 2027 at 8:00 PM" },
  ]);
  const base = { guestName: "Rajesh Sharma", couple: "Priya & Aarav", url, events };
  const unsubscribeUrl = "https://makemymarriage.com/unsubscribe/abcTOKEN";

  it("invitation shows each event, the link, and escapes what people typed", () => {
    const mail = renderEmail("invitation", base);
    expect(mail.subject).toBe("You're invited: Priya & Aarav");
    expect(mail.html).toContain(url);
    expect(mail.text).toContain(url);
    expect(mail.html).toContain("Sangeet &lt;b&gt;");
    expect(mail.html).not.toContain("Sangeet <b>");
    expect(mail.text).toContain("Dress code: Green traditional");
    expect(mail.text).toContain("Venue to be announced"); // an event with no venue
    expect(mail.html).toContain("google.com/maps");
    expect(mail.html).not.toContain("nsubscribe"); // an invitation is not a reminder
  });

  it.each(["rsvp_reminder", "event_reminder"])("%s carries a working unsubscribe link", (type) => {
    const mail = renderEmail(type, { ...base, unsubscribeUrl });
    expect(mail.html).toContain(unsubscribeUrl);
    expect(mail.text).toContain(unsubscribeUrl);
  });

  it("subjects are one line and name the event for tomorrow's reminder", () => {
    const mail = renderEmail("event_reminder", { ...base, unsubscribeUrl });
    expect(mail.subject).toContain("Tomorrow:");
    expect(mail.subject).not.toMatch(/[\r\n]/);
  });

  it("refuses a reminder with no unsubscribe link, or broken events", () => {
    expect(() => renderEmail("rsvp_reminder", base)).toThrow();
    expect(() => renderEmail("invitation", { ...base, events: "not json" })).toThrow();
    expect(() => renderEmail("invitation", { ...base, events: "[]" })).toThrow();
    expect(() => renderEmail("invitation", { ...base, url: "javascript:alert(1)" })).toThrow();
  });
});
