const STORAGE_KEY =
  "study-notes-demo:local-materials:v1";

  function validateProcessing(
    processing
  ) {
    if (
      processing === undefined ||
      processing === null
    ) {
      return true;
    }

    if (
      typeof processing !== "object" ||
      processing.version !== 1 ||

      !Array.isArray(
        processing.sources
      ) ||
      !Array.isArray(
        processing.chunks
      )
    ) {
      return false;
    }

    const targetChars =
    processing.targetChars === undefined
      ? 2000
      : processing.targetChars;

  if (
    !Number.isInteger(targetChars) ||
    targetChars <= 0
  ) {
    return false;
  }

    const sources =
      processing.sources;

    const chunks =
      processing.chunks;

    if (!sources.length) {
      return false;
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
        return false;
      }
    }

    if (!chunks.length) {
      return false;
    }

    const sourceIds =
      sources.map(
        source => source.id
      );

    const chunkSourceIds = [];

    for (
      let index = 0;
      index < chunks.length;
      index += 1
    ) {
      const chunk =
        chunks[index];

      if (
        !chunk ||
        typeof chunk !== "object" ||
        chunk.id !==
          "chunk_" + (index + 1) ||
        !Array.isArray(
          chunk.sourceIds
        ) ||
        !chunk.sourceIds.length ||
        typeof chunk.text !==
          "string" ||
        chunk.charCount !==
          chunk.text.length ||
        typeof chunk.oversized !==
          "boolean"
      ) {
        return false;
      }

      const expectedTextParts = [];

      for (
        let sourceIndex = 0;
        sourceIndex <
          chunk.sourceIds.length;
        sourceIndex += 1
      ) {
        const sourceId =
          chunk.sourceIds[
            sourceIndex
          ];

        const globalIndex =
          chunkSourceIds.length;

        if (
          sourceId !==
          sourceIds[globalIndex]
        ) {
          return false;
        }

        const source =
          sources[globalIndex];

        expectedTextParts.push(
          "[" +
          source.id +
          "]\n" +
          source.text
        );

        chunkSourceIds.push(
          sourceId
        );
      }

      const expectedText =
        expectedTextParts.join(
          "\n\n"
        );

      if (
        chunk.text !== expectedText ||
        chunk.oversized !==
          (
            chunk.charCount >
            targetChars
          )
      ) {
        return false;
      }
    }

    return (
      chunkSourceIds.length ===
      sourceIds.length
    );
  }

function validateMaterial(material) {
  return (
    material &&
    typeof material.id === "string" &&
    material.id.length > 0 &&

    typeof material.type === "string" &&
    material.type === "txt" &&

    typeof material.fileName === "string" &&
    material.fileName.trim().length > 0 &&
    material.fileName.length <= 255 &&

    typeof material.content === "string" &&
    material.content.trim().length > 0 &&

    typeof material.importedAt === "number" &&
    Number.isFinite(material.importedAt) &&

    typeof material.updatedAt === "number" &&
    Number.isFinite(material.updatedAt) &&

    (
      material.aiAnalysis === null ||
      material.aiAnalysis === undefined ||
      typeof material.aiAnalysis === "object"
    ) &&

    validateProcessing(
      material.processing
    )
  );
}

function readMaterials() {
  const saved =
    wx.getStorageSync(
      STORAGE_KEY
    );

  if (saved === "") {
    return [];
  }

  if (
    !saved ||
    saved.version !== 1 ||
    !Array.isArray(saved.materials) ||
    !saved.materials.every(
      validateMaterial
    )
  ) {
    throw new Error(
      "本地资料数据格式异常，已停止读取和覆盖"
    );
  }

  const ids =
    saved.materials.map(
      item => item.id
    );

  if (
    new Set(ids).size !==
    ids.length
  ) {
    throw new Error(
      "本地资料编号重复，已停止读取和覆盖"
    );
  }

  return saved.materials
    .slice()
    .sort(
      (a, b) =>
        b.updatedAt -
        a.updatedAt
    );
}

function writeMaterials(
  materials
) {
  if (
    !Array.isArray(materials) ||
    !materials.every(
      validateMaterial
    )
  ) {
    throw new Error(
      "准备保存的资料格式异常，已停止写入"
    );
  }

  wx.setStorageSync(
    STORAGE_KEY,
    {
      version: 1,
      materials: materials
    }
  );
}

function createMaterialId() {
  return (
    "material-" +
    Date.now() +
    "-" +
    Math.random()
      .toString(36)
      .slice(2, 10)
  );
}

function saveTxtMaterial(
  fileName,
  content,
  processing
) {
  const safeName =
    typeof fileName === "string"
      ? fileName.trim()
      : "";

  const safeContent =
    typeof content === "string"
      ? content
      : "";

  if (
    !safeName ||
    safeName.length > 255
  ) {
    throw new Error(
      "TXT 文件名无效"
    );
  }

  if (!safeContent.trim()) {
    throw new Error(
      "TXT 正文不能为空"
    );
  }

  // 与当前 TXT 读取测试保持一致。
  // 这里再次做服务逻辑层保护。
  if (
    safeContent.length >
    200000
  ) {
    throw new Error(
      "TXT 正文超过当前测试限制"
    );
  }

  if (
    !validateProcessing(
      processing
    )
  ) {
    throw new Error(
      "TXT 处理数据格式异常"
    );
  }

  const materials =
    readMaterials();

  let id;

  do {
    id = createMaterialId();
  } while (
    materials.some(
      item => item.id === id
    )
  );

  const now = Date.now();

  const material = {
    id: id,
    type: "txt",

    fileName: safeName,

    // 保存读取后的文本副本，
    // 不保存微信临时路径。
    content: safeContent,

    processing:
  processing === undefined
    ? null
    : processing,

    importedAt: now,
    updatedAt: now,

    aiAnalysis: null
  };

  materials.unshift(
    material
  );

  writeMaterials(
    materials
  );

  return material;
}

function validateAiData(
  data,
  allowedSourceIds
) {
  if (
    !data ||
    typeof data !== "object" ||
    !Array.isArray(
      data.categories
    ) ||
    data.categories.length === 0 ||
    data.categories.length > 10
  ) {
    return false;
  }

  let totalPoints = 0;

  for (
    const category of
    data.categories
  ) {
    if (
      !category ||
      typeof category !== "object" ||
      typeof category.name !==
        "string" ||
      !category.name.trim() ||
      category.name.length > 60 ||
      !Array.isArray(
        category.knowledgePoints
      ) ||
      category.knowledgePoints.length ===
        0 ||
      category.knowledgePoints.length >
        20
    ) {
      return false;
    }

    for (
      const point of
      category.knowledgePoints
    ) {
      totalPoints += 1;

      if (
        totalPoints > 40 ||
        !point ||
        typeof point !== "object" ||
        typeof point.title !==
          "string" ||
        !point.title.trim() ||
        point.title.length > 100 ||
        typeof point.summary !==
          "string" ||
        !point.summary.trim() ||
        point.summary.length > 1000 ||
        !Array.isArray(
          point.sourceIds
        ) ||
        point.sourceIds.length === 0 ||
        point.sourceIds.length > 6
      ) {
        return false;
      }

      for (
        const sourceId of
        point.sourceIds
      ) {
        if (
          typeof sourceId !==
            "string" ||
          !allowedSourceIds.has(
            sourceId
          )
        ) {
          return false;
        }
      }
    }
  }

  return true;
}

function saveMaterialAiAnalysis(
  materialId,
  analysis
) {
  if (
    typeof materialId !== "string" ||
    !materialId
  ) {
    throw new Error(
      "缺少有效的资料编号"
    );
  }

  if (
    !analysis ||
    typeof analysis !== "object" ||
    !analysis.data ||
    typeof analysis.data !==
      "object"
  ) {
    throw new Error(
      "AI 整理结果格式不正确"
    );
  }

  const materials =
    readMaterials();

  const index =
    materials.findIndex(
      item =>
        item.id === materialId
    );

  if (index === -1) {
    throw new Error(
      "没有找到对应资料，未保存 AI 结果"
    );
  }

  const material =
    materials[index];

  if (
    !material.processing ||
    !validateProcessing(
      material.processing
    )
  ) {
    throw new Error(
      "TXT 来源数据无效，未保存 AI 结果"
    );
  }

  const allowedSourceIds =
    new Set(
      material.processing.sources.map(
        source => source.id
      )
    );

  if (
    !validateAiData(
      analysis.data,
      allowedSourceIds
    )
  ) {
    throw new Error(
      "AI 整理结果格式或原文出处无效"
    );
  }

  const now = Date.now();

  const aiAnalysis = {
    analyzedAt: now,

    model:
      typeof analysis.model ===
        "string"
        ? analysis.model
        : "",

    data: analysis.data,

    // TXT 的 Source 真相只能来自
    // 已持久化的 processing.sources。
    sources:
      material.processing.sources
  };

  materials[index] = {
    ...material,
    updatedAt: now,
    aiAnalysis: aiAnalysis
  };

  writeMaterials(
    materials
  );

  return aiAnalysis;
}

function deleteMaterial(id) {
  if (
    typeof id !== "string" ||
    !id
  ) {
    throw new Error(
      "缺少有效的资料编号"
    );
  }

  const materials =
    readMaterials();

  const exists =
    materials.some(
      item => item.id === id
    );

  if (!exists) {
    throw new Error(
      "没有找到对应资料"
    );
  }

  const remaining =
    materials.filter(
      item => item.id !== id
    );

  writeMaterials(
    remaining
  );
}

module.exports = {
  readMaterials,
  saveTxtMaterial,
  saveMaterialAiAnalysis,
  deleteMaterial
};