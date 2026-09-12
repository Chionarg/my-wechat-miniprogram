const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

exports.main = async () => {
  const wxContext = cloud.getWXContext();

  return {
    ok: Boolean(wxContext.OPENID),
    openid: wxContext.OPENID || ""
  };
};