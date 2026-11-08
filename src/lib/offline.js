// Offline support for the Convex client.
// - useQuery: falls back to the last result saved on this device (IndexedDB) when Convex can't answer.
// - useMutation: when there's no connection, the change is saved to an outbox and sent once back online.
// - useAction: actions (login, saving users) need the server, so they fail fast with a clear message offline.
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useAction as useConvexAction, useMutation as useConvexMutation, useQuery as useConvexQuery } from "convex/react";
import { getFunctionName, makeFunctionReference } from "convex/server";
import { errorMessage } from "./format";

const DB_NAME = "mhmas-offline";
const QUERIES = "queries";
const OUTBOX = "outbox";
// Search-as-you-type results would fill the cache with one entry per keystroke.
const UNCACHED = new Set(["search:run"]);
const STARTUP_GRACE_MS = 5000;

export const OFFLINE_MESSAGE = "This needs an internet connection. Please try again when you are back online.";

let db = null;
let client = null;
let startedAt = Date.now();
let flushing = false;
const queryCache = new Map();
let outbox = [];
const listeners = new Set();
let snapshot = computeSnapshot();

// ---------- IndexedDB ----------

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(QUERIES)) database.createObjectStore(QUERIES);
      if (!database.objectStoreNames.contains(OUTBOX)) database.createObjectStore(OUTBOX, { keyPath: "id", autoIncrement: true });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function run(storeName, mode, fn) {
  if (!db) return Promise.resolve(undefined);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const request = fn(tx.objectStore(storeName));
    tx.oncomplete = () => resolve(request?.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function readAll(storeName) {
  if (!db) return Promise.resolve([]);
  return new Promise((resolve, reject) => {
    const rows = [];
    const request = db.transaction(storeName, "readonly").objectStore(storeName).openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return resolve(rows);
      rows.push({ key: cursor.key, value: cursor.value });
      cursor.continue();
    };
    request.onerror = () => reject(request.error);
  });
}

// ---------- connection state ----------

function connection() {
  return client?.connectionState() || { isWebSocketConnected: false, hasEverConnected: false };
}

function isConnected() {
  return navigator.onLine !== false && connection().isWebSocketConnected;
}

function looksOffline() {
  if (navigator.onLine === false) return true;
  const state = connection();
  if (state.isWebSocketConnected) return false;
  // Don't flash "offline" while the first connection is still being made.
  return state.hasEverConnected || Date.now() - startedAt > STARTUP_GRACE_MS;
}

function computeSnapshot() {
  return {
    offline: client ? looksOffline() : false,
    syncing: flushing,
    pending: outbox.filter((item) => !item.error).length,
    failed: outbox.filter((item) => item.error),
  };
}

function notify() {
  const next = computeSnapshot();
  const same =
    next.offline === snapshot.offline &&
    next.syncing === snapshot.syncing &&
    next.pending === snapshot.pending &&
    next.failed.length === snapshot.failed.length &&
    next.failed.every((item, index) => item === snapshot.failed[index]);
  if (same) return;
  snapshot = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// ---------- setup ----------

export async function initOffline(convexClient) {
  client = convexClient;
  startedAt = Date.now();
  try {
    db = await openDb();
    for (const row of await readAll(QUERIES)) queryCache.set(row.key, row.value);
    outbox = (await readAll(OUTBOX)).map((row) => row.value);
  } catch (err) {
    console.warn("Offline storage unavailable", err);
  }
  const onChange = () => {
    notify();
    flush();
  };
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  client.subscribeToConnectionState(onChange);
  setTimeout(notify, STARTUP_GRACE_MS + 100);
  notify();
}

// ---------- outbox ----------

async function enqueue(name, args) {
  const item = { name, args, createdAt: Date.now() };
  const id = await run(OUTBOX, "readwrite", (store) => store.add(item));
  outbox.push({ ...item, id: id ?? `mem-${item.createdAt}-${Math.random()}` });
  notify();
}

async function flush() {
  if (flushing || !client || !isConnected()) return;
  if (!outbox.some((item) => !item.error)) return;
  flushing = true;
  notify();
  try {
    // Send in the order they were made, one at a time, so later changes see earlier ones.
    for (const item of [...outbox]) {
      if (item.error) continue;
      if (!isConnected()) break;
      try {
        await client.mutation(makeFunctionReference(item.name), item.args);
        outbox = outbox.filter((entry) => entry.id !== item.id);
        await run(OUTBOX, "readwrite", (store) => store.delete(item.id));
      } catch (err) {
        const failed = { ...item, error: errorMessage(err) };
        outbox = outbox.map((entry) => (entry.id === item.id ? failed : entry));
        await run(OUTBOX, "readwrite", (store) => store.put(failed));
      }
      notify();
    }
  } finally {
    flushing = false;
    notify();
  }
}

export async function retryFailed() {
  const cleared = outbox.map(({ error, ...item }) => item);
  outbox = cleared;
  await Promise.all(cleared.map((item) => run(OUTBOX, "readwrite", (store) => store.put(item))));
  notify();
  flush();
}

export async function discardFailed() {
  const failed = outbox.filter((item) => item.error);
  outbox = outbox.filter((item) => !item.error);
  await Promise.all(failed.map((item) => run(OUTBOX, "readwrite", (store) => store.delete(item.id))));
  notify();
}

export async function clearQueryCache() {
  queryCache.clear();
  await run(QUERIES, "readwrite", (store) => store.clear());
}

// ---------- hooks (drop-in replacements for convex/react) ----------

export function useOfflineStatus() {
  return useSyncExternalStore(subscribe, () => snapshot);
}

export function useQuery(ref, args) {
  const live = useConvexQuery(ref, args);
  const name = getFunctionName(ref);
  const key = args === "skip" || UNCACHED.has(name) ? null : `${name}:${JSON.stringify(args ?? {})}`;

  useEffect(() => {
    if (!key || live === undefined) return;
    queryCache.set(key, live);
    run(QUERIES, "readwrite", (store) => store.put(live, key)).catch(() => {});
  }, [key, live]);

  if (live !== undefined || !key) return live;
  return queryCache.get(key);
}

// Pass { offline: false } when the caller needs the mutation's result right away
// (e.g. it uses a new id for the next step); it then errors offline instead of queueing.
export function useMutation(ref, options) {
  const mutate = useConvexMutation(ref);
  const name = getFunctionName(ref);
  const allowQueue = options?.offline !== false;
  return useCallback(
    async (args) => {
      if (isConnected()) return mutate(args);
      if (!allowQueue) throw new Error(OFFLINE_MESSAGE);
      await enqueue(name, args);
      return null;
    },
    [mutate, name, allowQueue],
  );
}

export function useAction(ref) {
  const act = useConvexAction(ref);
  return useCallback(
    async (args) => {
      if (navigator.onLine === false || (client && !connection().isWebSocketConnected && looksOffline())) {
        throw new Error(OFFLINE_MESSAGE);
      }
      return act(args);
    },
    [act],
  );
}
