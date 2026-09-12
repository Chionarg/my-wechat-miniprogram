const STORAGE_KEY = "study-notes-demo:local-notes:v1";

function createKnowledgePointId() {
  return (
    "kp-" +
    Date.now() +
    "-" +
    Math.random()
      .toString(36)
      .slice(2, 10)
  );
}

function ensureKnowledgePointIds(notes) {
  let changed = false;

  const existingIds = new Set();

  notes.forEach(note => {
    const categories =
      note &&
      note.aiAnalysis &&
      note.aiAnalysis.data &&
      Array.isArray(
        note.aiAnalysis.data.categories
      )
        ? note.aiAnalysis.data.categories
        : [];

    categories.forEach(category => {
      const points =
        Array.isArray(
          category.knowledgePoints
        )
          ? category.knowledgePoints
          : [];

      points.forEach(point => {
        if (
          typeof point.id === "string" &&
          point.id &&
          !existingIds.has(point.id)
        ) {
          existingIds.add(point.id);
          return;
        }

        let id;

        do {
          id =
            createKnowledgePointId();
        } while (existingIds.has(id));

        point.id = id;
        existingIds.add(id);
        changed = true;
      });
    });
  });

  return changed;
}

function validateAiAnalysis(aiAnalysis) {
  if (aiAnalysis === undefined || aiAnalysis === null) {
    return true;
  }

  return (
    typeof aiAnalysis === "object" &&
    typeof aiAnalysis.sourceUpdatedAt === "number" &&
    typeof aiAnalysis.analyzedAt === "number" &&
    typeof aiAnalysis.model === "string" &&
    aiAnalysis.data &&
    Array.isArray(aiAnalysis.data.categories) &&
    Array.isArray(aiAnalysis.sources)
  );
}

function validateNote(note) {
  return (
    note &&
    typeof note.id === "string" &&
    note.id.length > 0 &&
    typeof note.title === "string" &&
    note.title.trim().length > 0 &&
    note.title.length <= 60 &&
    typeof note.content === "string" &&
    note.content.trim().length > 0 &&
    note.content.length <= 10000 &&
    typeof note.updatedAt === "number" &&
Number.isFinite(note.updatedAt) &&
(
  note.contentUpdatedAt === undefined ||
  (
    typeof note.contentUpdatedAt === "number" &&
    Number.isFinite(
      note.contentUpdatedAt
    )
  )
) &&
validateAiAnalysis(note.aiAnalysis)
  );
}

function readNotes() {
  const saved = wx.getStorageSync(STORAGE_KEY);

  if (saved === "") {
    return [];
  }

  if (
    !saved ||
    saved.version !== 1 ||
    !Array.isArray(saved.notes) ||
    !saved.notes.every(validateNote)
  ) {
    throw new Error(
      "本地笔记数据格式异常，已停止读取和覆盖"
    );
  }

  const ids =
  saved.notes.map(
    note => note.id
  );

if (
  new Set(ids).size !== ids.length
) {
  throw new Error(
    "本地笔记编号重复，已停止读取和覆盖"
  );
}

// 先复制最外层数组。
// 本轮本地数据结构简单，迁移只补知识点 id。
const notes =
  saved.notes.slice();

const migrated =
  ensureKnowledgePointIds(notes);

if (migrated) {
  try {
    wx.setStorageSync(
      STORAGE_KEY,
      {
        version: 1,
        notes: notes
      }
    );
  } catch (error) {
    console.error(
      "知识点 ID 迁移保存失败：",
      error
    );

    throw new Error(
      "知识点数据升级失败，已停止继续操作"
    );
  }
}

return notes.sort(
  (a, b) =>
    b.updatedAt - a.updatedAt
);
}

function writeNotes(notes) {
  if (
    !Array.isArray(notes) ||
    !notes.every(validateNote)
  ) {
    throw new Error(
      "准备保存的笔记数据格式异常，已停止写入"
    );
  }

  wx.setStorageSync(STORAGE_KEY, {
    version: 1,
    notes: notes
  });
}

function saveNote(input) {
  const title = input.title.trim();
  const content = input.content;

  if (
    !title ||
    !content.trim() ||
    title.length > 60 ||
    content.length > 10000
  ) {
    throw new Error(
      "笔记不能为空，标题最多 60 字符，正文最多 10000 字符"
    );
  }

  const notes = readNotes();
  let id = input.id;

  if (id) {
    const index = notes.findIndex(
      note => note.id === id
    );

    if (index === -1) {
      throw new Error(
        "这份笔记已不存在，未执行保存"
      );
    }

    const oldNote = notes[index];

    const oldContentUpdatedAt =
    typeof oldNote.contentUpdatedAt === "number"
      ? oldNote.contentUpdatedAt
      : oldNote.updatedAt;
  
  const contentChanged =
    oldNote.content !== content;

    notes[index] = {
      ...oldNote,

      id: id,
      title: title,
      content: content,

      updatedAt: Date.now(),

      contentUpdatedAt:
        contentChanged
          ? Date.now()
          : oldContentUpdatedAt,

      aiAnalysis: oldNote.aiAnalysis || null
    };
  } else {
    do {
      id =
        "note-" +
        Date.now() +
        "-" +
        Math.random()
          .toString(36)
          .slice(2, 10);
    } while (
      notes.some(note => note.id === id)
    );

    const now = Date.now();

notes.unshift({
  id: id,
  title: title,
  content: content,
  updatedAt: now,
  contentUpdatedAt: now,
  aiAnalysis: null
});
  }

  writeNotes(notes);

  return id;
}

function saveAiAnalysis(noteId, analysis) {
  if (
    typeof noteId !== "string" ||
    !noteId
  ) {
    throw new Error(
      "缺少有效的笔记编号"
    );
  }

  if (
    !analysis ||
    !analysis.data ||
    !Array.isArray(
      analysis.data.categories
    ) ||
    !Array.isArray(analysis.sources)
  ) {
    throw new Error(
      "AI 整理结果格式不正确"
    );
  }

  const notes = readNotes();

  const index = notes.findIndex(
    note => note.id === noteId
  );

  if (index === -1) {
    throw new Error(
      "没有找到对应笔记，未保存 AI 结果"
    );
  }

  const note = notes[index];

  const categories =
  analysis.data.categories;

const usedIds = new Set();

categories.forEach(category => {
  if (
    !Array.isArray(
      category.knowledgePoints
    )
  ) {
    return;
  }

  category.knowledgePoints
    .forEach(point => {
      let id =
        typeof point.id === "string"
          ? point.id
          : "";

      if (
        !id ||
        usedIds.has(id)
      ) {
        do {
          id =
            createKnowledgePointId();
        } while (usedIds.has(id));
      }

      point.id = id;
      usedIds.add(id);
    });
});

  note.aiAnalysis = {
    sourceUpdatedAt:
      typeof note.contentUpdatedAt === "number"
        ? note.contentUpdatedAt
        : note.updatedAt,

    analyzedAt: Date.now(),
    model:
      typeof analysis.model === "string"
        ? analysis.model
        : "",
    data: analysis.data,
    sources: analysis.sources
  };

  writeNotes(notes);

  return note.aiAnalysis;
}

function findKnowledgePointById(
  note,
  pointId
) {
  if (
    !note ||
    !note.aiAnalysis ||
    !note.aiAnalysis.data ||
    !Array.isArray(
      note.aiAnalysis.data.categories
    )
  ) {
    return null;
  }

  for (
    let categoryIndex = 0;
    categoryIndex <
      note.aiAnalysis.data
        .categories.length;
    categoryIndex++
  ) {
    const category =
      note.aiAnalysis.data
        .categories[categoryIndex];

    const points =
      Array.isArray(
        category.knowledgePoints
      )
        ? category.knowledgePoints
        : [];

    const pointIndex =
      points.findIndex(
        point =>
          point.id === pointId
      );

    if (pointIndex !== -1) {
      return {
        category,
        categoryIndex,
        point: points[pointIndex],
        pointIndex
      };
    }
  }

  return null;
}

function updateAiKnowledgePointById(
  noteId,
  pointId,
  changes
) {
  if (
    typeof noteId !== "string" ||
    !noteId ||
    typeof pointId !== "string" ||
    !pointId
  ) {
    throw new Error(
      "缺少有效的笔记或知识点编号"
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

  const notes = readNotes();

  const note =
    notes.find(
      item => item.id === noteId
    );

  if (!note) {
    throw new Error(
      "没有找到对应笔记"
    );
  }

  const found =
    findKnowledgePointById(
      note,
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

  writeNotes(notes);

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

function updateAiKnowledgePoint(
  noteId,
  categoryIndex,
  pointIndex,
  changes
) {
  if (
    typeof noteId !== "string" ||
    !noteId
  ) {
    throw new Error(
      "缺少有效的笔记编号"
    );
  }

  if (
    !Number.isInteger(categoryIndex) ||
    categoryIndex < 0 ||
    !Number.isInteger(pointIndex) ||
    pointIndex < 0
  ) {
    throw new Error(
      "知识点位置无效"
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

  const notes = readNotes();

  const noteIndex = notes.findIndex(
    note => note.id === noteId
  );

  if (noteIndex === -1) {
    throw new Error(
      "没有找到对应笔记"
    );
  }

  const note = notes[noteIndex];

  if (
    !note.aiAnalysis ||
    !note.aiAnalysis.data ||
    !Array.isArray(
      note.aiAnalysis.data.categories
    )
  ) {
    throw new Error(
      "没有可修改的 AI 整理结果"
    );
  }

  const category =
    note.aiAnalysis.data
      .categories[categoryIndex];

  if (
    !category ||
    !Array.isArray(
      category.knowledgePoints
    )
  ) {
    throw new Error(
      "没有找到对应分类"
    );
  }

  const point =
    category.knowledgePoints[
      pointIndex
    ];

  if (!point) {
    throw new Error(
      "没有找到对应知识点"
    );
  }

  // 第一次用户修改前，保留 AI 原始内容。
  // 后续继续编辑，不覆盖这份原始快照。
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

  // sourceIds 完全不修改。
  // 原文来源映射也完全不修改。

  writeNotes(notes);

  return {
    title: point.title,
    summary: point.summary,
    sourceIds:
      Array.isArray(point.sourceIds)
        ? point.sourceIds
        : [],
    userEdit: point.userEdit
  };
}

function addAiKnowledgePoint(
  noteId,
  input
) {
  if (
    typeof noteId !== "string" ||
    !noteId
  ) {
    throw new Error(
      "缺少有效的笔记编号"
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

  const sourceIds =
    Array.isArray(input.sourceIds)
      ? Array.from(
          new Set(
            input.sourceIds.filter(
              id =>
                typeof id === "string" &&
                id
            )
          )
        )
      : [];

  if (
    !categoryName ||
    !title ||
    !summary
  ) {
    throw new Error(
      "分类、知识点名称和解释不能为空"
    );
  }

  if (
    categoryName.length > 60 ||
    title.length > 100 ||
    summary.length > 1000
  ) {
    throw new Error(
      "新增内容超过长度限制"
    );
  }

  if (
    sourceIds.length === 0 ||
    sourceIds.length > 6
  ) {
    throw new Error(
      "请选择 1～6 个原文出处"
    );
  }

  const notes = readNotes();

  const note =
    notes.find(
      item => item.id === noteId
    );

  if (!note) {
    throw new Error(
      "没有找到对应笔记"
    );
  }

  if (
    !note.aiAnalysis ||
    !note.aiAnalysis.data ||
    !Array.isArray(
      note.aiAnalysis.data.categories
    ) ||
    !Array.isArray(
      note.aiAnalysis.sources
    )
  ) {
    throw new Error(
      "没有可编辑的知识结构"
    );
  }

  const allowedSourceIds =
    new Set(
      note.aiAnalysis.sources.map(
        source => source.id
      )
    );

  sourceIds.forEach(id => {
    if (
      !allowedSourceIds.has(id)
    ) {
      throw new Error(
        "选择了不存在的原文出处"
      );
    }
  });

  const categories =
    note.aiAnalysis.data.categories;

  const category =
    categories.find(
      item =>
        item.name === categoryName
    );

  if (!category) {
    throw new Error(
      "没有找到所选分类"
    );
  }

  if (
    !Array.isArray(
      category.knowledgePoints
    )
  ) {
    throw new Error(
      "分类数据格式异常"
    );
  }

  let pointId;

  const existingIds =
    new Set();

  categories.forEach(item => {
    const points =
      Array.isArray(
        item.knowledgePoints
      )
        ? item.knowledgePoints
        : [];

    points.forEach(point => {
      if (
        typeof point.id === "string"
      ) {
        existingIds.add(
          point.id
        );
      }
    });
  });

  do {
    pointId =
      createKnowledgePointId();
  } while (
    existingIds.has(pointId)
  );

  const newPoint = {
    id: pointId,
    title: title,
    summary: summary,
    sourceIds: sourceIds,

    userCreated: {
      created: true,
      createdAt: Date.now()
    }
  };

  category.knowledgePoints.push(
    newPoint
  );

  writeNotes(notes);

  return newPoint;
}

function addAiCategory(
  noteId,
  categoryName
) {
  if (
    typeof noteId !== "string" ||
    !noteId
  ) {
    throw new Error(
      "缺少有效的笔记编号"
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

  if (name.length > 60) {
    throw new Error(
      "分类名称最多 60 个字符"
    );
  }

  const notes = readNotes();

  const note =
    notes.find(
      item => item.id === noteId
    );

  if (
    !note ||
    !note.aiAnalysis ||
    !note.aiAnalysis.data ||
    !Array.isArray(
      note.aiAnalysis.data.categories
    )
  ) {
    throw new Error(
      "没有可编辑的知识结构"
    );
  }

  const categories =
    note.aiAnalysis.data.categories;

  const duplicated =
    categories.some(
      category =>
        typeof category.name ===
          "string" &&
        category.name.trim() === name
    );

  if (duplicated) {
    throw new Error(
      "已经存在同名分类"
    );
  }

  categories.push({
    name: name,
    knowledgePoints: [],

    userCreated: {
      created: true,
      createdAt: Date.now()
    }
  });

  writeNotes(notes);

  return {
    name: name,
    created: true
  };
}

function moveAiKnowledgePointById(
  noteId,
  pointId,
  targetCategoryName
) {
  if (
    typeof noteId !== "string" ||
    !noteId ||
    typeof pointId !== "string" ||
    !pointId ||
    typeof targetCategoryName !==
      "string" ||
    !targetCategoryName.trim()
  ) {
    throw new Error(
      "移动知识点所需参数不完整"
    );
  }

  const notes = readNotes();

  const note =
    notes.find(
      item => item.id === noteId
    );

  if (
    !note ||
    !note.aiAnalysis ||
    !note.aiAnalysis.data ||
    !Array.isArray(
      note.aiAnalysis.data.categories
    )
  ) {
    throw new Error(
      "没有可编辑的知识结构"
    );
  }

  const categories =
    note.aiAnalysis.data.categories;

  const targetCategory =
    categories.find(
      category =>
        category.name ===
        targetCategoryName.trim()
    );

  if (!targetCategory) {
    throw new Error(
      "没有找到目标分类"
    );
  }

  let point = null;
  let sourceCategory = null;
  let sourcePointIndex = -1;

  for (
    let i = 0;
    i < categories.length;
    i++
  ) {
    const points =
      Array.isArray(
        categories[i]
          .knowledgePoints
      )
        ? categories[i]
            .knowledgePoints
        : [];

    const index =
      points.findIndex(
        item =>
          item.id === pointId
      );

    if (index !== -1) {
      point = points[index];
      sourceCategory =
        categories[i];
      sourcePointIndex =
        index;
      break;
    }
  }

  if (
    !point ||
    !sourceCategory
  ) {
    throw new Error(
      "没有找到对应知识点"
    );
  }

  if (
    sourceCategory ===
    targetCategory
  ) {
    return {
      moved: false,
      categoryName:
        targetCategory.name
    };
  }

  sourceCategory
    .knowledgePoints
    .splice(
      sourcePointIndex,
      1
    );

  targetCategory
    .knowledgePoints
    .push(point);

  // 原分类为空时删除。
  const emptyIndex =
    categories.indexOf(
      sourceCategory
    );

  if (
    sourceCategory
      .knowledgePoints.length === 0 &&
    emptyIndex !== -1
  ) {
    categories.splice(
      emptyIndex,
      1
    );
  }

  writeNotes(notes);

  return {
    moved: true,
    categoryName:
      targetCategory.name
  };
}

function deleteAiKnowledgePointById(
  noteId,
  pointId
) {
  if (
    typeof noteId !== "string" ||
    !noteId ||
    typeof pointId !== "string" ||
    !pointId
  ) {
    throw new Error(
      "缺少有效的笔记或知识点编号"
    );
  }

  const notes = readNotes();

  const note =
    notes.find(
      item => item.id === noteId
    );

  if (!note) {
    throw new Error(
      "没有找到对应笔记"
    );
  }

  if (
    !note.aiAnalysis ||
    !note.aiAnalysis.data ||
    !Array.isArray(
      note.aiAnalysis.data.categories
    )
  ) {
    throw new Error(
      "没有可修改的 AI 整理结果"
    );
  }

  const categories =
    note.aiAnalysis.data.categories;

  let deleted = false;

  for (
    let i = 0;
    i < categories.length;
    i++
  ) {
    const category =
      categories[i];

    const points =
      Array.isArray(
        category.knowledgePoints
      )
        ? category.knowledgePoints
        : [];

    const pointIndex =
      points.findIndex(
        point =>
          point.id === pointId
      );

    if (pointIndex === -1) {
      continue;
    }

    points.splice(
      pointIndex,
      1
    );

    deleted = true;

    // 当前分类已经没有任何知识点，
    // 删除空分类。
    if (points.length === 0) {
      categories.splice(i, 1);
    }

    break;
  }

  if (!deleted) {
    throw new Error(
      "没有找到需要删除的知识点"
    );
  }

  writeNotes(notes);

  return {
    deleted: true
  };
}

function deleteNote(id) {
  if (
    typeof id !== "string" ||
    !id
  ) {
    throw new Error(
      "缺少有效的笔记编号，未执行删除"
    );
  }

  const notes = readNotes();

  const index = notes.findIndex(
    note => note.id === id
  );

  if (index === -1) {
    throw new Error(
      "没有找到该笔记，未执行删除"
    );
  }

  const remainingNotes = notes.filter(
    note => note.id !== id
  );

  writeNotes(remainingNotes);
}

module.exports = {
  readNotes,
  saveNote,
  saveAiAnalysis,

  updateAiKnowledgePoint,
  updateAiKnowledgePointById,

  addAiKnowledgePoint,
  addAiCategory,

  moveAiKnowledgePointById,

  deleteAiKnowledgePointById,
  deleteNote
};