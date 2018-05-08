/* Magic Mirror
 * Node Helper: MMM-CoinMarketCap
 *
 * By David Dearden
 * MIT Licensed.
 */
 
var request = require('request');
var NodeHelper = require("node_helper");

module.exports = NodeHelper.create({
	
	start: function () {
		console.log('MMM-CoinMarketCap module loaded!');
	},
	
	getAndReturnJSON: function(notification, payload) {
		var self = this;
		request({ url: payload.url, method: 'GET' }, function (error, response, body) {
			var result;
			if (!error && response.statusCode === 200) {
				result = { isSuccessful: true, statusCode: response.statusCode, data: JSON.parse(body) };
			} else {
				result = { isSuccessful: false, statusCode: response.statusCode, data: error };
			}
			self.sendSocketNotification(notification, result);
		});
	},
	
	socketNotificationReceived: function(notification, payload) {
		var self = this;
		if (notification === "GET_LISTINGS") {
			self.getAndReturnJSON("LISTINGS_RECEIVED", payload);
		} else if (notification === "GET_CURRENCY_DETAILS") {
			self.getAndReturnJSON("CURRENCY_DETAILS_RECEIVED", payload);
		}
	},
	
});
