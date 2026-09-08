const STORAGE_KEY = "qianxing-shared-route-v1";

function isRoutePayload(route) {
  return Boolean(
    route
    && Array.isArray(route.sites)
    && route.sites.length
    && Array.isArray(route.itinerary)
  );
}

export function readRouteSession() {
  try {
    const session = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");
    return isRoutePayload(session?.route) ? session : null;
  } catch {
    return null;
  }
}

export function writeRouteSession({ route, request, source }) {
  if (!isRoutePayload(route)) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 1,
      savedAt: new Date().toISOString(),
      source,
      request: request || route.request || {},
      route,
    }));
  } catch {
    // Route sharing is an enhancement; generation still works when storage is unavailable.
  }
}

export function subscribeRouteSession(callback) {
  const listener = event => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try {
      const session = JSON.parse(event.newValue);
      if (isRoutePayload(session?.route)) callback(session);
    } catch {
      // Ignore malformed state from older builds.
    }
  };
  window.addEventListener("storage", listener);
  return () => window.removeEventListener("storage", listener);
}
