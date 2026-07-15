import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

function getStorageRoot() {
  if (process.env.VERCEL) {
    return path.join("/tmp", "tanishq-submissions");
  }

  return path.join(process.cwd(), "data", "submissions");
}

function parseDataUrl(dataUrl) {
  const match = /^data:(.+);base64,(.+)$/.exec(dataUrl || "");

  if (!match) {
    throw new Error("Invalid media payload.");
  }

  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], "base64"),
  };
}

function extensionFromMimeType(mimeType, fallbackExtension = "bin") {
  const extensions = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "video/webm": "webm",
  };

  return extensions[mimeType] || fallbackExtension;
}

async function saveMediaAsset(assetsDirectory, assetType, assetPayload) {
  const { buffer, mimeType } = parseDataUrl(assetPayload.dataUrl);
  const extension = extensionFromMimeType(mimeType, assetType);
  const fileName =
    assetPayload.fileName || `${assetType}-${Date.now()}.${extension}`;
  const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "-");
  const absolutePath = path.join(assetsDirectory, safeFileName);

  await fs.writeFile(absolutePath, buffer);

  return {
    assetType,
    fileName: safeFileName,
    mimeType,
    byteLength: buffer.byteLength,
    relativePath: path.join("assets", safeFileName),
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    const {
      name = "",
      landingMessage = "",
      pageType = "",
      pagePayload = {},
    } = req.body || {};

    if (!pageType) {
      return res.status(400).json({ error: "Missing page type." });
    }

    const submissionId = randomUUID();
    const submittedAt = new Date().toISOString();
    const storageRoot = getStorageRoot();
    const submissionDirectory = path.join(storageRoot, submissionId);
    const assetsDirectory = path.join(submissionDirectory, "assets");

    await fs.mkdir(assetsDirectory, { recursive: true });

    const savedAssets = [];

    if (pagePayload.photo?.dataUrl) {
      savedAssets.push(
        await saveMediaAsset(assetsDirectory, "photo", pagePayload.photo)
      );
    }

    if (pagePayload.video?.dataUrl) {
      savedAssets.push(
        await saveMediaAsset(assetsDirectory, "video", pagePayload.video)
      );
    }

    const record = {
      submissionId,
      submittedAt,
      name: name.trim(),
      landingMessage: landingMessage.trim(),
      pageType,
      pagePayload: {
        wishText: pagePayload.wishText?.trim() || "",
      },
      savedAssets,
    };

    await fs.writeFile(
      path.join(submissionDirectory, "submission.json"),
      JSON.stringify(record, null, 2),
      "utf8"
    );

    return res.status(200).json({
      ok: true,
      submissionId,
      savedAt: submissionDirectory,
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unexpected server error.",
    });
  }
}
