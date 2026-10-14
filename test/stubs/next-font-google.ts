// next/font/google is compiled by Next at build time; in plain Node tests every font is a stub
// with a variable class named after the font.
type Font = { className: string; variable: string; style: { fontFamily: string } };
const font =
  (name: string) =>
  (options: { variable?: string } = {}): Font => ({
    className: `font-${name}`,
    variable: options.variable ? `var-${options.variable.replace(/^--/, "")}` : "",
    style: { fontFamily: name },
  });

export const Cinzel = font("Cinzel");
export const Cormorant_Garamond = font("Cormorant Garamond");
export const DM_Sans = font("DM Sans");
export const Great_Vibes = font("Great Vibes");
export const Lato = font("Lato");
export const Lora = font("Lora");
export const Marcellus = font("Marcellus");
export const Montserrat = font("Montserrat");
export const Nunito = font("Nunito");
export const Playfair_Display = font("Playfair Display");
export const Yeseva_One = font("Yeseva One");
