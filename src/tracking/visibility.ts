// The only module that touches the Page Visibility API. It reports transitions; it never
// inspects what the user is doing elsewhere.

export type VisibilityChange = 'tab_hidden' | 'tab_visible';

export function isPageHidden(): boolean {
  return document.visibilityState === 'hidden';
}

/** Calls `onChange` whenever the study tab is hidden or shown. Returns an unsubscribe function. */
export function watchVisibility(
  onChange: (type: VisibilityChange, at: number) => void,
): () => void {
  const handler = () => onChange(isPageHidden() ? 'tab_hidden' : 'tab_visible', Date.now());
  document.addEventListener('visibilitychange', handler);
  return () => document.removeEventListener('visibilitychange', handler);
}
