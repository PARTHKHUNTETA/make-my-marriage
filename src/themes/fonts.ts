import {
  Cinzel,
  Cormorant_Garamond,
  DM_Sans,
  Great_Vibes,
  Lato,
  Lora,
  Marcellus,
  Montserrat,
  Nunito,
  Playfair_Display,
  Yeseva_One,
} from "next/font/google";

// The wedding website fonts (see FONT_PAIRS in kit.ts). Not preloaded: a site uses two or three of
// these, and the browser fetches only the faces the page actually uses. next/font reads each call's
// options at build time, so they are written out in full every time.
const cinzel = Cinzel({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  weight: ["400", "600"],
  variable: "--font-cinzel",
});
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
});
const greatVibes = Great_Vibes({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  weight: "400",
  variable: "--font-great-vibes",
});
const lato = Lato({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  weight: ["400", "700"],
  variable: "--font-lato",
});
const playfair = Playfair_Display({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  weight: ["400", "600"],
  style: ["normal", "italic"],
  variable: "--font-playfair",
});
const marcellus = Marcellus({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  weight: "400",
  variable: "--font-marcellus",
});
const lora = Lora({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  weight: ["400", "600"],
  variable: "--font-lora",
});
const montserrat = Montserrat({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  weight: ["500", "700", "800"],
  variable: "--font-montserrat",
});
const dmSans = DM_Sans({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  weight: ["400", "500", "700"],
  variable: "--font-dm-sans",
});
const yeseva = Yeseva_One({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  weight: "400",
  variable: "--font-yeseva",
});
const nunito = Nunito({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  weight: ["400", "600", "700"],
  variable: "--font-nunito",
});

// Put on the site's root element so every font variable is defined there.
export const siteFontVariables = [
  cinzel,
  cormorant,
  greatVibes,
  lato,
  playfair,
  marcellus,
  lora,
  montserrat,
  dmSans,
  yeseva,
  nunito,
]
  .map((f) => f.variable)
  .join(" ");
