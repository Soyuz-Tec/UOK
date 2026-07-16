import type { ElementType } from "react";
import {
  Archive,
  Database,
  Monitor,
  Moon,
  ShieldCheck,
  Sun,
} from "lucide-react";

import type { Appearance, Section } from "./types";

export type Option<T extends string> = { id: T; label: string; icon: ElementType };

export const coreSections: Array<Option<Extract<Section, "overview" | "evidence" | "architecture">>> = [
  { id: "overview", label: "Overview", icon: Database },
  { id: "evidence", label: "Evidence", icon: Archive },
  { id: "architecture", label: "Architecture", icon: ShieldCheck }
];

export const appearanceOptions: Array<Option<Appearance>> = [
  { id: "system", label: "System", icon: Monitor },
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon }
];
