/* global Module */

/* Magic Mirror
 * Module: MMM-CoinMarketCap
 *
 * By David Dearden
 * MIT Licensed.
 */

Module.register('MMM-CoinMarketCap', {
	defaults: {
		updateInterval: 60000,
		retryDelay: 5000
	},

	requiresVersion: '2.1.0', // Required version of MagicMirror

	start: function() {
		var self = this;
		self.loaded = false;
		self.listings = null;
		self.apiBaseURL = 'https://api.coinmarketcap.com/';
		self.apiVersion = 'v2/';
		self.apiListingsEndpoint = 'listings/';
		self.apiTickerEndpoint = 'ticker/';
		
		var listingsURL = self.apiBaseURL + self.apiVersion + self.apiListingsEndpoint;
		
		self.sendSocketNotification('GET_JSON', { id: 'listings', url: listingsURL } );
		//JSON.stringify
	},
	
	// socketNotificationReceived from node_helper
	socketNotificationReceived: function (notification, payload) {
		var self = this;
		if (notification === 'JSON_RECEIVED') {
			if (payload.id === 'listings') {
				if (payload.status === 'ok') { self.listings = payload.data.data; }
				self.listingResponse = payload;
				self.loaded = true;
				self.updateDom();
			}
		}
	},

	getDom: function() {
		
		// Initialize some variables
		var self = this;
		var wrapper = document.createElement("div");
		wrapper.classList.add("small");
		
		if (!self.loaded) {
			wrapper.innerHTML += 'Loading...';
			return wrapper;
		}
		
		if (self.listings === null) {
			//wrapper.innerHTML += 'Unable to get data from CoinMarketCap.com';
			wrapper.innerHTML += 'Status: ' + self.listingResponse.status + ' - statusCode: ' + self.listingResponse.statusCode + '<br />URL: ' + self.listingResponse.url;
			return wrapper;
		}
		
		// Create and configure DOM elements
		var listContainer = document.createElement("ul");
		listContainer.classList.add("fa-ul");
		
		var i = 0;
		for (i = 0; i < 10; i++) {
			var newListItem = document.createElement("li");
			newListItem.innerHTML += self.listings[i].name + ' (' + self.listings[i].id + '): ' + self.listings[i].symbol;
			listContainer.appendChild(newListItem);
		}
		
		wrapper.appendChild(listContainer);
		
		return wrapper;
		
	},

	getScripts: function() {
		var scripts = [];
		if (typeof axis !== 'function') { scripts.push(this.file('scripts/axis.js')); }
		return scripts;
	},

	getStyles: function () {
		return [
			"MMM-CoinMarketCap.css",
		];
	},

	// Load translations files
	getTranslations: function() {
		return {
			en: "translations/en.json",
		};
	},
	
});
