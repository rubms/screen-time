import { onCall } from "firebase-functions/v2/https";
import { invalidArgument } from "./lib/errors";

const UPDATE_REPO = process.env.UPDATE_REPO ?? "owner/screen-time-control";
const CACHE_TTL_MS = 5 * 60 * 1000;

export interface UpdateManifestRequest {
  platform: "windows" | "android";
  channel: "stable" | "beta";
}

export interface UpdateManifestResponse {
  version: string;
  url: string;
  sha256: string;
}

interface CacheEntry {
  expiresAt: number;
  payload: UpdateManifestResponse;
}

const manifestCache = new Map<string, CacheEntry>();

const ASSET_SUFFIX: Record<UpdateManifestRequest["platform"], string> = {
  windows: ".exe",
  android: ".apk",
};

function cacheKey(platform: string, channel: string): string {
  return `${platform}:${channel}`;
}

function parseSha256(body: string): string | null {
  const match = body.match(/^sha256:\s*([a-fA-F0-9]{64})\s*$/m);
  return match ? match[1].toLowerCase() : null;
}

interface GitHubRelease {
  tag_name: string;
  prerelease: boolean;
  body: string;
  assets: Array<{ name: string; browser_download_url: string }>;
}

async function fetchLatestRelease(
  platform: UpdateManifestRequest["platform"],
  channel: UpdateManifestRequest["channel"],
): Promise<UpdateManifestResponse> {
  const key = cacheKey(platform, channel);
  const cached = manifestCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.payload;
  }

  const url = `https://api.github.com/repos/${UPDATE_REPO}/releases?per_page=30`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "screen-time-control-functions",
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  const releases = (await response.json()) as GitHubRelease[];
  const suffix = ASSET_SUFFIX[platform];

  const eligible = releases.filter((r) => {
    if (channel === "stable" && r.prerelease) {
      return false;
    }
    return r.assets.some((a) => a.name.endsWith(suffix));
  });

  if (eligible.length === 0) {
    throw new Error(`No release found for platform=${platform} channel=${channel}`);
  }

  const release = eligible[0]!;
  const asset = release.assets.find((a) => a.name.endsWith(suffix))!;
  const sha256 = parseSha256(release.body);

  if (!sha256) {
    throw new Error(`Release ${release.tag_name} missing sha256 line in body`);
  }

  const payload: UpdateManifestResponse = {
    version: release.tag_name.replace(/^v/, ""),
    url: asset.browser_download_url,
    sha256,
  };

  manifestCache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, payload });
  return payload;
}

export const getUpdateManifest = onCall(
  { enforceAppCheck: false },
  async (request): Promise<UpdateManifestResponse> => {
    const data = request.data as Partial<UpdateManifestRequest>;
    const platform = data.platform;
    const channel = data.channel ?? "stable";

    if (platform !== "windows" && platform !== "android") {
      throw invalidArgument('platform must be "windows" or "android"');
    }
    if (channel !== "stable" && channel !== "beta") {
      throw invalidArgument('channel must be "stable" or "beta"');
    }

    try {
      return await fetchLatestRelease(platform, channel);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw invalidArgument(message);
    }
  },
);
