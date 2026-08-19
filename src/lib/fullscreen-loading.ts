import { useSyncExternalStore } from "react";

// Single shared source of truth for "a fullscreen loading experience is
// currently covering the screen" (OCR extraction, PDF extraction, AI note
// generation, quiz generation, etc). Anything that shows a fullscreen
// LoadingScreen should flip this flag so global chrome (logo, hamburger)
// can hide itself, without each route needing to know about the others.

let active = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function setFullscreenLoading(value: boolean) {
  if (active === value) return;
  active = value;
  emit();
}

function getSnapshot() {
  return active;
}

function getServerSnapshot() {
  return false;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useFullscreenLoading() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
