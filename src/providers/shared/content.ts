export function extractUrlsFromText(content: string | null | undefined): string[] {
  if (!content) {
    return [];
  }

  const urls = new Set<string>();
  const pattern = /https?:\/\/[^\s)<>"]+/g;
  for (const match of content.matchAll(pattern)) {
    const candidate = match[0].replace(/["'.,;:!?]+$/g, "");
    if (candidate) {
      urls.add(candidate);
    }
  }

  return [...urls];
}

export function parseSseDataPayloads(raw: string): string[] {
  const payloads: string[] = [];
  const buffer: string[] = [];

  const flush = () => {
    if (buffer.length === 0) {
      return;
    }
    payloads.push(buffer.join("\n"));
    buffer.length = 0;
  };

  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) {
      flush();
      continue;
    }
    if (line.startsWith(":")) {
      continue;
    }
    if (line.startsWith("data:")) {
      buffer.push(line.slice(5).trimStart());
    }
  }

  flush();
  return payloads;
}