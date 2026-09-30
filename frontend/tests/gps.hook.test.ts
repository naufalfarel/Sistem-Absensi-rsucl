import assert from "node:assert/strict";
import * as React from "react";
import { useRealtimeGps, isLocationUsable } from "../src/hooks/useRealtimeGps";

// Run the production hook with a controlled React dispatcher and simulated
// browser Geolocation API. No physical iPhone/Android sensor is involved.
const internal = (React as any).__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
const originalDispatcher = internal.ReactCurrentDispatcher.current;
const originalNow = Date.now;
const originalSetTimeout = globalThis.setTimeout;
const originalClearTimeout = globalThis.clearTimeout;
const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");

type Timer = { at: number; callback: () => void };
let time = 1_800_000_000_000;
let timerSequence = 0;
const timers = new Map<number, Timer>();
const watches = new Map<number, (position: GeolocationPosition) => void>();
const failures = new Map<number, (error: GeolocationPositionError) => void>();
let watchSequence = 0;
let lastOptions: PositionOptions | undefined;

function depsEqual(left?: readonly unknown[], right?: readonly unknown[]) {
  return Boolean(left && right && left.length === right.length && left.every((v, i) => Object.is(v, right[i])));
}

function setup() {
  time = 1_800_000_000_000;
  timers.clear();
  watches.clear();
  failures.clear();
  let cells: any[] = [];
  let cursor = 0;
  let snapshot: ReturnType<typeof useRealtimeGps>;
  let renderQueued = false;
  const pendingEffects: Array<() => void> = [];
  const scheduleRender = () => {
    if (renderQueued) return;
    renderQueued = true;
    queueMicrotask(() => { renderQueued = false; render(); });
  };
  const dispatcher = {
    useState(initial: unknown) {
      const slot = cursor++;
      if (!(slot in cells)) cells[slot] = typeof initial === "function" ? (initial as () => unknown)() : initial;
      return [cells[slot], (next: unknown) => {
        cells[slot] = typeof next === "function" ? (next as (value: unknown) => unknown)(cells[slot]) : next;
        scheduleRender();
      }];
    },
    useRef(initial: unknown) {
      const slot = cursor++;
      if (!(slot in cells)) cells[slot] = { current: initial };
      return cells[slot];
    },
    useCallback(callback: unknown, deps?: readonly unknown[]) {
      const slot = cursor++;
      if (!(slot in cells) || !depsEqual(cells[slot].deps, deps)) cells[slot] = { callback, deps };
      return cells[slot].callback;
    },
    useEffect(effect: () => void | (() => void), deps?: readonly unknown[]) {
      const slot = cursor++;
      if (!(slot in cells) || !depsEqual(cells[slot].deps, deps)) {
        const cleanup = cells[slot]?.cleanup;
        if (cleanup) pendingEffects.push(cleanup);
        cells[slot] = { deps, cleanup: undefined };
        pendingEffects.push(() => { cells[slot].cleanup = effect(); });
      }
    },
  };
  function render() {
    cursor = 0;
    internal.ReactCurrentDispatcher.current = dispatcher;
    snapshot = useRealtimeGps();
    while (pendingEffects.length) pendingEffects.shift()!();
  }
  Date.now = () => time;
  globalThis.setTimeout = ((callback: () => void, delay = 0) => {
    const id = ++timerSequence;
    timers.set(id, { at: time + delay, callback });
    return id;
  }) as typeof setTimeout;
  globalThis.clearTimeout = ((id?: number) => { if (id !== undefined) timers.delete(id); }) as typeof clearTimeout;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { geolocation: {
      watchPosition(success: (position: GeolocationPosition) => void,
        failure: (error: GeolocationPositionError) => void, options: PositionOptions) {
        const id = ++watchSequence;
        watches.set(id, success);
        failures.set(id, failure);
        lastOptions = options;
        return id;
      },
      clearWatch(id: number) { watches.delete(id); failures.delete(id); },
    } },
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { addEventListener() {}, removeEventListener() {} },
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { visibilityState: "visible" },
  });
  render();
  async function flush() { for (let index = 0; index < 8; index++) await Promise.resolve(); }
  async function advance(milliseconds: number) {
    const target = time + milliseconds;
    while (true) {
      const next = [...timers.entries()]
        .filter(([, timer]) => timer.at <= target)
        .sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
      if (!next) break;
      time = next[1].at;
      timers.delete(next[0]);
      next[1].callback();
      await flush();
    }
    time = target;
    await flush();
  }
  async function fix(accuracy: number, options: { lat?: number; age?: number; timestamp?: number } = {}) {
    const position = {
      coords: { latitude: options.lat ?? 5.55274, longitude: 95.3348656, accuracy },
      timestamp: options.timestamp ?? time - (options.age ?? 0),
    } as GeolocationPosition;
    for (const watch of [...watches.values()]) watch(position);
    await flush();
  }
  async function deny() {
    for (const failure of [...failures.values()]) failure({ code: 1 } as GeolocationPositionError);
    await flush();
  }
  async function unmount() {
    for (const cell of cells) cell?.cleanup?.();
    await flush();
  }
  return { get gps() { return snapshot!; }, advance, fix, deny, unmount,
    get options() { return lastOptions; }, get watchCount() { return watches.size; },
    get now() { return time; } };
}

type Outcome = { state: "pending" | "resolved" | "rejected"; value?: any };
function observe(promise: Promise<unknown>): Outcome {
  const outcome: Outcome = { state: "pending" };
  promise.then(value => { outcome.state = "resolved"; outcome.value = value; },
    error => { outcome.state = "rejected"; outcome.value = String(error); });
  return outcome;
}
const cases: Array<[string, (h: ReturnType<typeof setup>) => Promise<void>]> = [
  ["fresh high-accuracy request", async h => {
    assert.equal(h.options?.enableHighAccuracy, true);
    assert.equal(h.options?.maximumAge, 0);
  }],
  ["consistent precise pair", async h => {
    const outcome = observe(h.gps.acquireFreshPosition());
    await h.fix(30);
    await h.advance(1_000);
    await h.fix(20);
    assert.equal(outcome.state, "resolved");
    assert.equal(h.gps.isLocationReady, true);
  }],
  ["iOS single fix after five seconds", async h => {
    const outcome = observe(h.gps.acquireFreshPosition());
    await h.fix(25);
    await h.advance(4_999);
    assert.equal(outcome.state, "pending");
    await h.advance(1);
    assert.equal(outcome.state, "resolved");
    assert.equal(h.gps.isLocationReady, true);
  }],
  ["slow Android improves from 300m to 70m", async h => {
    const outcome = observe(h.gps.acquireFreshPosition());
    await h.fix(300);
    await h.advance(2_000);
    await h.fix(70);
    await h.advance(5_000);
    assert.equal(outcome.state, "resolved");
    assert.equal(outcome.value.accuracy, 70);
  }],
  ["reject inaccurate 150m fix", async h => {
    const outcome = observe(h.gps.acquireFreshPosition());
    await h.fix(150);
    await h.advance(20_000);
    assert.equal(outcome.state, "rejected");
    assert.equal(h.gps.isLocationReady, false);
  }],
  ["reject 31s old reading", async h => {
    const outcome = observe(h.gps.acquireFreshPosition());
    await h.fix(10, { age: 31_000 });
    await h.advance(20_000);
    assert.equal(outcome.state, "rejected");
  }],
  ["permission denied stops acquisition", async h => {
    const outcome = observe(h.gps.acquireFreshPosition());
    await h.deny();
    assert.equal(outcome.state, "rejected");
    assert.equal(h.watchCount, 0);
  }],
  ["permission denied after a fix still rejects", async h => {
    const outcome = observe(h.gps.acquireFreshPosition());
    await h.fix(25);
    await h.deny();
    assert.equal(outcome.state, "rejected");
  }],
  ["ready state expires after fifteen seconds", async h => {
    await h.fix(25);
    await h.advance(5_000);
    assert.equal(h.gps.isLocationReady, true);
    await h.advance(10_051);
    assert.equal(h.gps.isLocationReady, false);
  }],
  ["unconfirmed one-kilometre jump must not be returned", async h => {
    const outcome = observe(h.gps.acquireFreshPosition());
    await h.fix(40);
    await h.advance(1_000);
    await h.fix(5, { lat: 5.56274 });
    await h.advance(4_000);
    assert.equal(outcome.state === "resolved" && outcome.value.lat === 5.56274, false);
  }],
  ["confirmed distant position may replace an old position", async h => {
    const outcome = observe(h.gps.acquireFreshPosition());
    await h.fix(40);
    await h.advance(1_000);
    await h.fix(5, { lat: 5.56274 });
    await h.advance(1_000);
    await h.fix(5, { lat: 5.56274 });
    await h.advance(3_000);
    assert.equal(outcome.state, "resolved");
    assert.equal(outcome.value.lat, 5.56274);
  }],
  ["stale preferred candidate must not be returned", async h => {
    const outcome = observe(h.gps.acquireFreshPosition());
    await h.fix(5, { age: 14_000 });
    await h.advance(2_000);
    await h.fix(20);
    await h.advance(3_000);
    assert.equal(outcome.state, "resolved");
    assert.equal(isLocationUsable(outcome.value), true);
  }],
  ["fresh candidate replaces expired best", async h => {
    const outcome = observe(h.gps.acquireFreshPosition());
    await h.fix(5, { age: 14_000 });
    await h.advance(1_000);
    await h.fix(70);
    await h.advance(5_000);
    await h.fix(70);
    await h.advance(14_000);
    assert.equal(outcome.state, "resolved");
    assert.equal(isLocationUsable(outcome.value), true);
  }],
  ["invalid timestamp zero is rejected", async h => {
    const outcome = observe(h.gps.acquireFreshPosition());
    await h.fix(10, { timestamp: 0 });
    await h.advance(20_000);
    assert.equal(outcome.state, "rejected");
  }],
  ["unmount settles pending acquisition", async h => {
    const outcome = observe(h.gps.acquireFreshPosition());
    await h.fix(25);
    await h.unmount();
    await h.advance(21_000);
    assert.equal(outcome.state, "rejected");
    assert.equal(h.watchCount, 0);
  }],
];

async function main() {
  let passed = 0;
  for (const [name, test] of cases) {
    const h = setup();
    try {
      await test(h);
      process.stdout.write(`PASS ${name}\n`);
      passed++;
    } catch (error) {
      process.stdout.write(`FAIL ${name}: ${String(error)}\n`);
    } finally {
      await h.unmount();
    }
  }
  internal.ReactCurrentDispatcher.current = originalDispatcher;
  Date.now = originalNow;
  globalThis.setTimeout = originalSetTimeout;
  globalThis.clearTimeout = originalClearTimeout;
  if (originalNavigator) Object.defineProperty(globalThis, "navigator", originalNavigator);
  else delete (globalThis as any).navigator;
  if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
  else delete (globalThis as any).window;
  if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument);
  else delete (globalThis as any).document;
  process.stdout.write(`${passed}/${cases.length} simulated GPS cases passed\n`);
  if (passed !== cases.length) process.exitCode = 1;
}
main().catch(error => { process.stderr.write(String(error)); process.exitCode = 1; });
