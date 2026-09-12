const localNotes =
  require("../../utils/local-notes");

Page({
  data: {
    mode: "demo",

    noteId: "",
    pointId: "",

    originType: "",
    originText: "",

    editing: false,
    draftTitle: "",
    draftSummary: "",
    userModified: false,

    available: false,
    expanded: false,

    isLocalAi: false,
    aiOutdated: false,

    point: {
      title: "",
      category: "",
      summary: "",
      explanation: "",
      sourceIds: []
    },

    matchedSources: []
  },

  onLoad(options) {
    if (
      options.mode === "local" &&
      options.noteId &&
      options.pointId
    ) {
      this.loadLocalPoint(
        options.noteId,
        options.pointId
      );

      return;
    }

    if (options.id === "auto") {
      this.loadDemoAuto();
      return;
    }

    this.setData({
      available: false
    });
  },

  loadLocalPoint(noteId, pointId) {
    try {
      const notes =
        localNotes.readNotes();

      const note = notes.find(
        item => item.id === noteId
      );

      if (!note) {
        throw new Error(
          "没有找到对应的笔记"
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
          "没有找到可用的 AI 整理结果"
        );
      }

      let targetPoint = null;
let targetCategory = "";

note.aiAnalysis.data.categories
  .forEach(category => {
    const points =
      Array.isArray(
        category.knowledgePoints
      )
        ? category.knowledgePoints
        : [];

    points.forEach(point => {
      if (
        point.id === pointId
      ) {
        targetPoint = point;
        targetCategory =
          category.name;
      }
    });
  });

      if (!targetPoint) {
        throw new Error(
          "没有找到对应的知识点"
        );
      }

      const sourceIds =
        Array.isArray(
          targetPoint.sourceIds
        )
          ? targetPoint.sourceIds
          : [];

      const matchedSources =
        Array.isArray(
          note.aiAnalysis.sources
        )
          ? note.aiAnalysis.sources.filter(
              source =>
                sourceIds.includes(
                  source.id
                )
            )
          : [];

      const contentUpdatedAt =
        typeof note.contentUpdatedAt ===
        "number"
          ? note.contentUpdatedAt
          : note.updatedAt;

      const aiOutdated =
        note.aiAnalysis
          .sourceUpdatedAt !==
        contentUpdatedAt;

      this.setData({
        mode: "local",

        noteId: noteId,
        pointId: pointId,
        
        available: true,
        isLocalAi: true,

        userModified:
          Boolean(
            targetPoint.userEdit &&
            targetPoint.userEdit.modified
          ),

        aiOutdated: aiOutdated,

        point: {
          title: targetPoint.title,
          category: targetCategory,
          summary:
            targetPoint.summary || "",
          explanation:
            targetPoint.summary || "",
          sourceIds: sourceIds
        },

        originType:
        targetPoint.userCreated &&
        targetPoint.userCreated.created
          ? "user-created"
          : (
              targetPoint.userEdit &&
              targetPoint.userEdit.modified
                ? "user-edited"
                : "ai"
            ),
      
      originText:
        targetPoint.userCreated &&
        targetPoint.userCreated.created
          ? "用户新增"
          : (
              targetPoint.userEdit &&
              targetPoint.userEdit.modified
                ? "用户已修改"
                : "AI 整理"
            ),

            categories:
            note.aiAnalysis.data
              .categories
              .map(
                category =>
                  category.name
              ),

        matchedSources:
          matchedSources
      });
    } catch (error) {
      console.error(
        "读取真实 AI 知识点失败：",
        error
      );

      wx.showModal({
        title: "无法打开知识点",
        content: error.message,
        showCancel: false,

        success: () => {
          wx.navigateBack();
        }
      });
    }
  },

  onMoveCategory() {
    if (
      !this.data.isLocalAi ||
      !this.data.noteId ||
      !this.data.pointId
    ) {
      return;
    }

    const currentCategory =
      this.data.point.category;

    const otherCategories =
      this.data.categories.filter(
        name =>
          name !==
          currentCategory
      );

    if (
      otherCategories.length === 0
    ) {
      wx.showModal({
        title: "暂无其他分类",
        content:
          "当前知识结构只有一个分类，所以暂时没有可以移动到的其他分类。",
        showCancel: false
      });

      return;
    }

    wx.showActionSheet({
      itemList:
        otherCategories,

      success: (result) => {
        const targetName =
          otherCategories[
            result.tapIndex
          ];

        try {
          const moveResult =
            localNotes
              .moveAiKnowledgePointById(
                this.data.noteId,
                this.data.pointId,
                targetName
              );

          this.setData({
            "point.category":
              moveResult
                .categoryName
          });

          wx.showToast({
            title:
              moveResult.moved
                ? "分类已调整"
                : "分类未变化",
            icon: "none"
          });
        } catch (error) {
          console.error(
            "调整知识点分类失败：",
            error
          );

          wx.showModal({
            title: "调整失败",
            content:
              error.message ||
              "没有完成调整。",
            showCancel: false
          });
        }
      }
    });
  },

  loadDemoAuto() {
    this.setData({
      mode: "demo",

      available: true,
      isLocalAi: false,
      aiOutdated: false,

      point: {
        title: "auto 类型推导",

        category:
          "类型推导、存储期与链接",

        summary:
          "auto 根据初始化表达式推导变量类型。推导完成后，变量具有确定的类型。",

        explanation:
          "这里讨论的是 C++11 起的普通 auto 类型推导。",

        sourceIds: []
      },

      matchedSources: [
        {
          id: "PDF 第 1 页",
          content:
            'auto str = "1234";(string str = "1234")'
        }
      ]
    });
  },

  toggleDetails() {
    this.setData({
      expanded:
        !this.data.expanded
    });
  },

  onDeletePoint() {
    if (
      !this.data.isLocalAi ||
      !this.data.noteId ||
      !this.data.pointId
    ) {
      wx.showModal({
        title: "暂时无法删除",
        content:
          "当前知识点缺少有效的本地数据。",
        showCancel: false
      });

      return;
    }

    const title =
      this.data.point.title;

    wx.showModal({
      title: "删除这个知识点？",

      content:
        "知识点：" +
        title +
        "\n\n删除后不可恢复。" +
        "对应的原文段落不会被删除，也不会调用 AI。",

      confirmText: "确认删除",
      confirmColor: "#b91c1c",
      cancelText: "取消",

      success: (result) => {
        if (!result.confirm) {
          return;
        }

        try {
          localNotes
            .deleteAiKnowledgePointById(
              this.data.noteId,
              this.data.pointId
            );

          wx.showToast({
            title: "知识点已删除",
            icon: "success"
          });

          // 返回之前的大纲页面。
          // outline 的 onShow 会重新读取本地数据。
          setTimeout(() => {
            wx.navigateBack();
          }, 400);
        } catch (error) {
          console.error(
            "删除知识点失败：",
            error
          );

          wx.showModal({
            title: "删除失败",
            content:
              "没有完成删除，请检查错误信息。不要清除全部存储。",
            showCancel: false
          });
        }
      }
    });
  },

  onEdit() {
    if (!this.data.isLocalAi) {
      wx.showModal({
        title: "演示模式",
        content:
          "固定演示知识点本轮不编辑。",
        showCancel: false
      });
      return;
    }

    if (this.data.editing) {
      return;
    }

    this.setData({
      editing: true,

      draftTitle:
        this.data.point.title,

      draftSummary:
        this.data.point.summary
    });

    wx.pageScrollTo({
      scrollTop: 0,
      duration: 200
    });
  },

  onTitleInput(event) {
    this.setData({
      draftTitle:
        event.detail.value
    });
  },

  onSummaryInput(event) {
    this.setData({
      draftSummary:
        event.detail.value
    });
  },

  onCancelEdit() {
    this.setData({
      editing: false,
      draftTitle: "",
      draftSummary: ""
    });
  },

  onSaveEdit() {
    const title =
      this.data.draftTitle.trim();

    const summary =
      this.data.draftSummary.trim();

    if (!title || !summary) {
      wx.showModal({
        title: "还不能保存",
        content:
          "知识点名称和核心解释都不能为空。",
        showCancel: false
      });
      return;
    }

    if (
      title.length > 100 ||
      summary.length > 1000
    ) {
      wx.showModal({
        title: "内容过长",
        content:
          "名称最多 100 字符，解释最多 1000 字符。",
        showCancel: false
      });
      return;
    }

    try {
      const updated =
      localNotes.updateAiKnowledgePointById(
        this.data.noteId,
        this.data.pointId,
        {
          title: title,
          summary: summary
        }
      );

      this.setData({
        "point.title":
          updated.title,

        "point.summary":
          updated.summary,

        "point.explanation":
          updated.summary,

        userModified: true,

        editing: false,
        draftTitle: "",
        draftSummary: ""
      });

      wx.showToast({
        title: "知识点已保存",
        icon: "success"
      });
    } catch (error) {
      console.error(
        "保存知识点修改失败：",
        error
      );

      wx.showModal({
        title: "保存失败",
        content:
          "未能保存知识点修改。当前输入仍保留，请不要清除存储。",
        showCancel: false
      });
    }
  },

  onBack() {
    wx.navigateBack({
      fail: () => {
        wx.reLaunch({
          url: "/pages/index/index"
        });
      }
    });
  }
});