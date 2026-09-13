const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const noteAnalysisTask =
  require("./note-analysis-task");

const deepSeekProvider =
  require("./deepseek-provider");

// 第一阶段只处理短文字笔记。
// 这是测试限制，不是最终产品限制。
const MAX_INPUT_LENGTH = 2000;

// 防止一次请求切出过多段落。
const MAX_SOURCE_COUNT = 30;

// 2C 短 TXT MVP 的云端绝对输入上限。
// targetChars 来自客户端 processing，
// 不能把它本身当作安全边界。
const MAX_TXT_CHUNK_LENGTH = 3000;

function normalizeText(text) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
}

function createSources(text) {
  // 第一版按“非空段落”切分。
  const paragraphs = text
    .split(/\n\s*\n/)
    .map(item => item.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) {
    throw new Error("EMPTY_SOURCE");
  }

  if (paragraphs.length > MAX_SOURCE_COUNT) {
    throw new Error("TOO_MANY_SOURCES");
  }

  return paragraphs.map((content, index) => ({
    id: `P${index + 1}`,
    content
  }));
}

function buildSourceText(sources) {
  return sources
    .map(source => `[${source.id}]\n${source.content}`)
    .join("\n\n");
}

function validateTxtProcessing(
  processing
) {
  if (
    !processing ||
    typeof processing !== "object" ||
    processing.version !== 1 ||
    !Array.isArray(
      processing.sources
    ) ||
    !Array.isArray(
      processing.chunks
    )
  ) {
    throw new Error(
      "INVALID_TXT_PROCESSING"
    );
  }

  const targetChars =
    processing.targetChars ===
      undefined
      ? 2000
      : processing.targetChars;

  if (
    !Number.isInteger(targetChars) ||
    targetChars <= 0
  ) {
    throw new Error(
      "INVALID_TXT_PROCESSING"
    );
  }

  const sources =
    processing.sources;

  const chunks =
    processing.chunks;

  if (
    sources.length === 0 ||
    sources.length >
      MAX_SOURCE_COUNT
  ) {
    throw new Error(
      "INVALID_TXT_SOURCES"
    );
  }

  for (
    let index = 0;
    index < sources.length;
    index += 1
  ) {
    const source =
      sources[index];

    if (
      !source ||
      typeof source !== "object" ||
      source.id !==
        "P" + (index + 1) ||
      typeof source.text !==
        "string" ||
      !source.text.trim()
    ) {
      throw new Error(
        "INVALID_TXT_SOURCES"
      );
    }
  }

  // 2C 第一版只允许单 Chunk。
  if (chunks.length !== 1) {
    throw new Error(
      "TXT_MULTIPLE_CHUNKS_NOT_SUPPORTED"
    );
  }

  const chunk =
    chunks[0];

  if (
    !chunk ||
    typeof chunk !== "object" ||
    chunk.id !== "chunk_1" ||
    !Array.isArray(
      chunk.sourceIds
    ) ||
    chunk.sourceIds.length !==
      sources.length ||
    typeof chunk.text !==
      "string" ||
    typeof chunk.oversized !==
      "boolean"
  ) {
    throw new Error(
      "INVALID_TXT_CHUNK"
    );
  }

  const expectedSourceIds =
    sources.map(
      source => source.id
    );

  for (
    let index = 0;
    index <
      expectedSourceIds.length;
    index += 1
  ) {
    if (
      chunk.sourceIds[index] !==
        expectedSourceIds[index]
    ) {
      throw new Error(
        "INVALID_TXT_CHUNK"
      );
    }
  }

  const expectedText =
    sources
      .map(
        source =>
          "[" +
          source.id +
          "]\n" +
          source.text
      )
      .join("\n\n");

  if (
    chunk.text !== expectedText ||
    chunk.charCount !==
      chunk.text.length ||
    chunk.oversized !==
      (
        chunk.charCount >
        targetChars
      )
  ) {
    throw new Error(
      "INVALID_TXT_CHUNK"
    );
  }

  if (
    chunk.charCount >
      MAX_TXT_CHUNK_LENGTH
  ) {
    throw new Error(
      "TXT_CHUNK_TOO_LARGE"
    );
  }

  if (chunk.oversized) {
    throw new Error(
      "TXT_OVERSIZED_NOT_SUPPORTED"
    );
  }

  return {
    sources: sources,
    chunk: chunk,
    targetChars: targetChars
  };
}

function validateKnowledgeData(data, allowedSourceIds) {
  if (
    !data ||
    !Array.isArray(data.categories) ||
    data.categories.length === 0 ||
    data.categories.length > 10
  ) {
    throw new Error("INVALID_CATEGORIES");
  }

  let totalPoints = 0;

  data.categories.forEach(category => {
    if (
      !category ||
      typeof category.name !== "string" ||
      !category.name.trim() ||
      category.name.length > 60 ||
      !Array.isArray(category.knowledgePoints) ||
      category.knowledgePoints.length === 0 ||
      category.knowledgePoints.length > 20
    ) {
      throw new Error("INVALID_CATEGORY");
    }

    category.knowledgePoints.forEach(point => {
      totalPoints += 1;

      if (
        !point ||
        typeof point.title !== "string" ||
        !point.title.trim() ||
        point.title.length > 100 ||
        typeof point.summary !== "string" ||
        !point.summary.trim() ||
        point.summary.length > 1000 ||
        !Array.isArray(point.sourceIds) ||
        point.sourceIds.length === 0 ||
        point.sourceIds.length > 6
      ) {
        throw new Error("INVALID_KNOWLEDGE_POINT");
      }

      point.sourceIds.forEach(sourceId => {
        if (!allowedSourceIds.has(sourceId)) {
          throw new Error(
            "UNKNOWN_SOURCE_ID"
          );
        }
      });
    });
  });

  if (totalPoints > 40) {
    throw new Error("TOO_MANY_KNOWLEDGE_POINTS");
  }
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();

  if (!wxContext.OPENID) {
    return {
      ok: false,
      errorCode: "NO_WECHAT_IDENTITY",
      message: "无法确认微信调用者身份"
    };
  }

  const enablePublicAi = process.env.ENABLE_PUBLIC_AI === "true";
  const testOpenId = process.env.AI_TEST_OPENID;

  if (!enablePublicAi) {
    if (!testOpenId) {
      return {
        ok: false,
        errorCode: "MISSING_TEST_WHITELIST",
        message: "AI 测试白名单尚未配置"
      };
    }

    if (wxContext.OPENID !== testOpenId) {
      return {
        ok: false,
        errorCode: "AI_TEST_NOT_ALLOWED",
        message: "当前账号暂未开放 AI 测试"
      };
    }
  }

  if (event && event.checkWhitelistOnly === true) {
    return {
      ok: true,
      whitelistMatched: true,
      publicAiEnabled: enablePublicAi,
      message: enablePublicAi
        ? "全量 AI 已开启，未调用模型"
        : "白名单匹配成功，未调用模型"
    };
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    return {
      ok: false,
      errorCode: "MISSING_API_KEY",
      message: "云函数尚未配置模型密钥"
    };
  }

  if (
    event &&
    event.inputType !== undefined &&
    event.inputType !== "note" &&
    event.inputType !== "txt"
  ) {
    return {
      ok: false,
      errorCode:
        "UNSUPPORTED_INPUT_TYPE",
      message:
        "暂不支持这种 AI 整理输入类型"
    };
  }

  let sources;
  let sourceText;

  if (
    event &&
    event.inputType === "txt"
  ) {
    let txtInput;

    try {
      txtInput =
        validateTxtProcessing(
          event.processing
        );
    } catch (error) {
      return {
        ok: false,
        errorCode: error.message,
        message:
          "TXT 处理数据无效或暂不支持当前 TXT"
      };
    }

    // TXT 的 Source 已经由客户端 2A 建立。
    // 此处禁止重新 createSources。
    sources =
      txtInput.sources;

    // 使用已经验证过、且与真实 Sources
    // 严格一致的单 Chunk 文本。
    sourceText =
      txtInput.chunk.text;
  } else {
    // 保持原 Note 链路。
    if (
      !event ||
      typeof event.text !== "string"
    ) {
      return {
        ok: false,
        errorCode: "INVALID_INPUT",
        message:
          "没有收到有效的文字笔记"
      };
    }

    const text =
      normalizeText(event.text);

    if (
      !text ||
      text.length >
        MAX_INPUT_LENGTH
    ) {
      return {
        ok: false,
        errorCode:
          "INVALID_INPUT_LENGTH",
        message:
          `当前测试仅支持 1～${MAX_INPUT_LENGTH} 个字符`
      };
    }

    try {
      sources =
        createSources(text);
    } catch (error) {
      return {
        ok: false,
        errorCode: error.message,
        message:
          "无法生成有效的原文段落"
      };
    }

    sourceText =
      buildSourceText(sources);
  }

  const allowedSourceIds =
    new Set(
      sources.map(
        source => source.id
      )
    );

  try {
    const messages =
  noteAnalysisTask
    .buildMessages(
      sourceText
    );

const providerResult =
  await deepSeekProvider.generate({
    apiKey: apiKey,
    messages: messages
  });

  const content =
  providerResult.content;

    if (
      typeof content !== "string" ||
      !content.trim()
    ) {
      throw new Error("EMPTY_MODEL_CONTENT");
    }

    let knowledgeData;

    try {
      knowledgeData = JSON.parse(content);
    } catch (error) {
      throw new Error(
        "INVALID_MODEL_JSON"
      );
    }

    validateKnowledgeData(
      knowledgeData,
      allowedSourceIds
    );

    // 返回来源映射。
    // 前端以后可以用 sourceIds 找到真实原文片段。
    return {
      ok: true,

      provider:
  providerResult.provider,

model:
  providerResult.model,

      data: knowledgeData,

      sources: sources,

      usage:
  providerResult.usage
    };
  } catch (error) {
    console.error(
      "AI 整理失败：",
      error.message,
      error.statusCode || ""
    );

    return {
      ok: false,
      errorCode: "AI_REQUEST_FAILED",
      message:
        "AI 整理未完成。本次不会自动重试，请稍后手动重试。"
    };
  }
};