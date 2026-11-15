import { Monitor, Moon, Sun } from "lucide-react";
import type { ThemeChoice } from "../lib/storage";
import { useTheme } from "../lib/theme";
import { SegmentedControl, type Segment } from "./ui";

const SEGMENTS: Segment<ThemeChoice>[] = [
  { value: "system", label: "System theme", icon: <Monitor className="lucide" /> },
  { value: "light", label: "Light theme", icon: <Sun className="lucide" /> },
  { value: "dark", label: "Dark theme", icon: <Moon className="lucide" /> },
];

export function ThemeSwitch() {
  const [theme, setTheme] = useTheme();
  return <SegmentedControl label="Theme" segments={SEGMENTS} value={theme} onChange={setTheme} iconsOnly />;
}
