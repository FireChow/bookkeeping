var express = require('express');
var moment = require('moment');
var db = require('../utils/dbUtil');
var Page = require('../utils/page');
var crypto = require('crypto');
var session = require('express-session');
var router = express.Router();

String.prototype.trim = function() { return this.replace(/\s/g,''); }
Date.prototype.addDays = function(days) {
    var newDate = new Date(this.getTime());
    var day = newDate.getDate();
    newDate.setDate(day + days);
    return newDate;
};
Date.prototype.addMonths = function(months) {
    var newDate = new Date(this.getTime());
    var day = newDate.getDate();
    var newDay = day - 3;
    var month = newDate.getMonth();
    if(day < 28){
	    newDate.setMonth(month + months);
	}else{
		newDate.setDate(newDay);
		newDate.setMonth(month + months);
	}
    return newDate;
};
function formatDate(d) {
    var month = d.getMonth() + 1, day = d.getDate();
    return ''+d.getFullYear()+'-' + (month < 10 ? "0" + month : "" + month) + '-' + (day < 10 ? "0" + day : "" + day);
}
function splitDate(billDate){
    var date = billDate.split('-');
    if(date[1].indexOf('0') == 0){
        date[1] = date[0] + '-' + date[1].split('0')[1];
    }else{
        date[1] = date[0] + '-' + date[1];
    }
    date[2] = billDate;
    return date;
};
function cryptPwd(password) {
	var md5 = crypto.createHash('md5');
	var th2Md5 = crypto.createHash('md5');
	var psdMd5 = md5.update(password).digest('hex');
	var salt = psdMd5.substr(0, 4);
    var saltPassword = psdMd5 + ':' + salt;
    var result = th2Md5.update(saltPassword).digest('hex');
    return result;
}
/*
router.get('/interface', function(req, res, next){
	var token = "firechow";
	var signature = req.query.signature;
	var timestamp = req.query.timestamp;
	var echostr   = req.query.echostr;
	var nonce     = req.query.nonce;
	var oriArray = new Array();
	oriArray[0] = nonce;
	oriArray[1] = timestamp;
	oriArray[2] = token;
	oriArray.sort();
	var original = oriArray.join('');
	var shaObj = crypto.createHash('sha1');
	shaObj.update(original);
	var scyptoString = shaObj.digest('hex');
	if(signature == scyptoString){
		wechatApi.refreshToken();
		createMenu;
		res.send(echostr);
	} else {
		res.end();
	}
});*/
/* GET home page. */
router.get('/', function(req, res, next) {
	var userId = req.session.userid;
	if(userId){ 
		var page = new Page({page: req.query.p || 1, pageSize: 10});
		db.query('select familyId from userr where id = ' + userId, function(err, result){
			var familyId = result[0].familyId;
			db.query('select count(1) count from bill where familyId = ' + familyId, function(err, result){
				page.totalPage = result[0].count;
				db.query('select * from bill where familyId = ' + familyId + ' order by state, billDate desc limit ' + page.start + ',' + page.pageSize, function(err, result){
					var results = result;
					db.query('select * from bill where familyId = ' + familyId + ' and state = 0', function(err, result){
						var allResults = result;
						db.query('select * from userr where familyId = ' + familyId, function(err, result){
							var allUsers = result;
							var totalMoney = 0;
							var userMoney = [];
							allUsers.forEach(function(item){
								userMoney.push({'userId':item.id, 'name':item.billname, 'money':0});
							});
							allResults.forEach(function(item){
								if(item.state == 0){
									totalMoney += item.charge;
									userMoney.forEach(function(item2){
										if(item.userId == item2.userId){
											item2.money += item.charge;
										}
									});
								}
							});
							db.query('select * from billtype where familyId = ' + familyId, function(err, result){
								var billTypes = result;
								db.query('select * from family where id = ' + familyId, function(err, result){
									var createId = result[0].createUserId;
									res.render('index', {nav:'bill', createId:createId, results:results, billTypes:billTypes, userMoney:userMoney, totalMoney:totalMoney, today:new Date(), moment:moment, page:page});
								});
							});
						});
					});
				});
			});
		});
	}
});

router.get('/login', function(req, res, next){
	var message = req.query.message || '';
    res.render('login', {nav:'login', message:message});
})

router.post('/login/doLogin', function (req, res, next) {
	var username = req.body.username.trim();
	var psd = req.body.psd.trim();
	if(username != '' && psd != ''){
		db.query('select * from userr where username = \'' + username + '\'', function(err, result){
			console.log(result);
			var message = '';
			if(result != null){
				if(result[0].isActive == 1){
					var id = result[0].id;
					if(result[0].psd == cryptPwd(psd)){
						req.session.user = username;
						req.session.billname = result[0].billname;
						req.session.userid = id;
						db.query('update userr set failCount = 0 where id = ' + id, function(err, result){
							res.send({message:false});
						});
					}else{
						var failCount = result[0].failCount + 1;
						var isActive = 1;
						if(failCount >= 5) isActive = 0;
						db.query('update userr set failCount = ' + failCount + ', isActive = ' + isActive + ' where id = ' + id, function(err, result){
							if(isActive != 0){
								message = '密码错误，5次登录失败将不能再登录，还剩' + (5 - failCount) + '次';
							}else{
								message = '该账号已被冻结，如非本人操作，请联系管理员解冻';
							}
							res.send({message:message});
						});
					}
				}else{
					message = '该账号已被冻结，如非本人操作，请联系管理员解冻';
					res.send({message:message});
				}
			}else{
				message = '用户名不存在';
				res.send({message:message});
			}
		});
	}else{
		message = '用户名或密码不能为空';
		res.send({message:message});
	}
});

router.get('/logout', function (req, res, next) {
	req.session.userid = null;
	req.session.user = null;
	req.session.billname = null;
	res.redirect('/login');
});

router.get('/chart', function (req, res, next) {
	var userId = req.session.userid;
	if(userId){ 
		db.query('select familyId from userr where id = ' + userId, function(err, result){
			var familyId = result[0].familyId;
			var currentDate = new Date();
			var listDates = [currentDate.addDays(-6).getDate()+'日', currentDate.addDays(-5).getDate()+'日', currentDate.addDays(-4).getDate()+'日', currentDate.addDays(-3).getDate()+'日', currentDate.addDays(-2).getDate()+'日', currentDate.addDays(-1).getDate()+'日', currentDate.getMonth()+1+'月'+currentDate.getDate()+'日'];
			var listMonths = [currentDate.addMonths(-6).getMonth()+1+'月', currentDate.addMonths(-5).getMonth()+1+'月', currentDate.addMonths(-4).getMonth()+1+'月', currentDate.addMonths(-3).getMonth()+1+'月', currentDate.addMonths(-2).getMonth()+1+'月', currentDate.addMonths(-1).getMonth()+1+'月', currentDate.getFullYear()+'年'+(currentDate.getMonth()+1)+'月'];
			var listYears = [currentDate.getFullYear() - 6+'年', currentDate.getFullYear() - 5+'年', currentDate.getFullYear() - 4+'年', currentDate.getFullYear() - 3+'年', currentDate.getFullYear() - 2+'年', currentDate.getFullYear() - 1+'年', currentDate.getFullYear()+'年'];
			var listDatesDatas = [];
			var listMonthsDatas = [];
			var listYearsDatas = [];
			var listDatesOnlyDatas = [formatDate(currentDate.addDays(-6)), formatDate(currentDate.addDays(-5)), formatDate(currentDate.addDays(-4)), formatDate(currentDate.addDays(-3)), formatDate(currentDate.addDays(-2)), formatDate(currentDate.addDays(-1)), formatDate(currentDate)];
		    var listMonthsOnlyDatas = [currentDate.addMonths(-6).getFullYear()+'-'+(currentDate.addMonths(-6).getMonth()+1), currentDate.addMonths(-5).getFullYear()+'-'+(currentDate.addMonths(-5).getMonth()+1), currentDate.addMonths(-4).getFullYear()+'-'+(currentDate.addMonths(-4).getMonth()+1), currentDate.addMonths(-3).getFullYear()+'-'+(currentDate.addMonths(-3).getMonth()+1), currentDate.addMonths(-2).getFullYear()+'-'+(currentDate.addMonths(-2).getMonth()+1), currentDate.addMonths(-1).getFullYear()+'-'+(currentDate.addMonths(-1).getMonth()+1), currentDate.addMonths(0).getFullYear()+'-'+(currentDate.addMonths(0).getMonth()+1)];
		    var listYearsOnlyDatas = [currentDate.getFullYear() - 6, currentDate.getFullYear() - 5, currentDate.getFullYear() - 4, currentDate.getFullYear() - 3, currentDate.getFullYear() - 2, currentDate.getFullYear() - 1, currentDate.getFullYear()];
			db.query('select * from bill where familyId = ' + familyId, function(err, result){
				if(result != null){
					var dayCount = 0;
					var monthCount = 0;
		            var yearCount = 0;
		            var strs = [];
					for(var i = 0; i < 7; i++){
						strs.push(i);
					}
					strs.forEach(function(i){
						result.forEach(function(item){
							if(splitDate(formatDate(item.billDate))[2] == listDatesOnlyDatas[i]){
		                        dayCount += item.charge;
		                    }
		                    if(splitDate(formatDate(item.billDate))[1] == listMonthsOnlyDatas[i]){
		                        monthCount += item.charge;
		                    }
		                    if(splitDate(formatDate(item.billDate))[0] == listYearsOnlyDatas[i]){
		                        yearCount += item.charge;
		                    }
						});
		                listDatesDatas.push(dayCount);
		                listMonthsDatas.push(monthCount);
		                listYearsDatas.push(yearCount);
		                dayCount = 0;
		                monthCount = 0;
		                yearCount = 0;
		            });
					res.render('chart', {nav:'chart', listDates:listDates, listMonths:listMonths, listYears:listYears, listDatesDatas:listDatesDatas, listMonthsDatas:listMonthsDatas, listYearsDatas:listYearsDatas});
				}
			});
		});
	}
});
router.get('/userInfo', function (req, res, next) {
	var id = req.session.userid;
	if (id) {
		db.query('select * from userr where id = ' + id, function(err, result){
			res.render('userInfo', {nav:'userInfo', message:'', result:result});
		});
	}
});

router.post('/userInfo/modifyInfo', function (req, res, next) {
	var id = req.session.userid;
	var username = req.body.username.trim();
	var billname = req.body.billname.trim();
	var psd = req.body.psd.trim();
	var confirmPsd = req.body.confirmPsd.trim();
	console.log(id);
	if (id) {
		if(psd != '' && confirmPsd != '' && username != '' && billname != ''){
			db.query('select * from userr where username = \'' + username + '\' and id <> ' + id, function(err, result){
				console.log(result);
				if(result.length == 0){
					if(/^[a-zA-Z0-9\-]{1,12}$/.test(username)){
						if(/^[a-zA-Z0-9\-\u4e00-\u9fa5]{1,6}$/.test(billname)){
							if(psd.length < 6){
								message = '密码至少6位';
								res.send({message:message});
							}else{
								if(/^[0-9]*$/.test(psd) || /^[A-Za-z]+$/.test(psd) || /^[^0-9A-Za-z]+$/.test(psd)){
									message = '密码至少包含字母、数字和字符中至少两种';
									res.send({message:message});
								}else{
									if(psd == confirmPsd){
										db.query('update userr set username = \'' + username + '\', billname = \'' + billname + '\', psd = \'' + cryptPwd(psd) + '\' where id = ' + id, function(err, result){
											res.send({message:false});
										});
									}else{
										message = '密码和确认密码不一致';
										res.send({message:message});
									}
								}
							}
						}else{
							message = '内部名只能由1~6个数字、英文、中文或-组成';
							res.send({message:message});
						}
					}else{
						message = '用户名只能由1~12个数字、英文或-组成';
						res.send({message:message});
					}
				}else{
					message = '用户名已存在';
					res.send({message:message});
				}
			});
		}else{
			message = '用户名或密码不能为空';
			res.send({message:message});
		}
	}
});

router.get('/familyInfo', function (req, res, next) {
	var id = req.session.userid;
	if (id) {
		db.query('select * from userr where id = ' + id, function(err, result){
			var familyId = result[0].familyId;
			db.query('select * from family where id = ' + familyId, function(err, result){
				var familyInfo = result;
				db.query('select * from billtype where familyid = ' + familyId, function(err, result){
					var billTypes = result;
					db.query('select * from userr where familyid = ' + familyId, function(err, result){
						var familyUsers = result;
						res.render('familyInfo', {nav:'familyInfo', message:'', familyInfo:familyInfo, billTypes:billTypes, familyUsers:familyUsers});
					});
				});
			});
		});
	}
});

router.post('/familyInfo/modifyInfo', function (req, res, next) {
	var id = req.session.userid;
	var familyname = req.body.familyname.trim();
	var billTypes = JSON.parse(req.body.billTypes);
	var familyUsers = JSON.parse(req.body.familyUsers);
	if (id) {
		db.query('select * from userr where id = ' + id, function(err, result){
			var familyId = result[0].familyId;
			if(familyname != ''){
				var deleteTypesQuery = 'delete from billtype where familyId = ' + familyId;
				var insertTypesQuery = 'insert into billtype(name, familyId) values(\'';
				var updateUserQuery = 'update userr set rate = case id';
				var userIds = '';
				var billTypesPassed = false
				billTypes.forEach(function(bt){
					bt = bt.trim();
					if(/^[\da-zA-Z&\u4e00-\u9fa5]{1,8}$/.test(bt)){
						insertTypesQuery += bt + '\', ' + familyId + '), (\'';
					}else{
						message = '种类不能含\'&\'之外的其它特殊字符，且不能超过8个字符';
						res.send({message:message});
					}
				});
				insertTypesQuery = insertTypesQuery.substring(0,insertTypesQuery.length - 4);
				familyUsers.forEach(function(fu){
					if(fu.rate != ''){
						fu.rate = fu.rate.trim();
						if(/^[0-9]+(.[0-9]*)?$/.test(fu.rate)){
							updateUserQuery += ' when ' + fu.id + ' then ' + fu.rate;
							userIds += fu.id + ',';
						}else{
							message = '请输入正实数';
							res.send({message:message});
						}
					}else{
						message = '支付比率不能为空';
						res.send({message:message});
					}
				});
				updateUserQuery += 'end where id in (' + userIds.substring(0,userIds.length - 1) + ')';
				console.log(insertTypesQuery);
				console.log(updateUserQuery);
				db.query(deleteTypesQuery, function(err, result){
					db.query(insertTypesQuery, function(err, result){
						db.query(updateUserQuery, function(err, result){
							console.log(insertTypesQuery);
							console.log(updateUserQuery);
							res.send({message:false});
						});
					});
				});
			}else{
				message = '家庭名称不能为空';
				res.send({message:message});
			}
		});
	}
});

router.post('/save', function(req, res, next) {
	var id = req.session.userid;
	if(id){
		db.query('select familyId from userr where id = ' + id, function(err, result){
			var familyId = result[0].familyId;
			db.query('select * from userr where id = ' + id, function(err, result){
				var name = req.body.name;
				var charger = result[0].billname;
				var description = req.body.description;
				var charge = req.body.charge;
				var category = req.body.category;
				var billDate = req.body.billDate;
				db.query('insert into bill(name, userId, familyId, charger, description, charge, category, billDate) values(\'' + name + '\', ' + id + ', ' + familyId + ', \'' + charger + '\', \'' + description + '\', \'' + charge + '\', \'' + category + '\', \'' + billDate + '\')', function(err, result){
					res.redirect('/');
				});
			});
		});
	}else{
		res.redirect('/');
	}
});

router.get('/bill', function(req, res, next) {
	if(req.session.userid){
		var id = req.query.id;
		db.query('update bill set state = 1 where id = ' + id, function(err, result){
			res.redirect('/');
		});
	}else{
		res.redirect('/');
	}
});
router.get('/deleteBill', function(req, res, next) {
	if(req.session.userid){
		var id = req.query.id;
		db.query('delete from bill where id = ' + id, function(err, result){
			res.redirect('/');
		});
	}else{
		res.redirect('/');
	}
});

router.post('/getBill', function(req, res, next) {
	if(req.session.userid){
		var id = req.body.id;
		db.query('select id, name, description, charge, category, billDate from bill where id = ' + id, function(err, result){
			res.send({name:result[0].name, description:result[0].description, charge:result[0].charge, category:result[0].category, billDate:result[0].billDate});
		});
	}else{
		res.redirect('/');
	}
});

router.post('/modify', function(req, res, next) {
	var id = req.session.userid;
	if(id){
		db.query('select * from userr where id = ' + id, function(err, result){
			var billId = req.body.billId;
			var name = req.body.name;
			var charger = result[0].billname;
			var description = req.body.description;
			var charge = req.body.charge;
			var category = req.body.category;
			var billDate = req.body.billDate;
			db.query('update bill set name = \'' + name + '\', charger = \'' + charger + '\', description = \'' + description + '\', charge = \'' + charge + '\', category = \'' + category + '\', billDate = \'' + billDate + '\' where id = ' + billId, function(err, result){
				res.redirect('/');
			});
		});
	}else{
		res.redirect('/');
	}
});

router.get('/balanceToToday', function(req, res, next) {
	var userId = req.session.userid;
	if(userId){
		db.query('select familyId from userr where id = ' + userId, function(err, result){
			var familyId = result[0].familyId;
			db.query('select * from family where id = ' + familyId, function(err, result){
				var createId = result[0].createUserId;
				if(req.session.userid == createId){
					db.query('update bill set state = 1 where familyId = ' + familyId + ' and state = 0', function(err, result){
						res.redirect('/');
					});
				}
			});
		});
	}
});

module.exports = router;
