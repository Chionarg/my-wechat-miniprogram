const STORAGE_KEY =
  "study-notes-demo:local-materials:v1";

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
  content
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
  deleteMaterial
};