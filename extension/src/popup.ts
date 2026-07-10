import { WEB_APP_URL } from "./config";

const setupEl = document.getElementById("setup")!;
const signedInEl = document.getElementById("signedIn")!;
const previewEl = document.getElementById("preview") as HTMLImageElement;
const titleEl = document.getElementById("title")!;
const noteEl = document.getElementById("note") as HTMLTextAreaElement;
const saveBtn = document.getElementById("save") as HTMLButtonElement;
const connectBtn = document.getElementById("connect") as HTMLButtonElement;
const apiKeyInput = document.getElementById("apiKey") as HTMLInputElement;
const statusEl = document.getElementById("status")!;

let screenshotDataUrl = "";
let activeTab: chrome.tabs.Tab | null = null;

async function init() {
  const { apiKey } = await chrome.storage.local.get("apiKey");

  if (!apiKey) {
    setupEl.classList.remove("hidden");
    return;
  }

  signedInEl.classList.remove("hidden");

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  activeTab = tab;
  titleEl.textContent = tab?.title ?? tab?.url ?? "";

  if (tab?.windowId != null) {
    screenshotDataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
    previewEl.src = screenshotDataUrl;
  }
}

connectBtn.addEventListener("click", async () => {
  const value = apiKeyInput.value.trim();
  if (!value) return;
  await chrome.storage.local.set({ apiKey: value });
  init();
});

saveBtn.addEventListener("click", async () => {
  if (!activeTab?.url) return;

  saveBtn.disabled = true;
  statusEl.textContent = "Saving…";

  const { apiKey } = await chrome.storage.local.get("apiKey");

  try {
    const res = await fetch(`${WEB_APP_URL}/api/captures`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        url: activeTab.url,
        title: activeTab.title,
        domain: new URL(activeTab.url).hostname,
        note: noteEl.value || undefined,
        screenshotBase64: screenshotDataUrl || undefined,
      }),
    });

    if (!res.ok) throw new Error(await res.text());

    statusEl.textContent = "Saved.";
    setTimeout(() => window.close(), 700);
  } catch {
    statusEl.textContent = "Couldn't save — try again.";
    saveBtn.disabled = false;
  }
});

init();
