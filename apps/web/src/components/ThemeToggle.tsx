import { Monitor, Moon, Sun } from "lucide-react";
import { ThemeChoice, useTheme } from "../lib/theme";

const order: ThemeChoice[] = ["light", "dark", "system"];
const meta = {
  light: { Icon: Sun, label: "Light theme" },
  dark: { Icon: Moon, label: "Dark theme" },
  system: { Icon: Monitor, label: "Match system theme" },
};

/** One-tap cycle: light → dark → system. */
export function ThemeToggle({ className = "icon-button ghost", tipPos }: { className?: string; tipPos?: "top" }) {
  const [choice, setChoice] = useTheme();
  const { Icon, label } = meta[choice];
  const next = order[(order.indexOf(choice) + 1) % order.length];
  return (
    <button
      type="button"
      className={className}
      aria-label={`${label}. Switch to ${meta[next].label.toLowerCase()}`}
      data-tip={label}
      data-tip-pos={tipPos}
      onClick={() => setChoice(next)}
    >
      <Icon size={17} />
    </button>
  );
}

/** Segmented picker for menus. */
export function ThemePicker() {
  const [choice, setChoice] = useTheme();
  return (
    <div className="segmented" role="group" aria-label="Theme">
      {order.map((value) => {
        const { Icon, label } = meta[value];
        return (
          <button key={value} type="button" aria-pressed={choice === value} aria-label={label} onClick={() => setChoice(value)}>
            <Icon size={15} />
            <span className="capitalize" style={{ fontSize: 12.5, color: "inherit" }}>{value}</span>
          </button>
        );
      })}
    </div>
  );
}
