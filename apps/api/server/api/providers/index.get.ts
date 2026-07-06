import { defineHandler } from "nitro";
import { listProviders } from "#server/utils/gateway.ts";

export default defineHandler(() => listProviders());
