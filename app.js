// app.js
App({
  onLaunch() {
    if (!wx.cloud) {
      console.error("当前运行环境不支持云开发，请检查微信或基础库版本。");
      return;
    }

    wx.cloud.init({
      env: "cloud1-d8gz05sc2dd65a676",
      traceUser: false
    });
  },

  globalData: {
    userInfo: null
  }
});
