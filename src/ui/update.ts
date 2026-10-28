import { t } from "../i18n";

const REPO = "julianroeben-a11y/binfinity";

interface RuntimeConfig {
  version: string;
  selfUpdate: boolean;
}

async function readConfig(): Promise<RuntimeConfig | null> {
  try {
    const res = await fetch(`./config.json?t=${Date.now()}`, { cache: "no-store" });
    return res.ok ? ((await res.json()) as RuntimeConfig) : null;
  } catch {
    return null;
  }
}

/** Newest commit on main, or null when GitHub is unreachable or rate-limited. */
async function latestCommit(): Promise<string | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/commits/main`, { headers: { Accept: "application/vnd.github.sha" } });
    return res.ok ? (await res.text()).trim().slice(0, 7) : null;
  } catch {
    return null;
  }
}

/**
 * Shows the build version and, on self-hosted installs with the update helper,
 * an update button. After triggering an update it waits for the container to
 * come back with a new version, then reloads the page.
 */
export async function initUpdater(versionEl: HTMLElement, button: HTMLButtonElement) {
  versionEl.textContent = __APP_VERSION__ === "dev" ? "dev" : `v${__APP_VERSION__}`;
  const config = await readConfig();
  if (!config?.selfUpdate) return;

  const latest = await latestCommit();
  const outdated = latest !== null && latest !== config.version;
  button.hidden = false;
  button.textContent = t(outdated ? "update.available" : "update.check");
  button.classList.toggle("primary", outdated);
  if (outdated) versionEl.title = t("update.newer", { version: latest });

  const fail = (key: string) => {
    button.disabled = false;
    button.textContent = t(key);
  };

  button.addEventListener("click", async () => {
    button.disabled = true;
    button.textContent = t("update.running");
    // The helper answers once it is done. If the app container was replaced,
    // the request dies on the way (expected); if it answers, the container
    // was not replaced, so there was nothing newer to pull.
    let answered = false;
    try {
      const res = await fetch("./api/update", { method: "POST" });
      if (res.status === 404) return fail("update.noHelper");
      if (res.status === 401 || res.status === 403) return fail("update.badToken");
      if (res.status >= 500) return fail("update.unreachable");
      answered = res.ok;
    } catch {
      // container restarted
    }
    const started = Date.now();
    const poll = async () => {
      const now = await readConfig();
      if (now && now.version !== config.version) return location.reload();
      if (answered && now) return fail(outdated ? "update.noImage" : "update.current");
      if (Date.now() - started > 180_000) return fail("update.failed");
      setTimeout(poll, 3000);
    };
    setTimeout(poll, answered ? 0 : 3000);
  });
}
