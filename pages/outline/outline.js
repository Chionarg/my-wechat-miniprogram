const localNotes =
  require("../../utils/local-notes");

const localNotes =
  require("../../utils/local-notes");
const localMaterials =
  require("../../utils/local-materials");

Page({
  data: {
    mode: "demo",
    entityType: "note",
    noteId: "",
    materialId: "",

    title: "C++ 基础",

    subtitle:
      "根据 12 页笔记解析文本组织",

    isLocalAi: false,
    aiOutdated: false,

    groups: [
      {
        id: "types",
        title: "类型推导、存储期与链接",
        expanded: true,
        points: [
          {
            id: "auto",
            title: "auto 类型推导",
            summary:
              "根据初始化表达式推导变量类型。",
            sourceIds: [],
            source: "PDF 第 1 页",
            review: true
          },
          {
            id: "static",
            title: "static 静态变量",
            summary: "",
            sourceIds: [],
            source: "PDF 第 1 页",
            review: false
          },
          {
            id: "register",
            title:
              "register 的历史用法与版本限制",
            summary: "",
            sourceIds: [],
            source: "PDF 第 1—2 页",
            review: true
          },
          {
            id: "extern",
            title: "extern 与跨文件声明",
            summary: "",
            sourceIds: [],
            source: "PDF 第 2 页",
            review: false
          }
        ]
      },

      {
        id: "arrays",
        title: "数组",
        expanded: false,
        points: [
          {
            id: "array-init",
            title: "一维数组的声明与初始化",
            summary: "",
            sourceIds: [],
            source: "PDF 第 2—3 页",
            review: false
          },
          {
            id: "array-index",
            title: "下标访问与边界",
            summary: "",
            sourceIds: [],
            source: "PDF 第 3 页",
            review: false
          },
          {
            id: "array-size",
            title: "sizeof 与数组元素数量",
            summary: "",
            sourceIds: [],
            source: "PDF 第 3 页",
            review: true
          },
          {
            id: "array-2d",
            title: "二维数组的行结构",
            summary: "",
            sourceIds: [],
            source: "PDF 第 3—4 页",
            review: false
          }
        ]
      },

      {
        id: "pointers",
        title: "指针",
        expanded: false,
        points: [
          {
            id: "void-pointer",
            title: "nullptr 与 void* 的区别",
            summary: "",
            sourceIds: [],
            source: "PDF 第 3 页",
            review: true
          },
          {
            id: "array-pointer",
            title:
              "数组指针与数组到指针转换",
            summary: "",
            sourceIds: [],
            source: "PDF 第 3—5 页",
            review: true
          }
        ]
      }
    ],

    sources: []
  },

  onLoad(options) {
    if (
      options.mode === "local" &&
      options.type === "txt" &&
      options.materialId
    ) {
      this.entityType = "txt";
      this.localMaterialId = options.materialId;

      this.loadLocalAiOutlineForTxt(
        options.materialId
      );

      return;
    }

    if (
      options.mode === "local" &&
      options.noteId
    ) {
      this.entityType = "note";
      this.localNoteId = options.noteId;

      this.loadLocalAiOutline(
        options.noteId
      );

      return;
    }

    this.setData({
      mode: "demo",
      isLocalAi: false
    });
  },

  onShow() {
    if (
      this.entityType === "txt" &&
      this.localMaterialId &&
      this.hasLoadedLocalOutline
    ) {
      this.loadLocalAiOutlineForTxt(
        this.localMaterialId
      );
      return;
    }

    if (
      this.localNoteId &&
      this.hasLoadedLocalOutline
    ) {
      this.loadLocalAiOutline(
        this.localNoteId
      );
    }
  },

  loadLocalAiOutline(noteId) {
    try {
      const notes = localNotes.readNotes();

      const note = notes.find(
        item => item.id === noteId
      );

      if (!note) {
        throw new Error(
          "没有找到对应的本地笔记"
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
          "这份笔记还没有可用的 AI 整理结果"
        );
      }

      const aiAnalysis =
        note.aiAnalysis;

      const currentContentUpdatedAt =
        typeof note.contentUpdatedAt ===
        "number"
          ? note.contentUpdatedAt
          : note.updatedAt;

      const aiOutdated =
        aiAnalysis.sourceUpdatedAt !==
        currentContentUpdatedAt;

      const groups =
        aiAnalysis.data.categories.map(
          (category, categoryIndex) => ({
            id:
              "ai-category-" +
              categoryIndex,

            title: category.name,

            // 第一组默认展开。
            expanded:
              categoryIndex === 0,

            points:
              category.knowledgePoints.map(
                (point, pointIndex) => ({
                  id: point.id,

                  title: point.title,

                  summary:
                    point.summary || "",

                    originType:
                    point.userCreated &&
                    point.userCreated.created
                      ? "user-created"
                      : (
                          point.userEdit &&
                          point.userEdit.modified
                            ? "user-edited"
                            : "ai"
                        ),
                  
                  originText:
                    point.userCreated &&
                    point.userCreated.created
                      ? "用户新增"
                      : (
                          point.userEdit &&
                          point.userEdit.modified
                            ? "用户已修改"
                            : "AI 整理"
                        ),

                  sourceIds:
                    Array.isArray(
                      point.sourceIds
                    )
                      ? point.sourceIds
                      : [],

                  source:
                    Array.isArray(
                      point.sourceIds
                    )
                      ? point.sourceIds.join(
                          "、"
                        )
                      : "",

                  review: false
                })
              )
          })
        );

        this.setData({
          mode: "local",
          noteId: noteId,
          isLocalAi: true,

        title: note.title,

        subtitle:
          "AI 自动整理 · 未人工核对",

        aiOutdated: aiOutdated,

        groups: groups,

        sources:
          Array.isArray(
            aiAnalysis.sources
          )
            ? aiAnalysis.sources
            : []
      });

      this.hasLoadedLocalOutline = true;

    } catch (error) {
      console.error(
        "读取本地 AI 大纲失败：",
        error
      );

      wx.showModal({
        title: "无法打开 AI 大纲",
        content: error.message,
        showCancel: false,

        success: () => {
          wx.navigateBack();
        }
      });
    }
  },

  loadLocalAiOutlineForTxt(materialId) {
    try {
      const materials =
        localMaterials.readMaterials();

      const material = materials.find(
        item => item.id === materialId
      );

      if (!material) {
        throw new Error(
          "没有找到对应的 TXT 资料"
        );
      }

      if (
        !material.aiAnalysis ||
        !material.aiAnalysis.data ||
        !Array.isArray(
          material.aiAnalysis.data.categories
        )
      ) {
        throw new Error(
          "这份资料还没有可用的 AI 整理结果"
        );
      }

      const aiAnalysis =
        material.aiAnalysis;

      const groups =
        aiAnalysis.data.categories.map(
          (category, categoryIndex) => ({
            id:
              "ai-category-" +
              categoryIndex,

            title: category.name,

            expanded:
              categoryIndex === 0,

              points:
              (category.knowledgePoints || []).map(
                (point, pointIndex) => ({
                  id: point.id || ("kp_" + categoryIndex + "_" + pointIndex),

                  title: point.title,

                  summary:
                    point.summary || "",

                  originType:
                    point.userCreated &&
                    point.userCreated.created
                      ? "user-created"
                      : (
                          point.userEdit &&
                          point.userEdit.modified
                            ? "user-edited"
                            : "ai"
                        ),

                  originText:
                    point.userCreated &&
                    point.userCreated.created
                      ? "用户新增"
                      : (
                          point.userEdit &&
                          point.userEdit.modified
                            ? "用户已修改"
                            : "AI 整理"
                        ),

                  sourceIds:
                    Array.isArray(
                      point.sourceIds
                    )
                      ? point.sourceIds
                      : [],

                  source:
                    Array.isArray(
                      point.sourceIds
                    )
                      ? point.sourceIds.join(
                          "、"
                        )
                      : "",

                  review: false
                })
              )
          })
        );

      this.setData({
        mode: "local",
        entityType: "txt",
        materialId: materialId,
        isLocalAi: true,

        title: material.fileName,

        subtitle:
          "AI 自动整理 · TXT 资料",

        aiOutdated: false,

        groups: groups,

        sources:
          Array.isArray(
            aiAnalysis.sources
          )
            ? aiAnalysis.sources
            : []
      });

      this.hasLoadedLocalOutline = true;

    } catch (error) {
      console.error(
        "读取 TXT AI 大纲失败：",
        error
      );

      wx.showModal({
        title: "无法打开 AI 大纲",
        content: error.message,
        showCancel: false,

        success: () => {
          wx.navigateBack();
        }
      });
    }
  },

  toggleGroup(event) {
    const id =
      event.currentTarget.dataset.id;

    const index =
      this.data.groups.findIndex(
        group => group.id === id
      );

    if (index === -1) {
      return;
    }

    this.setData({
      [`groups[${index}].expanded`]:
        !this.data.groups[index]
          .expanded
    });
  },

  onPointTap(event) {
    const id =
      event.currentTarget.dataset.id;

    const title =
      event.currentTarget.dataset.title;

    if (this.data.isLocalAi) {
      if (this.data.entityType === "txt") {
        const materialId =
          this.data.materialId;

        if (!materialId || !id) {
          wx.showModal({
            title: "无法打开知识点",
            content:
              "缺少资料或知识点编号。",
            showCancel: false
          });
          return;
        }

        wx.navigateTo({
          url:
            "/pages/knowledge/knowledge" +
            "?mode=local" +
            "&type=txt" +
            "&materialId=" +
            encodeURIComponent(materialId) +
            "&pointId=" +
            encodeURIComponent(id),

          fail: (error) => {
            console.error(
              "打开 TXT 知识点详情失败：",
              error
            );

            wx.showModal({
              title: "打开失败",
              content:
                "无法打开知识点详情页。",
              showCancel: false
            });
          }
        });

        return;
      }

      const noteId =
        this.data.noteId;

      if (!noteId || !id) {
        wx.showModal({
          title: "无法打开知识点",
          content:
            "缺少笔记或知识点编号。",
          showCancel: false
        });
        return;
      }

      wx.navigateTo({
        url:
          "/pages/knowledge/knowledge" +
          "?mode=local" +
          "&noteId=" +
          encodeURIComponent(noteId) +
          "&pointId=" +
          encodeURIComponent(id),

        fail: (error) => {
          console.error(
            "打开真实知识点详情失败：",
            error
          );

          wx.showModal({
            title: "打开失败",
            content:
              "无法打开知识点详情页。",
            showCancel: false
          });
        }
      });

      return;
    }

    if (id === "auto") {
      wx.navigateTo({
        url:
          "/pages/knowledge/knowledge?id=auto",

        fail: (error) => {
          console.error(
            "打开固定知识点详情失败：",
            error
          );

          wx.showModal({
            title: "打开失败",
            content:
              "请检查 knowledge 页面配置。",
            showCancel: false
          });
        }
      });

      return;
    }

    wx.showModal({
      title: "暂未接入",
      content:
        `“${title}”的详情仍属于固定演示内容。`,
      showCancel: false
    });
  },

  showLocalPoint(
    title,
    sourceIds,
    summary
  ) {
    const normalizedIds =
      Array.isArray(sourceIds)
        ? sourceIds
        : [];

    const matchedSources =
      this.data.sources.filter(
        source =>
          normalizedIds.includes(
            source.id
          )
      );

      const sourceText =
      matchedSources.length > 0
        ? matchedSources
            .map(
              source =>
                `[${source.id}]\n` +
                (source.text || source.content || "")
            )
            .join("\n\n")
        : "没有找到可核对的原文段落。";

    wx.showModal({
      title: title || "知识点",

      content:
        (summary
          ? summary + "\n\n"
          : "") +
        "原文出处：\n" +
        sourceText,

      showCancel: false,
      confirmText: "知道了"
    });
  },

  onViewSource() {
    if (!this.data.isLocalAi) {
      wx.showModal({
        title: "演示模式",
        content:
          "固定样例尚未接入原 PDF。",
        showCancel: false
      });
      return;
    }

    const text =
    this.data.sources.length > 0
      ? this.data.sources
          .map(
            source =>
              `[${source.id}]\n` +
              (source.text || source.content || "")
          )
          .join("\n\n")
      : "没有可显示的原文段落。";

    wx.showModal({
      title: "本次整理的原文段落",
      content: text,
      showCancel: false,
      confirmText: "知道了"
    });
  },

  onAddCategory() {
    if (
      !this.data.isLocalAi ||
      !this.data.noteId
    ) {
      return;
    }

    wx.showModal({
      title: "新增分类",
      editable: true,
      placeholderText:
        "例如：C++ 补充知识",
      confirmText: "创建",
      cancelText: "取消",

      success: (result) => {
        if (!result.confirm) {
          return;
        }

        const name =
          typeof result.content ===
            "string"
            ? result.content.trim()
            : "";

        if (!name) {
          wx.showModal({
            title: "无法创建",
            content:
              "分类名称不能为空。",
            showCancel: false
          });

          return;
        }

        try {
          if (this.data.entityType === "txt") {
            localMaterials.addMaterialCategory(
              this.data.materialId,
              name
            );

            this.loadLocalAiOutlineForTxt(
              this.data.materialId
            );
          } else {
            localNotes.addAiCategory(
              this.data.noteId,
              name
            );

            this.loadLocalAiOutline(
              this.data.noteId
            );
          }

          wx.showToast({
            title: "分类已创建",
            icon: "success"
          });
        } catch (error) {
          console.error(
            "新增分类失败：",
            error
          );

          wx.showModal({
            title: "创建失败",
            content:
              error.message ||
              "没有完成新增分类。",
            showCancel: false
          });
        }
      }
    });
  },

  onAddPoint() {
    if (
      !this.data.isLocalAi ||
      !this.data.noteId
    ) {
      wx.showModal({
        title: "暂未接入",
        content:
          "固定演示大纲不支持新增知识点。",
        showCancel: false
      });

      return;
    }

    wx.navigateTo({
      url:
        "/pages/add-point/add-point" +
        "?noteId=" +
        encodeURIComponent(
          this.data.noteId
        ),

      fail: (error) => {
        console.error(
          "打开新增知识点页面失败：",
          error
        );

        wx.showModal({
          title: "打开失败",
          content:
            "无法打开新增知识点页面。",
          showCancel: false
        });
      }
    });
  }
});