// One report draft per device, kept in IndexedDB so photos (as Blobs) survive
// a refresh, a closed tab or a dead network. Nothing here leaves the device
// until the citizen sends the report.
const DB = "kosova-report";
const STORE = "drafts";
const KEY = "current";

function open() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run(mode, action) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = action(tx.objectStore(STORE));
    tx.oncomplete = () => {
      db.close();
      resolve(request?.result);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function loadDraft() {
  try {
    return (await run("readonly", (store) => store.get(KEY))) || null;
  } catch {
    return null;
  }
}

export async function saveDraft(draft) {
  try {
    await run("readwrite", (store) => store.put({ ...draft, savedAt: Date.now() }, KEY));
    return true;
  } catch {
    return false;
  }
}

export async function clearDraft() {
  try {
    await run("readwrite", (store) => store.delete(KEY));
  } catch {}
}

// The last successful submission, for the success page. Tab-scoped and gone when the tab closes.
const RECEIPT = "kr-receipt";
export function keepReceipt(receipt) {
  try {
    sessionStorage.setItem(RECEIPT, JSON.stringify(receipt));
  } catch {}
}
export function readReceipt() {
  try {
    return JSON.parse(sessionStorage.getItem(RECEIPT) || "null");
  } catch {
    return null;
  }
}
