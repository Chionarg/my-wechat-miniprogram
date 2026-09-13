const localNotes =
  require("../../utils/local-notes");
const localMaterials =
  require("../../utils/local-materials");

Page({
  data: {
    ready: false,

    entityType: "note",
    materialId: "",
    noteId: "",

    categories: [],
    categoryIndex: 0,

    title: "",
    summary: "",

    sources: [],

    saving: false,
    errorText: ""
  },

  onLoad(options) {
    if (options.type === "txt" && options.materialId) {
      const materialId = options.materialId;

      try {
        const materials = localMaterials.readMaterials();

        const material = materials.find(
          item => item.id === materialId
        );

        if (
          !material ||
          !material.aiAnalysis ||
          !material.aiAnalysis.data ||
          !Array.isArray(material.aiAnalysis.data.categories) ||
          !Array.isArray(material.aiAnalysis.sources)
        ) {
          throw new Error("没有可编辑的知识结构");
        }

        const categories = material.aiAnalysis.data.categories
          .map(item => item.name)
          .filter(Boolean);

        if (categories.length === 0) {
          throw new Error("当前没有可选择的分类");
        }

        const sources = material.aiAnalysis.sources.map(
          source => ({
            id: source.id,
            content: source.text || source.content || "",
            selected: false
          })
        );

        this.setData({
          ready: true,
          entityType: "txt",
          materialId: materialId,
          categories: categories,
          categoryIndex: 0,
          sources: sources
        });
      } catch (error) {
        console.error("加载 TXT 新增知识点页面失败：", error);
        this.setData({ errorText: error.message });
      }

      return;
    }

    const noteId =
      options.noteId || "";

    if (!noteId) {
      this.setData({
        errorText:
          "缺少笔记编号。"
      });
      return;
    }

    try {
      const notes =
        localNotes.readNotes();

      const note =
        notes.find(
          item =>
            item.id === noteId
        );

      if (
        !note ||
        !note.aiAnalysis ||
        !note.aiAnalysis.data ||
        !Array.isArray(
          note.aiAnalysis.data
            .categories
        ) ||
        !Array.isArray(
          note.aiAnalysis.sources
        )
      ) {
        throw new Error(
          "没有可编辑的知识结构"
        );
      }

      const categories =
        note.aiAnalysis.data
          .categories
          .map(item => item.name)
          .filter(Boolean);

      if (
        categories.length === 0
      ) {
        throw new Error(
          "当前没有可选择的分类"
        );
      }

      const sources =
        note.aiAnalysis.sources.map(
          source => ({
            id: source.id,
            content:
              source.content,
            selected: false
          })
        );

      this.setData({
        ready: true,
        noteId: noteId,
        categories: categories,
        categoryIndex: 0,
        sources: sources
      });
    } catch (error) {
      console.error(
        "加载新增知识点页面失败：",
        error
      );

      this.setData({
        errorText: error.message
      });
    }
  },

  onCategoryChange(event) {
    this.setData({
      categoryIndex:
        Number(
          event.detail.value
        )
    });
  },

  onTitleInput(event) {
    this.setData({
      title:
        event.detail.value
    });
  },

  onSummaryInput(event) {
    this.setData({
      summary:
        event.detail.value
    });
  },

  onSourceChange(event) {
    const selectedIds =
      event.detail.value || [];

    const selectedSet =
      new Set(selectedIds);

    this.setData({
      sources:
        this.data.sources.map(
          source => ({
            ...source,
            selected:
              selectedSet.has(
                source.id
              )
          })
        )
    });
  },

  onSave() {
    if (
      !this.data.ready ||
      this.data.saving
    ) {
      return;
    }

    const categoryName =
      this.data.categories[
        this.data.categoryIndex
      ];

    const title =
      this.data.title.trim();

    const summary =
      this.data.summary.trim();

    const sourceIds =
      this.data.sources
        .filter(
          source =>
            source.selected
        )
        .map(
          source =>
            source.id
        );

    if (
      !categoryName ||
      !title ||
      !summary
    ) {
      wx.showModal({
        title: "还不能保存",
        content:
          "请选择分类，并填写知识点名称和解释。",
        showCancel: false
      });

      return;
    }

    if (
      sourceIds.length === 0
    ) {
      wx.showModal({
        title: "请选择原文出处",
        content:
          "用户新增知识点至少需要关联一个现有原文段落。",
        showCancel: false
      });

      return;
    }

    this.setData({
      saving: true
    });

    try {
      if (this.data.entityType === "txt") {
        localMaterials.addMaterialKnowledgePoint(
          this.data.materialId,
          {
            categoryName: categoryName,
            title: title,
            summary: summary,
            sourceIds: sourceIds
          }
        );
      } else {
        localNotes.addAiKnowledgePoint(
          this.data.noteId,
          {
            categoryName: categoryName,
            title: title,
            summary: summary,
            sourceIds: sourceIds
          }
        );
      }

      wx.showToast({
        title: "知识点已新增",
        icon: "success"
      });

      setTimeout(() => {
        wx.navigateBack();
      }, 400);
    } catch (error) {
      console.error(
        "新增知识点失败：",
        error
      );

      wx.showModal({
        title: "保存失败",
        content:
          error.message ||
          "没有完成新增。",
        showCancel: false
      });
    } finally {
      this.setData({
        saving: false
      });
    }
  }
});