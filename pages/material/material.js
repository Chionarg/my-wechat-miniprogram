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
  }
});