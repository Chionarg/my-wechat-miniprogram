function buildMessages(
  sourceText
) {
  if (
    typeof sourceText !== "string" ||
    !sourceText.trim()
  ) {
    throw new Error(
      "INVALID_TASK_SOURCE_TEXT"
    );
  }

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

module.exports = {
  buildMessages
};