const localMaterials =
  require(
    "../../utils/local-materials"
  );

Page({
  data: {
    ready: false,

    materialId: "",
    fileName: "",
    typeText: "",
    content: "",

    aiAvailable: false,
    hasAi: false,
    aiSubmitting: false,

    errorText: ""
  },

  onLoad(options) {
    const materialId =
      options.materialId || "";

    if (!materialId) {
      this.setData({
        errorText:
          "缺少资料编号。"
      });

      return;
    }

    try {
      const materials =
        localMaterials
          .readMaterials();

      const material =
        materials.find(
          item =>
            item.id ===
            materialId
        );

      if (!material) {
        throw new Error(
          "没有找到这份资料"
        );
      }


      const processing =
        material.processing;

      const aiAvailable =
        Boolean(
          processing &&
          Array.isArray(
            processing.chunks
          ) &&
          processing.chunks.length === 1 &&
          processing.chunks[0] &&
          processing.chunks[0]
            .oversized === false
        );

      this.setData({
        ready: true,

        materialId:
          material.id,

        fileName:
          material.fileName,

        typeText:
          material.type
            .toUpperCase(),

        content:
          material.content,

          aiAvailable:
          aiAvailable,

        hasAi:
          Boolean(
            material.aiAnalysis
          ),

        aiSubmitting: false,

        errorText: ""
      });
    } catch (error) {
      console.error(
        "读取资料原文失败：",
        error
      );

      this.setData({
        errorText:
          error.message ||
          "无法读取资料。"
      });
    }
  },

  onAnalyzeTxt() {
  },

  onAnalyzeTxt() {
    if (this.data.aiSubmitting) {
      return;
    }

    const materialId =
      this.data.materialId;

    let material;

    try {
      const materials =
        localMaterials
          .readMaterials();

      material =
        materials.find(
          item =>
            item.id ===
            materialId
        );

      if (!material) {
        throw new Error(
          "没有找到这份资料"
        );
      }
    } catch (error) {
      console.error(
        "准备 TXT AI 整理失败：",
        error
      );

      wx.showModal({
        title: "暂时无法整理",
        content:
          "无法读取这份本地资料，请不要清除存储。",
        showCancel: false
      });

      return;
    }

    if (material.aiAnalysis) {
      wx.showModal({
        title: "已有 AI 整理结果",
        content:
          "当前版本不会直接重新整理已有 AI 结果，以避免覆盖后续人工修改。",
        showCancel: false
      });

      return;
    }

    const processing =
      material.processing;

    if (
      !processing ||
      !Array.isArray(
        processing.chunks
      ) ||
      processing.chunks.length !==
        1 ||
      !processing.chunks[0] ||
      processing.chunks[0]
        .oversized !== false
    ) {
      wx.showModal({
        title:
          "当前 TXT 暂不支持 AI 整理",
        content:
          "当前版本只支持单个非超长 Chunk 的短 TXT。",
        showCancel: false
      });

      return;
    }

    wx.showModal({
      title:
        "使用 AI 整理这份 TXT？",

      content:
        "整理时会把这份 TXT 的已处理文本发送给当前 AI 服务。原文仍保存在本机。",

      confirmText: "开始整理",
      cancelText: "取消",

      success: (result) => {
        if (!result.confirm) {
          return;
        }

        this.runTxtAiAnalysis(
          material
        );
      }
    });
  },

  runTxtAiAnalysis(material) {
    if (this.data.aiSubmitting) {
      return;
    }

    this.setData({
      aiSubmitting: true
    });

    wx.cloud.callFunction({
      name: "analyzeNote",

      data: {
        inputType: "txt",
        processing:
          material.processing
      },

      success: (res) => {
        const result =
          res.result;

        if (
          !result ||
          result.ok !== true ||
          !result.data ||
          !Array.isArray(
            result.data.categories
          )
        ) {
          const message =
            result &&
            result.message
              ? result.message
              : "AI 没有返回有效的知识结构。";

          wx.showModal({
            title:
              "AI 整理未完成",
            content: message,
            showCancel: false
          });

          return;
        }

        try {
          localMaterials
            .saveMaterialAiAnalysis(
              material.id,
              {
                data:
                  result.data,

                model:
                  result.model ||
                  ""
              }
            );

          this.setData({
            hasAi: true
          });

          wx.showToast({
            title: "AI 整理完成",
            icon: "success"
          });
        } catch (error) {
          console.error(
            "保存 TXT AI 结果失败：",
            error
          );

          wx.showModal({
            title:
              "AI 结果未保存",
            content:
              error.message ||
              "AI 已返回结果，但未能安全保存到本机。",
            showCancel: false
          });
        }
      },

      fail: (error) => {
        console.error(
          "TXT AI 云函数调用失败：",
          error
        );

        wx.showModal({
          title:
            "AI 整理未完成",
          content:
            "云函数调用失败。本次不会自动重试，请稍后手动重试。",
          showCancel: false
        });
      },

      complete: () => {
        this.setData({
          aiSubmitting: false
        });
      }
    });
  }
});