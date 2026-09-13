const localNotes = require("../../utils/local-notes");

const localMaterials =
  require(
    "../../utils/local-materials"
  );

Page({
  data: {
    localNotes: [],
    notesError: "",

    localMaterials: [],
    materialsError: "",

    materials: [
      {
        id: "cpp-demo",
        title: "C++ 基础",
        type: "PDF",
        status: "completed",
        statusText: "已整理 · 示例",
        description: "示例主题：类型推导、数组、指针、引用与动态内存。",
        actionText: "查看大纲"
      },
      {
        id: "gpio-demo",
        title: "GPIO 课堂笔记",
        type: "文字笔记",
        status: "draft",
        statusText: "未整理 · 示例",
        description: "用于展示尚未整理的笔记状态，不是真实保存的笔记。",
        actionText: "打开笔记"
      },
      {
        id: "circuit-demo",
        title: "电路基础",
        type: "DOCX",
        status: "processing",
        statusText: "整理中 · 模拟",
        description: "仅展示处理中的界面状态，后台没有实际执行任务。",
        actionText: "查看进度"
      }
    ]
  },

  onShow() {
    try {
      const notes = localNotes.readNotes();

      const localNoteItems = notes.map(note => {
        const aiAnalysis =
          note.aiAnalysis || null;

        const contentUpdatedAt =
          typeof note.contentUpdatedAt === "number"
            ? note.contentUpdatedAt
            : note.updatedAt;

        const aiOutdated =
          Boolean(aiAnalysis) &&
          aiAnalysis.sourceUpdatedAt !==
            contentUpdatedAt;

        return {
          id: note.id,

          title: note.title,

          preview:
            note.content.slice(0, 70) +
            (
              note.content.length > 70
                ? "…"
                : ""
            ),

          hasAi: Boolean(aiAnalysis),

          aiOutdated: aiOutdated
        };
      });

      this.setData({
        localNotes: localNoteItems,
        notesError: ""
      });
    } catch (error) {
      console.error(
        "加载本地笔记列表失败：",
        error
      );

      this.setData({
        localNotes: [],
        notesError:
          "本地笔记读取失败，不代表笔记已被删除。请不要清除存储，先检查错误。"
      });
    }
    try {
      const materials =
        localMaterials.readMaterials();

      this.setData({
        localMaterials:
          materials.map(
            material => ({
              id:
                material.id,

              fileName:
                material.fileName,

              typeText:
                material.type
                  .toUpperCase(),

              preview:
                material.content
                  .slice(0, 70) +
                (
                  material.content
                    .length > 70
                    ? "…"
                    : ""
                ),

              hasAi:
                Boolean(
                  material.aiAnalysis
                )
            })
          ),

        materialsError: ""
      });
    } catch (error) {
      console.error(
        "加载本地资料失败：",
        error
      );

      this.setData({
        localMaterials: [],

        materialsError:
          "本地资料读取失败，不代表资料已被删除。请不要清除存储。"
      });
    }
  },

  onOpenLocalMaterial(event) {
    const id =
      event.currentTarget.dataset.id;

    if (!id) {
      return;
    }

    wx.navigateTo({
      url:
        "/pages/material/material" +
        "?materialId=" +
        encodeURIComponent(id),

      fail: (error) => {
        console.error(
          "打开本地资料失败：",
          error
        );
      }
    });
  },

  onOpenMaterialOutline(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;

    wx.navigateTo({
      url:
        "/pages/outline/outline" +
        "?mode=local" +
        "&type=txt" +
        "&materialId=" +
        encodeURIComponent(id)
    });
  },

  onDeleteLocalMaterial(event) {
    const id =
      event.currentTarget.dataset.id;

    const material =
      this.data.localMaterials.find(
        item => item.id === id
      );

    if (!material) {
      return;
    }

    wx.showModal({
      title: "删除这份本地资料？",

      content:
        "文件：" +
        material.fileName +
        "\n\n将删除当前设备保存的 TXT 文本副本及其关联数据，无法恢复。",

      confirmText: "确认删除",
      confirmColor: "#b91c1c",
      cancelText: "取消",

      success: (result) => {
        if (!result.confirm) {
          return;
        }

        try {
          localMaterials
            .deleteMaterial(id);

          this.setData({
            localMaterials:
              this.data
                .localMaterials
                .filter(
                  item =>
                    item.id !== id
                )
          });

          wx.showToast({
            title: "资料已删除",
            icon: "success"
          });
        } catch (error) {
          console.error(
            "删除本地资料失败：",
            error
          );

          wx.showModal({
            title: "删除失败",
            content:
              "没有完成删除，请不要清除全部存储。",
            showCancel: false
          });
        }
      }
    });
  },

  onDeleteLocalNote(event) {
    const id = event.currentTarget.dataset.id;
    const note = this.data.localNotes.find(item => item.id === id);

    if (!note) {
      wx.showModal({
        title: "暂时无法删除",
        content: "当前列表中没有找到这份笔记，请重新进入首页后再试。",
        showCancel: false
      });
      return;
    }

    // 防止连续点击弹出多个删除确认框。
    if (this.deletePending) {
      return;
    }

    this.deletePending = true;

    wx.showModal({
      title: "删除这份本地笔记？",
      content:
        "标题：" + note.title +
        "\n\n将删除当前设备上这份笔记的标题和正文，无法恢复。同名的其他笔记不会被删除。",
      confirmText: "确认删除",
      confirmColor: "#b91c1c",
      cancelText: "取消",

      success: (result) => {
        if (!result.confirm) {
          return;
        }

        try {
          localNotes.deleteNote(id);
        } catch (error) {
          console.error("删除本地笔记失败：", error);

          wx.showModal({
            title: "删除未完成",
            content: "本次未能完成删除，请检查错误信息。不要清除全部存储。",
            showCancel: false
          });
          return;
        }

        // 存储写入成功后，再从当前列表中移除对应卡片。
        this.setData({
          localNotes: this.data.localNotes.filter(
            item => item.id !== id
          )
        });

        wx.showToast({
          title: "已删除本地笔记",
          icon: "success"
        });
      },

      complete: () => {
        this.deletePending = false;
      }
    });
  },

  onOpenLocalNote(event) {
    const id = event.currentTarget.dataset.id;

    this.openNotePage(
      "/pages/note/note?id=" + encodeURIComponent(id)
    );
  },

  onOpenAiOutline(event) {
    const id = event.currentTarget.dataset.id;

    if (!id) {
      wx.showModal({
        title: "无法打开大纲",
        content: "缺少笔记编号。",
        showCancel: false
      });
      return;
    }

    wx.navigateTo({
      url:
        "/pages/outline/outline?mode=local&noteId=" +
        encodeURIComponent(id),

      fail: (error) => {
        console.error(
          "打开本地 AI 大纲失败：",
          error
        );

        wx.showModal({
          title: "无法打开大纲",
          content:
            "页面跳转失败，请检查 outline 页面配置。",
          showCancel: false
        });
      }
    });
  },

  openNotePage(url) {
    wx.navigateTo({
      url: url,
      fail: (error) => {
        console.error("打开笔记页失败：", error);
        this.showDemoMessage(
          "打开笔记页失败，请检查 app.json 登记和 note 页面文件。"
        );
      }
    });
  },

  showDemoMessage(content) {
    wx.showModal({
      title: "演示模式",
      content: content,
      showCancel: false,
      confirmText: "知道了"
    });
  },

  onNewNote() {
    this.openNotePage("/pages/note/note");
  },

  onUpload() {
    wx.navigateTo({
      url:
        "/pages/file-test/file-test",

      fail: (error) => {
        console.error(
          "打开文件测试页失败：",
          error
        );

        this.showDemoMessage(
          "无法打开文件测试页面，请检查 app.json 配置。"
        );
      }
    });
  },

  onOpenMaterial(event) {
    const id = event.currentTarget.dataset.id;

    if (id === "cpp-demo") {
      wx.navigateTo({
        url: "/pages/outline/outline",
        fail: (error) => {
          console.error("打开大纲页失败：", error);

          this.showDemoMessage(
            "打开大纲页失败，请检查 app.json 中的页面路径和 outline 文件夹。"
          );
        }
      });

      return;
    }

    const messages = {
      "gpio-demo": "笔记编辑页尚未接入。这是一份固定演示资料。",
      "circuit-demo": "处理状态页尚未接入。当前没有后台分析任务。"
    };

    this.showDemoMessage(messages[id] || "该功能尚未接入。");
  },

  onMore() {
    this.showDemoMessage(
      "原文核对和删除功能尚未接入，本次不会打开文件或删除数据。"
    );
  }
});