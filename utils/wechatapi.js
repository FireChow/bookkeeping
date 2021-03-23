var config = require('../utils/wechatConfig');
var request = require('request');

var API = require('wechat-api');

var menu_config = config.wx_menu;
var app_id      = config.appID;
var app_secret  = config.appSecret;

//配置
var api = new API(app_id, app_secret);

//测试
function wechatApi(){
    api.createMenu(menu_config, function(err, result){
        console.log(result);
    });
}


module.exports = wechatApi;