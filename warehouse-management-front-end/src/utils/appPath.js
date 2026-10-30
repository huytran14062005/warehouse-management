export function getAppBasePath() {
  const publicUrl = process.env.PUBLIC_URL || "/";
  return new URL(publicUrl, window.location.origin).pathname.replace(/\/+$/, "");
}

export function getAppPath(route = "/") {
  return `${getAppBasePath()}${route.startsWith("/") ? route : `/${route}`}`;
}

export function migrateLegacyHashRoute() {
  const oldRoute = window.location.hash.slice(1);
  if (!oldRoute.startsWith("/")) return false;
  window.history.replaceState(window.history.state, "", getAppPath(oldRoute));
  return true;
}
