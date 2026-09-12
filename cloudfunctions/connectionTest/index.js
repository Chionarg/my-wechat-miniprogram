exports.main = async (event, context) => {
  return {
    ok: true,
    message: "连接成功",
    testVersion: 1
  };
};