import { createStorage } from "unstorage";
import fsDriver from "unstorage/drivers/fs";
import { config } from "@workspace/config";

export const storage = createStorage({
  driver: fsDriver({
    base: config.APP_CONFIG_DIR,
  }),
});
