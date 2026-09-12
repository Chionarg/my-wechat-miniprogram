const https = require("https");

function requestPublicEndpoint() {
  return new Promise((resolve, reject) => {
    const request = https.get(
      "https://example.com/",
      {
        timeout: 5000,
        headers: {
          "User-Agent": "cloud-network-test/1.0"
        }
      },
      (response) => {
        // 我们不读取或保存网页正文。
        response.resume();

        response.on("end", () => {
          resolve({
            statusCode: response.statusCode || 0
          });
        });
      }
    );

    request.on("timeout", () => {
      request.destroy(
        new Error("外部 HTTPS 请求超过 5 秒仍未完成")
      );
    });

    request.on("error", (error) => {
      reject(error);
    });
  });
}

exports.main = async () => {
  try {
    const result = await requestPublicEndpoint();

    return {
      ok:
        result.statusCode >= 200 &&
        result.statusCode < 400,
      statusCode: result.statusCode,
      message: "云函数已完成外部 HTTPS 连接测试",
      testVersion: 1
    };
  } catch (error) {
    console.error("外部 HTTPS 测试失败：", error.message);

    return {
      ok: false,
      statusCode: 0,
      message: "外部 HTTPS 连接失败",
      errorType: error.code || "NETWORK_ERROR",
      testVersion: 1
    };
  }
};