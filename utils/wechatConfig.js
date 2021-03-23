var wechat = {
	appID: `wxc6926e4284c2d1e3`,
	appSecret: `726737ad8720dbf922bbd19dc63a38e9`,
	wx_menu: {
      "button": [
        {
			"type":"view",
            "name": "记账",
            "url": "http://www.firechow.cn"
        },
        {
            "type":"click",
			"name":"回忆",
			"key":"V1001_TODAY_MUSIC"
        }
      ]
    }
};
module.exports = wechat;