const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const deepSeekProvider =
  require("./deepseek-provider");

// 第一阶段只处理短文字笔记。
// 这是测试限制，不是最终产品限制。
const MAX_INPUT_LENGTH = 2000;

// 防止一次请求切出过多段落。
const MAX_SOURCE_COUNT = 30;

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

function buildMessages(
  sourceText
) {
  return [
    {
      role: "system",

      content: [
        "你是学习资料整理助手。",
        "任务是把用户提供的学习笔记整理为知识结构。",
        "只根据资料本身进行整理。",
        "不要编造资料中不存在的出处。",
        "不要进行事实纠错或额外知识拓展。",
        "sourceIds 只能引用资料中实际出现的 P 编号。",
        "同一个知识点可以引用多个真实来源段落。",
        "解释应简短、清楚，避免重复。",
        "只输出 JSON。"
      ].join("\n")
    },

    {
      role: "user",

      content: [
        "请整理下面的学习笔记。",
        "",
        "返回 JSON 的结构必须为：",
        "{",
        '  "categories": [',
        "    {",
        '      "name": "分类名称",',
        '      "knowledgePoints": [',
        "        {",
        '          "title": "知识点名称",',
        '          "summary": "简短解释",',
        '          "sourceIds": ["P1"]',
        "        }",
        "      ]",
        "    }",
        "  ]",
        "}",
        "",
        "不要输出 JSON 之外的文字。",
        "",
        "学习资料：",
        sourceText
      ].join("\n")
    }
  ];
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

  const testOpenId = process.env.AI_TEST_OPENID;

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

  if (event && event.checkWhitelistOnly === true) {
    return {
      ok: true,
      whitelistMatched: true,
      message: "白名单匹配成功，未调用模型"
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
    !event ||
    typeof event.text !== "string"
  ) {
    return {
      ok: false,
      errorCode: "INVALID_INPUT",
      message: "没有收到有效的文字笔记"
    };
  }

  const text = normalizeText(event.text);

  if (
    !text ||
    text.length > MAX_INPUT_LENGTH
  ) {
    return {
      ok: false,
      errorCode: "INVALID_INPUT_LENGTH",
      message: `当前测试仅支持 1～${MAX_INPUT_LENGTH} 个字符`
    };
  }

  let sources;

  try {
    sources = createSources(text);
  } catch (error) {
    return {
      ok: false,
      errorCode: error.message,
      message: "无法生成有效的原文段落"
    };
  }

  const allowedSourceIds = new Set(
    sources.map(source => source.id)
  );

  const sourceText = buildSourceText(sources);

  try {
    const messages =
  buildMessages(
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