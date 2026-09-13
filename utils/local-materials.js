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

function findKnowledgePointById(material, pointId) {
  if (
    !material.aiAnalysis ||
    !material.aiAnalysis.data ||
    !Array.isArray(material.aiAnalysis.data.categories)
  ) {
    return null;
  }

  for (let cIdx = 0; cIdx < material.aiAnalysis.data.categories.length; cIdx++) {
    const category = material.aiAnalysis.data.categories[cIdx];
    const points = Array.isArray(category.knowledgePoints) ? category.knowledgePoints : [];
    for (let pIdx = 0; pIdx < points.length; pIdx++) {
      const pid = points[pIdx].id || ("kp_" + cIdx + "_" + pIdx);
      if (pid === pointId) {
        if (!points[pIdx].id) {
          points[pIdx].id = pid;
        }
        return {
          categoryIndex: cIdx,
          pointIndex: pIdx,
          category: category,
          point: points[pIdx]
        };
      }
    }
  }

  return null;
}

function updateMaterialKnowledgePointById(
  materialId,
  pointId,
  changes
) {
  if (
    typeof materialId !== "string" ||
    !materialId ||
    typeof pointId !== "string" ||
    !pointId
  ) {
    throw new Error(
      "缺少有效的资料或知识点编号"
    );
  }

  const title =
    typeof changes.title === "string"
      ? changes.title.trim()
      : "";

  const summary =
    typeof changes.summary === "string"
      ? changes.summary.trim()
      : "";

  if (!title || !summary) {
    throw new Error(
      "知识点名称和解释不能为空"
    );
  }

  if (
    title.length > 100 ||
    summary.length > 1000
  ) {
    throw new Error(
      "知识点名称或解释超过长度限制"
    );
  }

  const materials = readMaterials();

  const material =
    materials.find(
      item => item.id === materialId
    );

  if (!material) {
    throw new Error(
      "没有找到对应资料"
    );
  }

  const found =
    findKnowledgePointById(
      material,
      pointId
    );

  if (!found) {
    throw new Error(
      "没有找到对应知识点"
    );
  }

  const point = found.point;

  const original =
    point.userEdit &&
    point.userEdit.original
      ? point.userEdit.original
      : {
          title: point.title,
          summary: point.summary
        };

  point.title = title;
  point.summary = summary;

  point.userEdit = {
    modified: true,
    modifiedAt: Date.now(),
    original: original
  };

  material.updatedAt = Date.now();

  writeMaterials(materials);

  return {
    id: point.id,
    title: point.title,
    summary: point.summary,
    sourceIds:
      Array.isArray(point.sourceIds)
        ? point.sourceIds
        : [],
    userEdit: point.userEdit
  };
}

function moveMaterialKnowledgePointById(
  materialId,
  pointId,
  targetCategoryName
) {
  if (
    typeof materialId !== "string" ||
    !materialId ||
    typeof pointId !== "string" ||
    !pointId ||
    typeof targetCategoryName !== "string" ||
    !targetCategoryName.trim()
  ) {
    throw new Error(
      "移动知识点所需参数不完整"
    );
  }

  const name = targetCategoryName.trim();
  const materials = readMaterials();

  const material =
    materials.find(
      item => item.id === materialId
    );

  if (!material) {
    throw new Error(
      "没有找到对应资料"
    );
  }

  const found =
    findKnowledgePointById(
      material,
      pointId
    );

  if (!found) {
    throw new Error(
      "没有找到对应知识点"
    );
  }

  const categories =
    material.aiAnalysis.data.categories;

  const targetCategory =
    categories.find(c => c.name === name);

  if (!targetCategory) {
    throw new Error("目标分类不存在");
  }

  if (found.category.name === name) {
    return {
      moved: false,
      categoryName: name
    };
  }

  found.category.knowledgePoints.splice(
    found.pointIndex,
    1
  );

  if (!Array.isArray(targetCategory.knowledgePoints)) {
    targetCategory.knowledgePoints = [];
  }

  targetCategory.knowledgePoints.push(
    found.point
  );

  material.updatedAt = Date.now();

  writeMaterials(materials);

  return {
    moved: true,
    categoryName: name
  };
}

function deleteMaterialKnowledgePointById(
  materialId,
  pointId
) {
  if (
    typeof materialId !== "string" ||
    !materialId ||
    typeof pointId !== "string" ||
    !pointId
  ) {
    throw new Error(
      "缺少有效的资料或知识点编号"
    );
  }

  const materials = readMaterials();

  const material =
    materials.find(
      item => item.id === materialId
    );

  if (!material) {
    throw new Error(
      "没有找到对应资料"
    );
  }

  const found =
    findKnowledgePointById(
      material,
      pointId
    );

  if (!found) {
    throw new Error(
      "没有找到对应知识点"
    );
  }

  found.category.knowledgePoints.splice(
    found.pointIndex,
    1
  );

  material.updatedAt = Date.now();

  writeMaterials(materials);

  return { success: true };
}

function addMaterialCategory(
  materialId,
  categoryName
) {
  if (
    typeof materialId !== "string" ||
    !materialId
  ) {
    throw new Error(
      "缺少有效的资料编号"
    );
  }

  const name =
    typeof categoryName === "string"
      ? categoryName.trim()
      : "";

  if (!name) {
    throw new Error(
      "分类名称不能为空"
    );
  }

  if (name.length > 50) {
    throw new Error(
      "分类名称超过长度限制"
    );
  }

  const materials = readMaterials();

  const material =
    materials.find(
      item => item.id === materialId
    );

  if (
    !material ||
    !material.aiAnalysis ||
    !material.aiAnalysis.data
  ) {
    throw new Error(
      "没有找到对应资料或 AI 整理结果"
    );
  }

  if (
    !Array.isArray(
      material.aiAnalysis.data.categories
    )
  ) {
    material.aiAnalysis.data.categories = [];
  }

  const exists =
    material.aiAnalysis.data.categories.some(
      c => c.name === name
    );

  if (exists) {
    throw new Error(
      "分类名称已存在"
    );
  }

  material.aiAnalysis.data.categories.push({
    name: name,
    knowledgePoints: []
  });

  material.updatedAt = Date.now();

  writeMaterials(materials);

  return { success: true, name: name };
}

function addMaterialKnowledgePoint(materialId, input) {
  if (
    typeof materialId !== "string" ||
    !materialId
  ) {
    throw new Error(
      "缺少有效的资料编号"
    );
  }

  const categoryName =
    typeof input.categoryName === "string"
      ? input.categoryName.trim()
      : "";

  const title =
    typeof input.title === "string"
      ? input.title.trim()
      : "";

  const summary =
    typeof input.summary === "string"
      ? input.summary.trim()
      : "";

  const sourceIds = Array.isArray(input.sourceIds)
    ? input.sourceIds.filter(Boolean)
    : [];

  if (!categoryName || !title || !summary) {
    throw new Error(
      "请选择分类，并填写知识点名称和解释"
    );
  }

  if (title.length > 100 || summary.length > 1000) {
    throw new Error(
      "名称最多 100 字符，解释最多 1000 字符"
    );
  }

  if (sourceIds.length === 0) {
    throw new Error(
      "用户新增知识点至少需要关联一个现有原文段落"
    );
  }

  const materials = readMaterials();

  const material = materials.find(
    item => item.id === materialId
  );

  if (
    !material ||
    !material.aiAnalysis ||
    !material.aiAnalysis.data ||
    !Array.isArray(material.aiAnalysis.data.categories)
  ) {
    throw new Error(
      "没有找到对应资料或 AI 整理结果"
    );
  }

  const category = material.aiAnalysis.data.categories.find(
    c => c.name === categoryName
  );

  if (!category) {
    throw new Error("找不到目标分类");
  }

  const allowedSources = new Set(
    (material.processing && material.processing.sources
      ? material.processing.sources
      : material.aiAnalysis.sources || []
    ).map(s => s.id)
  );

  const invalidSource = sourceIds.find(id => !allowedSources.has(id));
  if (invalidSource) {
    throw new Error("关联了不存在的原文段落: " + invalidSource);
  }

  if (!Array.isArray(category.knowledgePoints)) {
    category.knowledgePoints = [];
  }

  const now = Date.now();
  const pointId = "user_kp_" + now + "_" + Math.random().toString(36).substring(2, 7);

  const newPoint = {
    id: pointId,
    title: title,
    summary: summary,
    sourceIds: sourceIds,
    userCreated: {
      created: true,
      createdAt: now
    }
  };

  category.knowledgePoints.push(newPoint);
  material.updatedAt = now;

  writeMaterials(materials);

  return newPoint;
}

module.exports = {
  readMaterials,
  saveTxtMaterial,
  saveMaterialAiAnalysis,
  deleteMaterial,
  updateMaterialKnowledgePointById,
  moveMaterialKnowledgePointById,
  deleteMaterialKnowledgePointById,
  addMaterialCategory,
  addMaterialKnowledgePoint
};