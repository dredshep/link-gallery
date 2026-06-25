export interface Asset {
  id: string;
  storedFilename: string;
  originalFilename: string;
  displayName: string;
  width: number | null;
  height: number | null;
  sizeBytes: number;
  thumbUrl: string;
  rawUrl: string;
  tags: string[];
  createdAt: string;
  nsfw: boolean;
}

export interface AppConfig {
  publicImageBaseUrl: string;
  tailscaleImageBaseUrl: string;
  defaultCopyMode: "public" | "tailscale";
}

export type CopyMode = "public" | "tailscale";
export type OutputFormat = "markdown" | "url";
export type SortOrder = "newest" | "oldest" | "name";
