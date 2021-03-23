var mysql = require('mysql');
var conf = require('../config.js');
var db = {};
var pool = mysql.createPool(conf);
db.query = function(sql, callback){
    if (!sql) {
        callback();
        return;
    }
    pool.query(sql, function(err, rows) {
      if (err) {
        console.log(err);
        callback(err, null);
        return;
      };
      callback(null, rows);
    });
}
module.exports = db;