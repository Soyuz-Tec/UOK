const constraintTypes = [
  ["", "No constraint"],
  ["must_start_on", "Must start on"],
  ["must_finish_on", "Must finish on"],
  ["start_no_earlier_than", "Start no earlier than"],
  ["start_no_later_than", "Start no later than"],
  ["finish_no_earlier_than", "Finish no earlier than"],
  ["finish_no_later_than", "Finish no later than"],
];

export function PlanningTaskConstraintFields({ type, date, onTypeChange, onDateChange }: {
  type: string;
  date: string;
  onTypeChange: (value: string) => void;
  onDateChange: (value: string) => void;
}) {
  return (
    <>
      <label className="field"><span>Constraint</span><select aria-label="Task constraint" value={type} onChange={(event) => onTypeChange(event.target.value)}>
        {constraintTypes.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
      </select></label>
      <label className="field"><span>Constraint date</span><input aria-label="Task constraint date" type="date" value={date} onChange={(event) => onDateChange(event.target.value)} /></label>
    </>
  );
}
