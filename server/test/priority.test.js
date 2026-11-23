import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startBy, hoursLeft, rank, level, reason, HOUR } from '../../shared/priority.js';

const now = Date.parse('2026-11-12T00:00:00Z');
const at = (h) => new Date(now + h * HOUR).toISOString();
const task = (o) => ({ id: o.id || 'x', title: 'T', course: 'C', weight: 10, difficulty: 'medium', hours: null, progress: 0, done: false, ...o });

test('effort comes from difficulty unless the student set hours', () => {
  assert.equal(hoursLeft(task({ difficulty: 'hard' })), 6);
  assert.equal(hoursLeft(task({ difficulty: 'hard', hours: 10 })), 10);
});

test('"Already started" reduces work left and moves start-by later (C2)', () => {
  const t = task({ deadline: at(48), difficulty: 'hard' });
  const before = startBy(t).getTime();
  const after = startBy({ ...t, progress: 50 }).getTime();
  assert.equal(after - before, 6 * HOUR); // 3 h less work × factor 2
});

test('"Deadline extended" moves start-by by the same amount (C1)', () => {
  const t = task({ deadline: at(20) });
  assert.equal(startBy({ ...t, deadline: at(44) }) - startBy(t), 24 * HOUR);
});

test('passed start-by ranks first and shows START NOW', () => {
  const late = task({ id: 'late', deadline: at(5), difficulty: 'hard', weight: 5 });
  const big = task({ id: 'big', deadline: at(100), weight: 40 });
  const r = rank([big, late], [], now);
  assert.equal(r[0].task.id, 'late');
  assert.equal(level(late, now), 'now');
});

test('the student order wins, and is marked as moved', () => {
  const a = task({ id: 'a', deadline: at(10) });
  const b = task({ id: 'b', deadline: at(90) });
  const r = rank([a, b], ['b', 'a'], now);
  assert.deepEqual(r.map((x) => x.task.id), ['b', 'a']);
  assert.equal(r[0].moved, true);
});

test('done tasks leave the list', () => {
  assert.equal(rank([task({ done: true, deadline: at(3) })], [], now).length, 0);
});

test('reason uses the fixed template', () => {
  const t = task({ deadline: at(18), difficulty: 'hard', weight: 15 });
  assert.equal(reason(t, now), 'Finish in 18 h · 15% of grade · not started');
});
