/**
 * Google Drive persistence for roster data and preferences.
 * Uses the Drive API v3 to read/write JSON files under /Tumbleweed_DO_NOT_DELETE/.
 * Requires the Drive file scope (drive.file — app-created files only).
 */

const FOLDER_NAME = "Tumbleweed_DO_NOT_DELETE";
const LEGACY_FOLDER_NAME = "Tumbleweed";
export const DRIVE_FILE_ROSTER = "roster-data.json";
export const DRIVE_FILE_PREFERENCES = "preferences.json";
const DRIVE_API = "https://www.googleapis.com/drive/v3";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";

let cachedFolderId: string | null = null;
const cachedFileIds = new Map<string, string>();

// --- Core helpers ---

function getAccessToken(): string | null {
  return localStorage.getItem("tumbleweed_google_access_token");
}

export function setGoogleAccessToken(token: string): void {
  localStorage.setItem("tumbleweed_google_access_token", token);
  // Notify pending renewal waiters
  window.dispatchEvent(new Event("storage-token-renewed"));
}

export function clearGoogleAccessToken(): void {
  localStorage.removeItem("tumbleweed_google_access_token");
  cachedFolderId = null;
  cachedFileIds.clear();
  folderInitPromise = null;
}

export function hasGoogleDriveAccess(): boolean {
  return !!getAccessToken();
}

async function driveRequest(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getAccessToken();
  if (!token) throw new Error("No Google access token");

  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers as Record<string, string>),
    },
  });

  if (res.status === 401) {
    // Don't attempt silent renewal — it opens a Google popup/redirect.
    // Instead, clear the token and let the UI show a re-login dialog.
    clearGoogleAccessToken();
    throw new Error("DRIVE_TOKEN_EXPIRED");
  }

  if (res.status === 403) {
    throw new Error("DRIVE_PERMISSION_ERROR");
  }

  return res;
}

// --- Folder management ---

let folderInitPromise: Promise<string> | null = null;

async function findFolderByName(name: string): Promise<string | null> {
  const searchRes = await driveRequest(
    `${DRIVE_API}/files?q=${encodeURIComponent(
      `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
    )}&fields=files(id,name)`
  );
  const searchData = await searchRes.json();
  return searchData.files?.length > 0 ? searchData.files[0].id : null;
}

async function findOrCreateFolder(): Promise<string> {
  if (cachedFolderId) return cachedFolderId;

  // Deduplicate concurrent calls — only one folder lookup/create at a time
  if (folderInitPromise) return folderInitPromise;

  folderInitPromise = (async () => {
    // Check for current folder name
    const folderId = await findFolderByName(FOLDER_NAME);
    if (folderId) {
      cachedFolderId = folderId;
      return cachedFolderId;
    }

    // Check for legacy folder and rename it
    const legacyId = await findFolderByName(LEGACY_FOLDER_NAME);
    if (legacyId) {
      await driveRequest(`${DRIVE_API}/files/${legacyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: FOLDER_NAME }),
      });
      cachedFolderId = legacyId;
      return cachedFolderId;
    }

    // Create new folder
    const createRes = await driveRequest(`${DRIVE_API}/files`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: FOLDER_NAME,
        mimeType: "application/vnd.google-apps.folder",
      }),
    });
    const folder = await createRes.json();
    cachedFolderId = folder.id;
    return cachedFolderId!;
  })();

  try {
    return await folderInitPromise;
  } finally {
    folderInitPromise = null;
  }
}

// --- File operations (parameterized by filename) ---

// Serialize save operations per filename to prevent duplicate file creation
const saveInProgress = new Map<string, Promise<void>>();

async function findFile(folderId: string, filename: string): Promise<string | null> {
  const cached = cachedFileIds.get(filename);
  if (cached) return cached;

  const res = await driveRequest(
    `${DRIVE_API}/files?q=${encodeURIComponent(
      `name='${filename}' and '${folderId}' in parents and trashed=false`
    )}&fields=files(id,name,modifiedTime)`
  );
  const data = await res.json();

  if (data.files?.length > 0) {
    cachedFileIds.set(filename, data.files[0].id);
    return data.files[0].id;
  }
  return null;
}

export async function getFileMetadata(filename: string): Promise<{ modifiedTime: string } | null> {
  const folderId = await findOrCreateFolder();
  const fileId = await findFile(folderId, filename);
  if (!fileId) return null;

  const metaRes = await driveRequest(`${DRIVE_API}/files/${fileId}?fields=modifiedTime`);
  const meta = await metaRes.json();
  return { modifiedTime: meta.modifiedTime };
}

async function saveToDriveImpl(filename: string, data: unknown): Promise<void> {
  const folderId = await findOrCreateFolder();
  const fileId = await findFile(folderId, filename);
  const body = JSON.stringify(data);

  if (fileId) {
    await driveRequest(`${UPLOAD_API}/files/${fileId}?uploadType=media`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body,
    });
  } else {
    const metadata = {
      name: filename,
      parents: [folderId],
      mimeType: "application/json",
    };

    const form = new FormData();
    form.append(
      "metadata",
      new Blob([JSON.stringify(metadata)], { type: "application/json" })
    );
    form.append("file", new Blob([body], { type: "application/json" }));

    const res = await driveRequest(`${UPLOAD_API}/files?uploadType=multipart`, {
      method: "POST",
      body: form,
    });
    const file = await res.json();
    cachedFileIds.set(filename, file.id);
  }
}

export async function saveToDrive(filename: string, data: unknown): Promise<void> {
  // Wait for any in-progress save of the same file to complete first
  const pending = saveInProgress.get(filename);
  if (pending) {
    await pending.catch(() => {}); // ignore errors from previous save
  }

  const promise = saveToDriveImpl(filename, data);
  saveInProgress.set(filename, promise);

  try {
    await promise;
  } finally {
    if (saveInProgress.get(filename) === promise) {
      saveInProgress.delete(filename);
    }
  }
}

export async function loadFromDrive(filename: string): Promise<{ data: unknown; modifiedTime: string } | null> {
  const folderId = await findOrCreateFolder();
  const fileId = await findFile(folderId, filename);
  if (!fileId) return null;

  const metaRes = await driveRequest(`${DRIVE_API}/files/${fileId}?fields=modifiedTime`);
  const meta = await metaRes.json();

  const contentRes = await driveRequest(`${DRIVE_API}/files/${fileId}?alt=media`);
  const data = await contentRes.json();

  return { data, modifiedTime: meta.modifiedTime };
}
