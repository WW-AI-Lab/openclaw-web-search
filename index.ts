import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { createOpenClawWebSearchProvider } from "./src/provider.js";

export default definePluginEntry({
  id: "openclaw-web-search",
  name: "OpenClaw Web Search",
  description: "Independent external web_search plugin for OpenClaw",
  register(api) {
    api.registerWebSearchProvider(createOpenClawWebSearchProvider());
  },
});
