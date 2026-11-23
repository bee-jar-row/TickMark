/** Date -> value for <input type="datetime-local"> in the student's own time zone */
export function toLocalInput(d) {
  d = new Date(d);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
