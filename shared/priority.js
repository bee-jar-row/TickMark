// TickMark Priority Engine — shared by the server (alerts) and the client (ranked list).
// Predictive, rule-based and fully transparent: every number shown in the UI comes from here.
//
//   effort  = hours the student typed, or the guess from difficulty (easy 2 h, medium 4 h, hard 6 h)
//   left    = effort × (100 − % done) / 100
//   startBy = deadline − left × START_FACTOR   (a student only gets about half their awake time for one task)
//   urgency = (grade % + 5) ÷ hours until start-by;  a passed start-by always goes to the top

export const HOUR = 3600e3;
export const DIFF_HOURS = { easy: 2, medium: 4, hard: 6 };
export const START_FACTOR = 2;

export function effort(t) {
  return t.hours != null ? Number(t.hours) : DIFF_HOURS[t.difficulty] ?? DIFF_HOURS.medium;
}

export function hoursLeft(t) {
  return Math.max(0, (effort(t) * (100 - (t.progress || 0))) / 100);
}

export function startBy(t) {
  return new Date(new Date(t.deadline).getTime() - hoursLeft(t) * START_FACTOR * HOUR);
}

export function urgency(t, now = Date.now()) {
  const hrs = (startBy(t).getTime() - now) / HOUR;
  if (hrs <= 0) return 10000 + t.weight - hrs; // start time passed: most urgent first
  return (t.weight + 5) / Math.max(hrs, 0.5);
}

/** 'now' | 'today' | 'later' | 'done' — shown with a shape + word, never colour alone */
export function level(t, now = Date.now()) {
  if (t.done) return 'done';
  const hrs = (startBy(t).getTime() - now) / HOUR;
  if (hrs <= 0) return 'now';
  if (hrs <= 24) return 'today';
  return 'later';
}

export function statusText(t) {
  return !t.progress ? 'not started' : `${t.progress}% done`;
}

export function fmtHours(h) {
  if (h < 0) return 'overdue';
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  if (h < 36) return `${Math.round(h)} h`;
  return `${Math.round(h / 24)} days`;
}

export function fmtDate(d, { withDate = true, now = new Date() } = {}) {
  d = new Date(d);
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  if (now.toDateString() === d.toDateString()) return `today ${time}`;
  const day = d.toLocaleDateString('en-GB', { weekday: 'short' });
  if (!withDate) return `${day} ${time}`;
  const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return `${day} ${date}, ${time}`;
}

/** The one-line reason, filled from a fixed template (no free text generation). */
export function reason(t, now = Date.now()) {
  const toDue = (new Date(t.deadline).getTime() - now) / HOUR;
  const lead =
    level(t, now) === 'later'
      ? `Start by ${fmtDate(startBy(t), { withDate: false, now: new Date(now) })}`
      : toDue < 0
        ? 'Deadline passed'
        : `Finish in ${fmtHours(toDue)}`;
  return `${lead} · ${t.weight}% of grade · ${statusText(t)}`;
}

/**
 * Rank open tasks. `manual` is the order the student set by hand (ids).
 * Tasks the student placed keep their order; new tasks slot in by urgency.
 * Returns [{ task, moved }] where moved = the student's order differs from the app's.
 */
export function rank(tasks, manual = [], now = Date.now()) {
  const open = tasks.filter((t) => !t.done);
  const auto = [...open].sort((a, b) => urgency(b, now) - urgency(a, now));
  const placed = manual.map((id) => open.find((t) => t.id === id)).filter(Boolean);
  const out = [...placed];
  for (const t of auto) {
    if (placed.includes(t)) continue;
    let k = out.findIndex((o) => urgency(o, now) < urgency(t, now));
    if (k < 0) k = out.length;
    out.splice(k, 0, t);
  }
  const autoIdx = new Map(auto.map((t, i) => [t.id, i]));
  return out.map((task, i) => ({ task, moved: autoIdx.get(task.id) !== i }));
}
