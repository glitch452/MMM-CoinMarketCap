/**
 * Magic Mirror
 * Node Helper: MMM-CoinMarketCap
 *
 * By David Dearden
 * MIT Licensed.
 */

/**
 * Load resources required by this module.  
 */
var NodeHelper = require('node_helper');
var express = require('express');
var request = require('request');
var fs = require('fs');

/**
 * Use NodeHelper to create a module.  
 */
module.exports = NodeHelper.create({
	
	/**
	 * The minimum version of magic mirror that is required for this module to run. 
	 */
	requiresVersion: '2.2.1',
	
	/**
	 * Override the start function to run when the module is started up.  
	 * Used to provide initialization information to the console and to map
	 * additional routes.  
	 */
	start: function () {
		var self = this;
		console.log(self.name + ': module loaded! Path: ' + this.path);
		try {
			self.expressApp.use("/" + self.name + '/logos', express.static(self.path + "/logos"));
			console.log(self.name + ': Path "/logos" configured successfully.');
		} catch (err) {
			console.log(self.name + ': Error configuring additional routes: ' + err);
		}
	},
	
	/**
	 * Override the socketNotificationReceived function to handle notifications sent from the client script. 
	 * 
	 * @param notification (string) The type of notification sent
	 * @param payload (any) The data sent with the notification
	 */
	socketNotificationReceived: function(notification, payload) {
		var self = this;
		if (payload.developerMode) { console.log(self.name + ': Socket Notification Received: "' + notification + '".'); }
		if (notification === 'GET_LISTINGS') {
			self.getAndReturnJSON(payload);
		} else if (notification === 'GET_CURRENCY_DETAILS') {
			self.getAndReturnJSON(payload);
		} else if (notification === 'DOWNLOAD_FILE') {
			self.downloadFile(payload);
		} else if (notification === 'INIT') {
			self.sendSocketNotification('LOG', { original: payload, message: ('INIT received from: ' + payload.instanceID + '.'), messageType: 'dev' } );
			self.sendSocketNotification('LOG', { original: payload, message: ('node_helper.js loaded successfully.'), messageType: 'dev' } );
		}
	},
	
	/**
	 * The getAndReturnJSON function gets a JSON document from a URL and send it to the client.  
	 * 
	 * @param payload (object) Contains the data required for getting the JSON document
	 */
	getAndReturnJSON: function(payload) {
		var self = this;
		var config = {
			url: payload.url,
			method: 'GET',
		};
		if ( payload.apiKey ) {
			config.headers = { 'X-CMC_PRO_API_KEY': payload.apiKey };
		}
		request(config, function (error, response, body) {
			var result;
			if (!error && response.statusCode === 200) {
				result = { original: payload, isSuccessful: true, response: response, data: JSON.parse(body) };
			} else {
				result = { original: payload, isSuccessful: false, response: response, data: error };
			}
			if (typeof payload.notification === 'string') { self.sendSocketNotification(payload.notification, result); }
		});
	},
	
	/**
	 * The downloadFile function saves a file from a URL to the local file system. 
	 * 
	 * @param payload (object) Contains the data required for downloading and saving the file
	 */
	downloadFile: function(payload) {
		var self = this;
		request({ url: payload.url, encoding: 'binary', method: 'GET' }, function (error, response, body) {
			var result;
			if (!error && response.statusCode === 200) {
				result = { original: payload, isSuccessful: true, response: response, data: body };
			} else {
				result = { original: payload, isSuccessful: false, response: response, data: error };
			}
			if (typeof payload.notification === 'string') { self.sendSocketNotification(payload.notification, result); }
			// If the download was successful, try to save the file
			if (result.isSuccessful) {
				fs.writeFile(payload.saveToFileName, response.body, { encoding: 'binary' }, function(err){
					if (err) {
						self.sendSocketNotification('LOG',
							{ original: payload, translate: true, message: 'LOGO_SAVE_FAILURE',
							translateVars: { sourceFilename: payload.url, destinationFilename: payload.saveToFileName } });
					} else {
						self.sendSocketNotification('LOG',
							{ original: payload, translate: true, message: 'LOGO_SAVE_SUCCESS',
							translateVars: { sourceFilename: payload.url, destinationFilename: payload.saveToFileName } });
					}
				});
			}
		});
	},
	
});
