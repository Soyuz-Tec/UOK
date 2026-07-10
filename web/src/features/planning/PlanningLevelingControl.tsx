import { Users } from "lucide-react";
import { useState } from "react";

import { CommandButton } from "../../shared/primitives";

const defaultHorizonDays = 260;
const maximumHorizonDays = 1095;

export function PlanningLevelingControl({
  busy,
  disabled,
  onLevel,
}: {
  busy: boolean;
  disabled: boolean;
  onLevel: (horizonDays: number) => void;
}) {
  const [horizonDays, setHorizonDays] = useState(defaultHorizonDays);
  const horizonValid = Number.isInteger(horizonDays) && horizonDays >= 1 && horizonDays <= maximumHorizonDays;
  return (
    <div className="planning-leveling-control">
      <label>
        <span>Level horizon</span>
        <input
          aria-label="Leveling horizon working days"
          type="number"
          min={1}
          max={maximumHorizonDays}
          value={horizonDays}
          onChange={(event) => setHorizonDays(Number(event.target.value))}
        />
        <small>working days</small>
      </label>
      <CommandButton
        icon={Users}
        onClick={() => onLevel(horizonDays)}
        loading={busy}
        disabled={disabled || !horizonValid}
      >
        Level
      </CommandButton>
    </div>
  );
}
