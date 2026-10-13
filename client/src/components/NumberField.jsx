import { useState } from 'react';

// Keeps its own text while you type, so partial entries like "3" (on the
// way to "32") aren't immediately clamped to the minimum; commits on
// blur or Enter.
export default function NumberField({ value, display, step, onCommit, ...inputProps }) {
  const [draft, setDraft] = useState(null);

  function commit() {
    const n = parseFloat(draft);
    setDraft(null);
    if (Number.isFinite(n)) onCommit(n);
  }

  return (
    <input
      {...inputProps}
      type="number"
      step={step}
      value={draft ?? display(value)}
      onFocus={() => setDraft(display(value))}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
    />
  );
}
