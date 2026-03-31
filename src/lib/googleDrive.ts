/**
 * Google Drive persistence for roster data.
 * Uses the Drive API v3 to read/write a single JSON file under /Tumbleweed/.
 * Requires the Drive file scope (drive.file — app-created files only).
 */

const FOLDER_NAME = "Tumbleweed";
const FILE_NAME = "roster-data.json";
const DRIVE_API = "https://www.googleapis.com/drive/v3";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";

let cachedFolderId: string | null = null;
let cachedFileId: string | null = null;

function getAccessToken(): string | null {
  return localStorage.getItem("tumbleweed_google_access_token");
}

export function setGoogleAccessToken(token: string): void {
  localStorage.setItem("tumbleweed_google_access_token", token);
}

export function clearGoogleAccessToken(): void {
  localStorage.removeItem("tumbleweed_google_access_token");
  cachedFolderId = null;
  cachedFileId = null;
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
    clearGoogleAccessToken();
    throw new Error("Google Drive token expired");
  }

  return res;
}

async function findOrCreateFolder(): Promise<string> {
  if (cachedFolderId) return cachedFolderId;

  // Search for existing folder
  const searchRes = await driveRequest(
    `${DRIVE_API}/files?q=${encodeURIComponent(
      `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
    )}&fields=files(id,name)`
  );
  const searchData = await searchRes.json();

  if (searchData.files?.length > 0) {
    cachedFolderId = searchData.files[0].id;
    return cachedFolderId!;
  }

  // Create folder
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
}

async function findFile(folderId: string): Promise<string | null> {
  if (cachedFileId) return cachedFileId;

  const res = await driveRequest(
    `${DRIVE_API}/files?q=${encodeURIComponent(
      `name='${FILE_NAME}' and '${folderId}' in parents and trashed=false`
    )}&fields=files(id,name,modifiedTime)`
  );
  const data = await res.json();

  if (data.files?.length > 0) {
    cachedFileId = data.files[0].id;
    return cachedFileId;
  }
  return null;
}

export async function saveToDrive(data: unknown): Promise<void> {
  const folderId = await findOrCreateFolder();
  const fileId = await findFile(folderId);
  const body = JSON.stringify(data);

  if (fileId) {
    // Update existing file
    await driveRequest(`${UPLOAD_API}/files/${fileId}?uploadType=media`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body,
    });
  } else {
    // Create new file
    const metadata = {
      name: FILE_NAME,
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
    cachedFileId = file.id;
  }
}

export async function loadFromDrive(): Promise<{ data: unknown; modifiedTime: string } | null> {
  const folderId = await findOrCreateFolder();
  const fileId = await findFile(folderId);
  if (!fileId) return null;

  // Get file metadata for modifiedTime
  const metaRes = await driveRequest(`${DRIVE_API}/files/${fileId}?fields=modifiedTime`);
  const meta = await metaRes.json();

  // Download file content
  const contentRes = await driveRequest(`${DRIVE_API}/files/${fileId}?alt=media`);
  const data = await contentRes.json();

  return { data, modifiedTime: meta.modifiedTime };
}
