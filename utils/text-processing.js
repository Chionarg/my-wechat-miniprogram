function normalizeText(text) {
  if (typeof text !== "string") {
    throw new TypeError(
      "text 必须是字符串"
    );
  }

  let normalized = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  if (
    normalized.charCodeAt(0) ===
    0xfeff
  ) {
    normalized =
      normalized.slice(1);
  }

  return normalized;
}

function splitIntoParagraphs(text) {
  const normalized =
    normalizeText(text);

  return normalized
    .split(/\n[ \t]*\n+/)
    .map(paragraph =>
      paragraph.trim()
    )
    .filter(Boolean);
}

function createSources(paragraphs) {
  if (!Array.isArray(paragraphs)) {
    throw new TypeError(
      "paragraphs 必须是数组"
    );
  }

  return paragraphs.map(
    (text, index) => {
      if (
        typeof text !== "string" ||
        !text.trim()
      ) {
        throw new TypeError(
          "paragraphs 包含无效段落"
        );
      }

      return {
        id: "P" + (index + 1),
        text: text
      };
    }
  );
}

const DEFAULT_CHUNK_TARGET_CHARS =
  2000;

function createChunks(
  sources,
  options
) {
  if (!Array.isArray(sources)) {
    throw new TypeError(
      "sources 必须是数组"
    );
  }

  const config =
    options || {};

  const targetChars =
    config.targetChars === undefined
      ? DEFAULT_CHUNK_TARGET_CHARS
      : config.targetChars;

  if (
    !Number.isInteger(targetChars) ||
    targetChars <= 0
  ) {
    throw new TypeError(
      "targetChars 必须是正整数"
    );
  }

  sources.forEach(source => {
    if (
      !source ||
      typeof source.id !== "string" ||
      !/^P[1-9]\d*$/.test(source.id) ||
      typeof source.text !== "string" ||
      !source.text.trim()
    ) {
      throw new TypeError(
        "sources 包含无效 Source"
      );
    }
  });

  const chunks = [];
  let currentSources = [];

  function formatSource(source) {
    return (
      "[" +
      source.id +
      "]\n" +
      source.text
    );
  }

  function buildText(items) {
    return items
      .map(formatSource)
      .join("\n\n");
  }

  function pushChunk(items) {
    if (!items.length) {
      return;
    }

    const text =
      buildText(items);

    chunks.push({
      id:
        "chunk_" +
        (chunks.length + 1),

      sourceIds:
        items.map(
          item => item.id
        ),

      text: text,

      charCount:
        text.length,

      oversized:
        text.length >
        targetChars
    });
  }

  sources.forEach(source => {
    if (!currentSources.length) {
      currentSources = [
        source
      ];
      return;
    }

    const candidate =
      currentSources.concat(
        source
      );

    if (
      buildText(candidate).length <=
      targetChars
    ) {
      currentSources =
        candidate;
    } else {
      pushChunk(
        currentSources
      );

      currentSources = [
        source
      ];
    }
  });

  pushChunk(
    currentSources
  );

  return chunks;
}

module.exports = {
  normalizeText,
  splitIntoParagraphs,
  createSources,
  createChunks,
  DEFAULT_CHUNK_TARGET_CHARS
};