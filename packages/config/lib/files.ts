import { Files, FilesError } from "files-sdk";
import { fs } from "files-sdk/fs";
import { env } from "./env";

const files = new Files({ adapter: fs({ root: env.APP_CONFIG_DIR }) });

export async function getItem<T>(key: string): Promise<T | undefined> {
  try {
    const file = await files.download(key);
    return JSON.parse(await file.text()) as T;
  } catch (error) {
    if (error instanceof FilesError && error.code === "NotFound") return undefined;
    throw error;
  }
}

export async function setItem(key: string, value: unknown): Promise<void> {
  await files.upload(key, JSON.stringify(value));
}

export async function removeItem(key: string): Promise<void> {
  try {
    await files.delete(key);
  } catch (error) {
    if (error instanceof FilesError && error.code === "NotFound") return;
    throw error;
  }
}
