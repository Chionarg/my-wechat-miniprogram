const localMaterials =
  require("../../utils/local-materials");

  const textProcessing =
  require("../../utils/text-processing.js");

const MAX_TXT_SIZE =
  200 * 1024;

Page({

  data: {
    selecting: false,
    selected: false,

    reading: false,
    textLoaded: false,

    savingMaterial: false,
    savedMaterialId: "",

    fileName: "",
    fileSize: 0,
    extension: "",

    hasTempPath: false,

    textLength: 0,
    textPreview: "",
    encodingStatus: "",

    statusText:
      "尚未选择文件",

    errorText: ""
  },

  onChooseFile() {
    if (this.data.selecting) {
      return;
    }

    if (
      typeof wx.chooseMessageFile !==
      "function"
    ) {
      this.setData({
        errorText:
          "当前微信环境不支持文件选择接口。"
      });

      return;
    }

    this.setData({
      selecting: true,

      savedMaterialId: "",

      errorText: ""
    });

    wx.chooseMessageFile({
      count: 1,

      // 先使用 file，
      // 再由程序自己检查是否为 txt。
      type: "file",

      success: (res) => {
        const files =
          res &&
          Array.isArray(
            res.tempFiles
          )
            ? res.tempFiles
            : [];

        if (files.length === 0) {
          this.setData({
            errorText:
              "没有取得选择的文件。"
          });

          return;
        }

        const file = files[0];

        const fileName =
          typeof file.name === "string"
            ? file.name
            : "";

        const size =
          typeof file.size === "number"
            ? file.size
            : 0;

            const tempPath =
            typeof file.path === "string"
              ? file.path
              : (
                  typeof file.tempFilePath ===
                    "string"
                    ? file.tempFilePath
                    : ""
                );

          const extension =
            this.getExtension(
              fileName
            );

            if (
              size <= 0 ||
              size > MAX_TXT_SIZE
            ) {
              this.setData({
                selected: false,

                fileName: fileName,
                fileSize: size,
                extension: extension,

                hasTempPath:
                  Boolean(tempPath),

                textLoaded: false,
                textLength: 0,
                textPreview: "",

                statusText:
                  "TXT 文件大小不符合测试范围",

                errorText:
                  "当前测试仅支持大于 0 且不超过 200 KB 的 TXT 文件。"
              });

              this.selectedTempPath = "";

              return;
            }

        if (extension !== "txt") {
          this.setData({
            selected: false,

            fileName: fileName,
            fileSize: size,
            extension:
              extension || "未知",

            hasTempPath:
              Boolean(tempPath),

            statusText:
              "文件格式不支持",

            errorText:
              "当前测试只接受 .txt 文件。"
          });

          return;
        }

        if (!tempPath) {
          this.setData({
            selected: false,

            fileName: fileName,
            fileSize: size,
            extension: extension,

            hasTempPath: false,

            statusText:
              "没有取得临时文件路径",

            errorText:
              "微信没有返回可用的临时文件路径。"
          });

          return;
        }

        this.setData({
          selected: true,

          fileName: fileName,
          fileSize: size,
          extension: extension,

          hasTempPath: true,

          textLoaded: false,
          textLength: 0,
          textPreview: "",
          encodingStatus: "",

          statusText:
            "TXT 文件已选择",

          errorText: ""
        });

        // 只保存到当前页面实例中。
        // 不显示、不上传、不持久保存。
        this.selectedTempPath =
          tempPath;
      },

      fail: (error) => {
        const errMsg =
          error &&
          typeof error.errMsg ===
            "string"
            ? error.errMsg
            : "";

        // 用户主动取消时，
        // 不显示成严重错误。
        if (
          errMsg
            .toLowerCase()
            .includes("cancel")
        ) {
          this.setData({
            statusText:
              "已取消文件选择",
            errorText: ""
          });

          return;
        }

        console.error(
          "选择文件失败：",
          errMsg || error
        );

        this.setData({
          statusText:
            "文件选择失败",

          errorText:
            "未能选择文件，请查看开发者工具中的错误信息。"
        });
      },

      complete: () => {
        this.setData({
          selecting: false
        });
      }
    });
  },

  onReadTxt() {
    if (
      !this.data.selected ||
      !this.selectedTempPath ||
      this.data.reading
    ) {
      return;
    }

    this.setData({
      reading: true,
      errorText: ""
    });

    const fs =
      wx.getFileSystemManager();

    fs.readFile({
      filePath:
        this.selectedTempPath,

      success: (res) => {
        try {
          const arrayBuffer =
            res.data;

          if (
            !arrayBuffer ||
            typeof arrayBuffer
              .byteLength !==
              "number"
          ) {
            throw new Error(
              "没有读取到有效的文件数据"
            );
          }

          const decoded =
            this.decodeUtf8(
              arrayBuffer
            );

          const text =
            decoded.text;

          if (!text.trim()) {
            throw new Error(
              "TXT 文件没有可用文字"
            );
          }

          if (
            this.looksCorrupted(text)
          ) {
            this.setData({
              textLoaded: false,
              textLength: 0,
              textPreview: "",

              encodingStatus:
                "疑似编码或内容异常",

              errorText:
                "读取出的文字包含较多异常字符。当前版本不会继续处理，请尝试将文件另存为 UTF-8 后重新选择。"
            });

            return;
          }

          const previewLimit =
            3000;

          const preview =
            text.length >
              previewLimit
              ? text.slice(
                  0,
                  previewLimit
                ) +
                "\n\n……（预览已截断）"
              : text;

          this.loadedText = text;

          this.setData({
            textLoaded: true,

            textLength:
              text.length,

            textPreview:
              preview,

            encodingStatus:
              decoded.hadBom
                ? "UTF-8（检测到 BOM）"
                : "UTF-8 基础解码通过",

            statusText:
              "TXT 正文读取成功",

            errorText: ""
          });
        } catch (error) {
          console.error(
            "处理 TXT 正文失败：",
            error
          );

          this.setData({
            textLoaded: false,
            textLength: 0,
            textPreview: "",
            encodingStatus:
              "读取失败",

            errorText:
              error.message ||
              "无法读取 TXT 正文。"
          });
        }
      },

      fail: (error) => {
        console.error(
          "读取 TXT 文件失败：",
          error
        );

        this.setData({
          textLoaded: false,
          textLength: 0,
          textPreview: "",
          encodingStatus:
            "读取失败",

          errorText:
            "微信未能读取这个临时文件。"
        });
      },

      complete: () => {
        this.setData({
          reading: false
        });
      }
    });
  },

  decodeUtf8(arrayBuffer) {
    const bytes =
      new Uint8Array(
        arrayBuffer
      );

    let start = 0;
    let hadBom = false;

    // UTF-8 BOM:
    // EF BB BF
    if (
      bytes.length >= 3 &&
      bytes[0] === 0xef &&
      bytes[1] === 0xbb &&
      bytes[2] === 0xbf
    ) {
      start = 3;
      hadBom = true;
    }

    let output = "";

    for (
      let i = start;
      i < bytes.length;
    ) {
      const byte1 =
        bytes[i];

      // 1 字节 ASCII
      if (byte1 <= 0x7f) {
        output +=
          String.fromCharCode(
            byte1
          );

        i += 1;
        continue;
      }

      // 2 字节 UTF-8
      if (
        byte1 >= 0xc2 &&
        byte1 <= 0xdf
      ) {
        if (
          i + 1 >=
          bytes.length
        ) {
          output += "\uFFFD";
          i += 1;
          continue;
        }

        const byte2 =
          bytes[i + 1];

        if (
          (byte2 & 0xc0) !==
          0x80
        ) {
          output += "\uFFFD";
          i += 1;
          continue;
        }

        const codePoint =
          ((byte1 & 0x1f) <<
            6) |
          (byte2 & 0x3f);

        output +=
          String.fromCharCode(
            codePoint
          );

        i += 2;
        continue;
      }

      // 3 字节 UTF-8
      if (
        byte1 >= 0xe0 &&
        byte1 <= 0xef
      ) {
        if (
          i + 2 >=
          bytes.length
        ) {
          output += "\uFFFD";
          i += 1;
          continue;
        }

        const byte2 =
          bytes[i + 1];

        const byte3 =
          bytes[i + 2];

        const validContinuation =
          (byte2 & 0xc0) ===
            0x80 &&
          (byte3 & 0xc0) ===
            0x80;

        const validRange =
          !(
            byte1 === 0xe0 &&
            byte2 < 0xa0
          ) &&
          !(
            byte1 === 0xed &&
            byte2 >= 0xa0
          );

        if (
          !validContinuation ||
          !validRange
        ) {
          output += "\uFFFD";
          i += 1;
          continue;
        }

        const codePoint =
          ((byte1 & 0x0f) <<
            12) |
          ((byte2 & 0x3f) <<
            6) |
          (byte3 & 0x3f);

        output +=
          String.fromCharCode(
            codePoint
          );

        i += 3;
        continue;
      }

      // 4 字节 UTF-8
      if (
        byte1 >= 0xf0 &&
        byte1 <= 0xf4
      ) {
        if (
          i + 3 >=
          bytes.length
        ) {
          output += "\uFFFD";
          i += 1;
          continue;
        }

        const byte2 =
          bytes[i + 1];
        const byte3 =
          bytes[i + 2];
        const byte4 =
          bytes[i + 3];

        const validContinuation =
          (byte2 & 0xc0) ===
            0x80 &&
          (byte3 & 0xc0) ===
            0x80 &&
          (byte4 & 0xc0) ===
            0x80;

        const validRange =
          !(
            byte1 === 0xf0 &&
            byte2 < 0x90
          ) &&
          !(
            byte1 === 0xf4 &&
            byte2 > 0x8f
          );

        if (
          !validContinuation ||
          !validRange
        ) {
          output += "\uFFFD";
          i += 1;
          continue;
        }

        let codePoint =
          ((byte1 & 0x07) <<
            18) |
          ((byte2 & 0x3f) <<
            12) |
          ((byte3 & 0x3f) <<
            6) |
          (byte4 & 0x3f);

        codePoint -=
          0x10000;

        output +=
          String.fromCharCode(
            0xd800 +
              (codePoint >> 10),
            0xdc00 +
              (codePoint &
                0x3ff)
          );

        i += 4;
        continue;
      }

      output += "\uFFFD";
      i += 1;
    }

    return {
      text: output,
      hadBom: hadBom
    };
  },

  looksCorrupted(text) {
    if (
      typeof text !== "string" ||
      !text
    ) {
      return true;
    }

    let replacementCount = 0;

    for (
      let i = 0;
      i < text.length;
      i++
    ) {
      if (
        text.charCodeAt(i) ===
        0xfffd
      ) {
        replacementCount += 1;
      }
    }

    // 替换字符过多时，
    // 认为可能不是 UTF-8，
    // 或文件本身已经损坏。
    const ratio =
      replacementCount /
      text.length;

    return (
      replacementCount >= 3 &&
      ratio > 0.01
    );
  },

  onSaveMaterial() {
    if (
      !this.data.textLoaded ||
      !this.loadedText ||
      this.data.savingMaterial
    ) {
      return;
    }

    // 防止在当前选择未变化时
    // 连续点击重复创建资料。
    if (
      this.data.savedMaterialId
    ) {
      wx.showModal({
        title: "已经保存",
        content:
          "当前 TXT 已经保存为本地资料，不需要重复保存。",
        showCancel: false
      });

      return;
    }

    this.setData({
      savingMaterial: true
    });

    try {
      const normalizedText =
      textProcessing.normalizeText(
        this.loadedText
      );

    const paragraphs =
      textProcessing.splitIntoParagraphs(
        normalizedText
      );

    const sources =
      textProcessing.createSources(
        paragraphs
      );

    const chunks =
      textProcessing.createChunks(
        sources
      );

      const processing = {
        version: 1,

        targetChars:
          textProcessing
            .DEFAULT_CHUNK_TARGET_CHARS,

        sources: sources,
        chunks: chunks
      };

      const material =
        localMaterials
          .saveTxtMaterial(
            this.data.fileName,
            this.loadedText,
            processing
          );

      this.setData({
        savedMaterialId:
          material.id
      });

      wx.showToast({
        title: "资料已保存",
        icon: "success"
      });
    } catch (error) {
      console.error(
        "保存 TXT 资料失败：",
        error
      );

      wx.showModal({
        title: "保存失败",
        content:
          error.message ||
          "未能保存本地资料。",
        showCancel: false
      });
    } finally {
      this.setData({
        savingMaterial: false
      });
    }
  },

  getExtension(fileName) {
    if (
      typeof fileName !== "string"
    ) {
      return "";
    }

    const index =
      fileName.lastIndexOf(".");

    if (
      index === -1 ||
      index ===
        fileName.length - 1
    ) {
      return "";
    }

    return fileName
      .slice(index + 1)
      .toLowerCase();
  }
});