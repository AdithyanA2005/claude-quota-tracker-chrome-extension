import { log } from '../utils/logger.js';
import { scheduleMountAndUpdate } from './tracker.js';

let locationHref = window.location.href;

export function handleRouteOrViewChange() {
  if (window.location.href !== locationHref) {
    locationHref = window.location.href;
    log("route-change", locationHref);
    scheduleMountAndUpdate();
  }
}

export function patchHistoryForSpaNavigation() {
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;
  history.pushState = function pushStatePatched(...args) {
    const result = originalPushState.apply(this, args);
    window.dispatchEvent(new Event("clu:locationchange"));
    return result;
  };
  history.replaceState = function replaceStatePatched(...args) {
    const result = originalReplaceState.apply(this, args);
    window.dispatchEvent(new Event("clu:locationchange"));
    return result;
  };
}
