import type React from "react";

// Keeps characters that can never be part of the value out of a box, whether typed, pasted or
// filled in by the browser. Text that mixes good and bad characters ("5,000 rupees") goes in with
// the bad ones dropped ("5,000"). The server still checks every value on save; this only spares
// people typing "12abc" and finding out on Save. Spread onto an <input> next to register() or
// value/onChange.

function guard(allowed: RegExp) {
  const one = new RegExp(`^${allowed.source}$`);
  const clean = (text: string) => [...text].filter((ch) => one.test(ch)).join("");
  // Put the cleaned text in as if typed, so React and form libraries see a normal input event.
  const insert = (text: string) => {
    if (text) document.execCommand("insertText", false, text);
  };
  return {
    onBeforeInput(event: React.FormEvent<HTMLInputElement>) {
      const data = (event.nativeEvent as InputEvent).data;
      if (!data || [...data].every((ch) => one.test(ch))) return;
      event.preventDefault();
      insert(clean(data));
    },
    onPaste(event: React.ClipboardEvent<HTMLInputElement>) {
      const text = event.clipboardData.getData("text");
      if (!text || [...text].every((ch) => one.test(ch))) return;
      event.preventDefault();
      insert(clean(text));
    },
  };
}

// Rupee amounts and percentages: digits and a decimal point, plus the commas, spaces and ₹ sign
// people type out of habit ("1,50,000", "₹ 499.50"), which parseRupees understands.
export const amountInputGuards = guard(/[0-9.,₹\s]/);

// Counts: digits only.
export const wholeNumberInputGuards = guard(/[0-9]/);

// A list of counts, like reminder days "14, 3": digits, commas and spaces.
export const numberListInputGuards = guard(/[0-9,\s]/);
