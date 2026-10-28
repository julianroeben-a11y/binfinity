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

  button.addEventListener("click", () => {
    button.disabled = true;
    button.textContent = t("update.running");
    const started = Date.now();
    let done = false;
    const finish = (key: string) => {
      if (done) return;
      done = true;
      fail(key);
    };
    // Watch for the new version from the start; the helper may take a while
    // to answer, or never answer because the container is being replaced.
    const poll = async () => {
      if (done) return;
      const now = await readConfig();
      if (now && now.version !== config.version) {
        done = true;
        return location.reload();
      }
      if (Date.now() - started > 180_000) return finish("update.failed");
      setTimeout(poll, 3000);
    };
    setTimeout(poll, 3000);

    // The helper answers once it is done. If the app container was replaced,
    // the request dies on the way (expected); if it answers, the container
    // was not replaced, so there was nothing newer to pull.
    fetch("./api/update", { method: "POST" })
      .then(async (res) => {
        if (res.status === 404) return finish("update.noHelper");
        if (res.status === 401 || res.status === 403) return finish("update.badToken");
        if (res.status >= 500) return finish("update.unreachable");
        if (!res.ok) return finish("update.failed");
        const now = await readConfig();
        if (now && now.version === config.version) finish(outdated ? "update.noImage" : "update.current");
      })
      .catch(() => {
        // container restarted; the poll picks up the new version
      });
  });
}
