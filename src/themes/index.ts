import type { Theme } from "@/modules/wedding/schema";
import { classical } from "./classical/theme";
import { minimal } from "./minimal/theme";
import { modern } from "./modern/theme";
import type { SiteTheme } from "./types";

export const themes: Record<Theme, SiteTheme> = { classical, minimal, modern };
