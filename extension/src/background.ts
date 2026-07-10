import { WEB_APP_URL } from "./config";

const MENU_ID = "tastemap-save-image";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: "Save to TasteMap",
    contexts: ["image"],
  });
});

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function setBadge(tabId: number | undefined, text: string, color: string) {
  chrome.action.setBadgeText({ text, tabId });
  chrome.action.setBadgeBackgroundColor({ color, tabId });
  if (text) setTimeout(() => chrome.action.setBadgeText({ text: "", tabId }), 2500);
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID || !info.srcUrl) return;

  const { apiKey } = await chrome.storage.local.get("apiKey");
  if (!apiKey) {
    setBadge(tab?.id, "!", "#e0555a");
    return;
  }

  try {
    const imageResp = await fetch(info.srcUrl);
    const blob = await imageResp.blob();
    const screenshotBase64 = await blobToBase64(blob);

    const res = await fetch(`${WEB_APP_URL}/api/captures`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        url: info.pageUrl ?? tab?.url,
        title: tab?.title,
        domain: new URL(info.pageUrl ?? tab?.url ?? "").hostname,
        screenshotBase64,
      }),
    });

    if (!res.ok) throw new Error(await res.text());
    setBadge(tab?.id, "✓", "#2f9e5f");
  } catch {
    setBadge(tab?.id, "!", "#e0555a");
  }
});
