import type { ProviderConfig } from "../shared/index.js";

export type MetasoMode = "search" | "reader" | "deep_research";

export type MetasoResearchModel = "fast" | "fast_thinking" | "ds-r1";

export type MetasoProviderConfig = ProviderConfig & {
  mode?: MetasoMode;
  scope?: string;
  size?: number;
  includeSummary?: boolean;
  includeRawContent?: boolean;
  conciseSnippet?: boolean;
  deepResearchModel?: MetasoResearchModel;
};

export type MetasoSearchItem = {
  title?: string;
  url?: string;
  summary?: string;
};