const returnLocationKey = "excaliflow-login-return";
export let isFlowSessionRequired = true;

export async function checkFlowSession(): Promise<boolean> {
  const response = await fetch("/api/flow-auth/session", { cache: "no-store" });
  if (response.status === 401) {
    const start = await fetch("/api/flow-auth/start", {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!start.ok) {
      throw new Error("Flow login could not be started");
    }
    const { location } = await start.json();
    sessionStorage.setItem(returnLocationKey, window.location.href);
    window.location.replace(location);
    return false;
  }

  if (response.status !== 204) {
    throw new Error("Flow session check failed");
  }

  isFlowSessionRequired = response.headers.get("X-Flow-Auth") !== "disabled";

  const previous = sessionStorage.getItem(returnLocationKey);
  sessionStorage.removeItem(returnLocationKey);
  if (previous) {
    const url = new URL(previous, window.location.href);
    if (url.origin === window.location.origin) {
      window.history.replaceState(null, "", url.href);
    }
  }

  return true;
}

export async function endFlowSession() {
  const response = await fetch("/api/flow-auth/logout", { method: "POST" });
  if (!response.ok) {
    throw new Error("Flow logout failed");
  }

  const { location } = await response.json();
  window.location.replace(location);
}
