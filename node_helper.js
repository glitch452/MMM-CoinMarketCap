/* Magic Mirror
 * Node Helper: MMM-CoinMarketCap
 *
 * By David Dearden
 * MIT Licensed.
 */
 
var request = require('request')
var NodeHelper = require("node_helper");

module.exports = NodeHelper.create({
	
	start: function () {
		console.log('MMM-CoinMarketCap module loaded!')
	},

	getDataFromURL: function(sourceURL, requestID) {
		var self = this;
		request({ url: sourceURL, method: 'GET' }, function (error, response, body) {
			if (!error && response.statusCode === 200) {
				var result = { id: requestID, status: 'ok', statusCode: response.statusCode, url: sourceURL, data: JSON.parse(body) };
			} else {
				var result = { id: requestID, status: 'error', statusCode: response.statusCode, url: sourceURL, data: null };
			}
			self.sendSocketNotification("JSON_RECEIVED", result);
		});
	},
	
	socketNotificationReceived: function(notification, payload) {
		var self = this;
		if (notification === "GET_JSON") {
			self.getDataFromURL(payload.url, payload.id);
		}
	},
	
});
