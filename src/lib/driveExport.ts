/**
 * Structured PDF export to Google Drive.
 * Creates a folder per schedule under Tumbleweed_DO_NOT_DELETE/Schedules/
 * with roster PDFs and a staff/ subfolder for individual staff PDFs.
 */

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
const SCHEDULES_FOLDER = "Schedules";

function getAccessToken(): string | null {
  return localStorage.getItem("tumbleweed_google_access_token");
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

  if (res.status === 401) throw new Error("DRIVE_TOKEN_EXPIRED");
  if (res.status === 403) throw new Error("DRIVE_PERMISSION_ERROR");
  if (!res.ok) throw new Error(`Drive API error: ${res.status}`);

  return res;
}

async function findFolderByName(name: string, parentId?: string): Promise<string | null> {
  let query = `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  if (parentId) query += ` and '${parentId}' in parents`;

  const res = await driveRequest(
    `${DRIVE_API}/files?q=${encodeURIComponent(query)}&fields=files(id,name)`
  );
  const data = await res.json();
  return data.files?.length > 0 ? data.files[0].id : null;
}

async function createFolder(name: string, parentId: string): Promise<string> {
  const res = await driveRequest(`${DRIVE_API}/files`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    }),
  });
  const folder = await res.json();
  return folder.id;
}

async function findOrCreateFolder(name: string, parentId: string): Promise<string> {
  const existing = await findFolderByName(name, parentId);
  if (existing) return existing;
  return createFolder(name, parentId);
}

async function uploadPdf(filename: string, blob: Blob, folderId: string): Promise<void> {
  // Check if file already exists (overwrite)
  const query = `name='${filename}' and '${folderId}' in parents and trashed=false`;
  const searchRes = await driveRequest(
    `${DRIVE_API}/files?q=${encodeURIComponent(query)}&fields=files(id)`
  );
  const searchData = await searchRes.json();

  if (searchData.files?.length > 0) {
    // Update existing file
    await driveRequest(
      `${UPLOAD_API}/files/${searchData.files[0].id}?uploadType=media`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/pdf" },
        body: blob,
      }
    );
  } else {
    // Create new file
    const metadata = {
      name: filename,
      parents: [folderId],
      mimeType: "application/pdf",
    };

    const form = new FormData();
    form.append(
      "metadata",
      new Blob([JSON.stringify(metadata)], { type: "application/json" })
    );
    form.append("file", new Blob([blob], { type: "application/pdf" }));

    await driveRequest(`${UPLOAD_API}/files?uploadType=multipart`, {
      method: "POST",
      body: form,
    });
  }
}

async function getAppRootFolder(): Promise<string> {
  const FOLDER_NAME = "Tumbleweed_DO_NOT_DELETE";
  const id = await findFolderByName(FOLDER_NAME);
  if (id) return id;

  // Create root folder if it doesn't exist
  const res = await driveRequest(`${DRIVE_API}/files`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: FOLDER_NAME,
      mimeType: "application/vnd.google-apps.folder",
    }),
  });
  const folder = await res.json();
  return folder.id;
}

function formatScheduleFolderName(
  scheduleMode: "24h" | "7d",
  startDate: string | null
): string {
  const now = new Date();
  const timestamp = `${now.getDate()}-${now.toLocaleString("en", { month: "short" }).toLowerCase()}-${now.getHours()}-${String(now.getMinutes()).padStart(2, "0")}-${String(now.getSeconds()).padStart(2, "0")}`;

  const mode = scheduleMode === "7d" ? "week" : "24h";

  if (scheduleMode === "7d" && startDate) {
    const start = new Date(startDate + "T00:00:00");
    const end = new Date(start);
    end.setDate(end.getDate() + 6);

    const formatDay = (d: Date) =>
      `${d.getDate()}-${d.toLocaleString("en", { month: "short" }).toLowerCase()}`;

    const startYear = start.getFullYear();
    const endYear = end.getFullYear();
    const sameYear = startYear === endYear;

    const dateRange = sameYear
      ? `${formatDay(start)}-${formatDay(end)}-${endYear}`
      : `${formatDay(start)}-${startYear}-${formatDay(end)}-${endYear}`;

    return `${mode}_${dateRange}_${timestamp}`;
  }

  // 24h mode
  const dateStr = startDate
    ? (() => {
        const d = new Date(startDate + "T00:00:00");
        return `${d.getDate()}-${d.toLocaleString("en", { month: "short" }).toLowerCase()}-${d.getFullYear()}`;
      })()
    : `${now.getDate()}-${now.toLocaleString("en", { month: "short" }).toLowerCase()}-${now.getFullYear()}`;

  return `${mode}_${dateStr}_${timestamp}`;
}

interface ExportOptions {
  rosterPdfs: { filename: string; blob: Blob }[];
  staffPdfs: { filename: string; blob: Blob }[];
  scheduleMode: "24h" | "7d";
  startDate: string | null;
}

export async function exportScheduleToDrive(options: ExportOptions): Promise<void> {
  const { rosterPdfs, staffPdfs, scheduleMode, startDate } = options;

  // Build folder structure
  const rootId = await getAppRootFolder();
  const schedulesId = await findOrCreateFolder(SCHEDULES_FOLDER, rootId);

  const folderName = formatScheduleFolderName(scheduleMode, startDate);
  const scheduleFolderId = await findOrCreateFolder(folderName, schedulesId);

  // Upload roster PDFs
  for (const { filename, blob } of rosterPdfs) {
    await uploadPdf(filename, blob, scheduleFolderId);
  }

  // Upload staff PDFs in staff/ subfolder
  if (staffPdfs.length > 0) {
    const staffFolderId = await findOrCreateFolder("staff", scheduleFolderId);
    for (const { filename, blob } of staffPdfs) {
      await uploadPdf(filename, blob, staffFolderId);
    }
  }
}
