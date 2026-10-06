import { describe, expect, it } from "vitest";
import { DEFAULT_WHATSAPP_MESSAGE, renderWhatsappMessage, whatsappLink } from "./whatsapp";

describe("renderWhatsappMessage", () => {
  const values = { name: "Rajesh Sharma", link: "https://app.test/i/abc", couple: "Priya & Aarav" };
  it("fills the placeholders in the standard message", () => {
    expect(renderWhatsappMessage(DEFAULT_WHATSAPP_MESSAGE, values)).toBe(
      "Dear Rajesh Sharma, we would love to have you celebrate our wedding with us! View your invitation here: https://app.test/i/abc — Priya & Aarav",
    );
  });
  it("does not let a guest's name inject another placeholder", () => {
    expect(renderWhatsappMessage("Hi {name} {link}", { ...values, name: "{link}" })).toBe(
      "Hi {link} https://app.test/i/abc",
    );
  });
});

describe("whatsappLink", () => {
  it("opens a chat with the guest when there is a phone", () => {
    expect(whatsappLink("+91 98765 43210", "Hi there & welcome")).toBe(
      "https://wa.me/919876543210?text=Hi%20there%20%26%20welcome",
    );
  });
  it("opens the contact picker without one", () => {
    expect(whatsappLink(undefined, "Hi")).toBe("https://wa.me/?text=Hi");
  });
});
