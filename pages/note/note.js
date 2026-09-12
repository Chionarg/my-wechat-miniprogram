const localNotes = require("../../utils/local-notes");

Page({
  data: {
    noteId: "",
    title: "",
    content: "",
    ready: false,
    saving: false,
    dirty: false,

    analyzing: false,
    aiResult: null,
    aiError: "",
    aiOutdated: false,

    statusText: "",
    errorText: ""
  },

  onLoad(options) {
    this.savedTitle = "";
    this.savedContent = "";

    try {
      const notes = localNotes.readNotes();
      const id = options.id || "";

      if (id) {
        const note = notes.find(item => item.id === id);

        if (!note) {
          throw new Error("没有找到这份本地笔记");
        }

        this.savedTitle = note.title;
        this.savedContent = note.content;

        const aiAnalysis =
  note.aiAnalysis || null;

  const currentContentUpdatedAt =
  typeof note.contentUpdatedAt === "number"
    ? note.contentUpdatedAt
    : note.updatedAt;

const aiOutdated =
  Boolean(aiAnalysis) &&
  aiAnalysis.sourceUpdatedAt !==
    currentContentUpdatedAt;

this.setData({
  noteId: note.id,
  title: note.title,
  content: note.content,

  aiResult: aiAnalysis
    ? {
        data: aiAnalysis.data,
        sources: aiAnalysis.sources,
        model: aiAnalysis.model,
        usage: null
      }
    : null,

  aiOutdated: aiOutdated,

  ready: true,
  statusText: "已读取本地笔记"
});
      } else {
        this.setData({
          ready: true,
          statusText: "新笔记，尚未保存"
        });
      }
    } catch (error) {
      console.error("读取文字笔记失败：", error);

      this.setData({
        errorText: "无法读取本地笔记，暂时禁止编辑。请不要清除存储，先查看错误信息。",
        ready: false
      });
    }
  },

  onTitleInput(event) {
    const title = event.detail.value;

    this.setData({
      title: title,
      dirty:
        title !== this.savedTitle ||
        this.data.content !== this.savedContent
    });
  },

  onContentInput(event) {
    const content = event.detail.value;

    this.setData({
      content: content,
      dirty:
        this.data.title !== this.savedTitle ||
        content !== this.savedContent
    });
  },

  onSave() {
    if (!this.data.ready || this.data.saving) {
      return;
    }

    const title = this.data.title.trim();
    const content = this.data.content;

    if (!title || !content.trim()) {
      wx.showModal({
        title: "还不能保存",
        content: "请填写标题和正文，不能只输入空格。",
        showCancel: false
      });
      return;
    }

    this.setData({
      saving: true
    });

    try {
      const contentChanged =
      this.data.content !==
      this.savedContent;

      const id = localNotes.saveNote({
        id: this.data.noteId,
        title: title,
        content: content
      });

      this.savedTitle = title;
      this.savedContent = content;

      this.setData({
        noteId: id,
        title: title,
        dirty: false,

        aiOutdated:
        this.data.aiOutdated ||
        (
          contentChanged &&
          Boolean(this.data.aiResult)
        ),

        statusText: "已保存到当前设备本地"
      });

      wx.showToast({
        title: "已保存到本地",
        icon: "success"
      });
    } catch (error) {
      console.error("保存文字笔记失败：", error);

      wx.showModal({
        title: "保存失败",
        content: "未能保存。输入仍在当前页面，请先复制重要内容，再检查错误信息。",
        showCancel: false
      });
    } finally {
      this.setData({
        saving: false
      });
    }
  },

  onAnalyze() {
    if (this.data.analyzing) {
      return;
    }

    if (!this.data.ready) {
      return;
    }

    if (this.data.dirty) {
      wx.showModal({
        title: "请先保存笔记",
        content:
          "当前有未保存的修改。请先保存，再进行 AI 整理，避免整理内容和本地笔记不一致。",
        showCancel: false,
        confirmText: "知道了"
      });
      return;
    }

    const text = this.data.content.trim();

    if (!text) {
      wx.showModal({
        title: "没有可整理的内容",
        content: "请先填写并保存笔记正文。",
        showCancel: false
      });
      return;
    }

    if (text.length > 2000) {
      wx.showModal({
        title: "当前测试内容过长",
        content:
          "本阶段 AI 整理最多处理 2000 个字符。请使用较短的测试笔记。",
        showCancel: false
      });
      return;
    }

    wx.showModal({
      title: "确认使用 AI 整理？",
      content:
        "本次将把当前笔记正文发送给已配置的第三方 AI 服务（DeepSeek）进行知识点整理。\n\n" +
        "当前处于开发测试阶段，请不要提交私人、敏感或无权处理的内容。",
      confirmText: "确认整理",
      cancelText: "取消",

      success: (result) => {
        if (!result.confirm) {
          return;
        }

        this.runAiAnalysis(text);
      }
    });
  },

  runAiAnalysis(text) {
    if (this.data.analyzing) {
      return;
    }

    this.setData({
      analyzing: true,
      aiError: ""
    });

    wx.showLoading({
      title: "AI 整理中",
      mask: true
    });

    wx.cloud.callFunction({
      name: "analyzeNote",

      data: {
        text: text
      },

      success: (res) => {
        const result = res.result;

        if (
          !result ||
          result.ok !== true ||
          !result.data ||
          !Array.isArray(result.data.categories)
        ) {
          const message =
            result && result.message
              ? result.message
              : "AI 没有返回有效的知识结构。";

          this.setData({
            aiError: message
          });

          wx.showModal({
            title: "AI 整理未完成",
            content: message,
            showCancel: false
          });

          return;
        }

        const analysisForSave = {
          data: result.data,
          sources: Array.isArray(result.sources)
            ? result.sources
            : [],
          model: result.model || ""
        };
        
        try {
          const savedAnalysis =
            localNotes.saveAiAnalysis(
              this.data.noteId,
              analysisForSave
            );
        
          this.setData({
            aiResult: {
              data: savedAnalysis.data,
              sources: savedAnalysis.sources,
              model: savedAnalysis.model,
              usage: result.usage || null
            },
        
            aiOutdated: false,
            aiError: ""
          });
        } catch (error) {
          console.error(
            "AI 已生成，但本地保存失败：",
            error
          );
        
          // AI 已经产生费用，因此即使保存失败，
          // 当前页面仍显示结果，避免用户白白损失本次生成内容。
          this.setData({
            aiResult: {
              data: result.data,
              sources: Array.isArray(
                result.sources
              )
                ? result.sources
                : [],
              model: result.model || "",
              usage: result.usage || null
            },
        
            aiError:
              "AI 已生成结果，但未能保存到本地。请不要立即重复调用 AI。"
          });
        
          wx.showModal({
            title: "AI 结果未保存",
            content:
              "AI 已经完成整理，但本地保存失败。当前页面仍保留结果，请不要为了保存而立即再次调用 AI。",
            showCancel: false
          });
        
          return;
        }
        
        wx.showToast({
          title: "AI 整理并保存",
          icon: "success"
        });
      },

      fail: (error) => {
        console.error(
          "调用 AI 整理云函数失败：",
          error
        );

        this.setData({
          aiError:
            "无法连接 AI 整理服务。本次不会自动重试。"
        });

        wx.showModal({
          title: "AI 整理失败",
          content:
            "无法连接 AI 整理服务。本次不会自动重试，请稍后手动重试。",
          showCancel: false
        });
      },

      complete: () => {
        wx.hideLoading();

        this.setData({
          analyzing: false
        });
      }
    });
  },

  onBackClick() {
    if (!this.data.dirty) {
      this.leavePage();
      return;
    }

    wx.showModal({
      title: "放弃未保存修改？",
      content: "本次未保存的输入会丢失，之前已经保存的笔记不会被删除。",
      confirmText: "放弃修改",
      cancelText: "继续编辑",
      success: (result) => {
        if (result.confirm) {
          this.leavePage();
        }
      }
    });
  },

  leavePage() {
    wx.navigateBack({
      fail: () => {
        wx.reLaunch({
          url: "/pages/index/index"
        });
      }
    });
  }
});