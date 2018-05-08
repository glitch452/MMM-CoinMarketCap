/* global Module */

/* Magic Mirror
 * Module: MMM-CoinMarketCap
 *
 * By David Dearden
 * MIT Licensed.
 */

Module.register('MMM-CoinMarketCap', {
	defaults: {
		currencies: [ { id: 1 }, { id: 1027 }, { id: 1592 } ],
		//updateInterval: 60000,
		retryDelay: 5
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
		self.tickerURL = self.apiBaseURL + self.apiVersion + self.apiTickerEndpoint;
		self.maxAttempts = 2;
		
		// Process and validate configuration options
		if (!axis.isArray(self.config.currencies)) { self.config.currencies = self.defaults.currencies; }
		else {
			var i;
			for (i = self.config.currencies.length - 1; i >= 0; i--) {
				if (!axis.isNumber(self.config.currencies[i].id)) { self.config.currencies[i].id = -1; }
				if (!axis.isString(self.config.currencies[i].name)) { self.config.currencies[i].name = ''; }
			}
			//if (self.config.currencies.length < 1) { self.config.currencies = self.defaults.currencies; }
		}
		if (axis.isNumber(self.config.retryDelay) && self.config.retryDelay >= 0) { self.config.retryDelay = self.config.retryDelay * 1000; }
		else { self.config.retryDelay = self.defaults.retryDelay * 1000; }
		
		self.getListings();
	},
	
	getListings: function() {
		var self = this;
		var url = self.apiBaseURL + self.apiVersion + self.apiListingsEndpoint;
		self.sendSocketNotification('GET_LISTINGS', { url: url } );
	},
	
	getCurrencyDetails: function(id, attemptNum) {
		var self = this;
		var url = self.apiBaseURL + self.apiVersion + self.apiListingsEndpoint + id + '/';
		self.sendSocketNotification('GET_CURRENCY_DETAILS', { url: url , attemptNum: attemptNum } );
	},
	
	// socketNotificationReceived from node_helper
	socketNotificationReceived: function (notification, payload) {
		var self = this;
		if (notification === 'LISTINGS_RECEIVED') {
			if (payload.isSuccessful) {
				//Log.log('MMM-CoinMarketCap: Listings retrieved successfully!');
				self.listings = payload.data.data;
				self.validateCurrenciesAgainstListings();
				if (self.config.currencies.length < 1) { self.config.currencies = self.defaults.currencies; }
				self.loaded = true;
				self.updateDom(0);
			} else {
				setTimeout(function() { self.getListings(); }, self.config.retryDelay);
			}
		} else if (notification === 'CURRENCY_DETAILS_RECEIVED') {
			/*
			if (payload.isSuccessful) {
				//Log.log('MMM-CoinMarketCap: Listings retrieved successfully!');
				self.listings = payload.data.data;
				self.validateCurrenciesAgainstListings();
				if (self.config.currencies.length < 1) { self.config.currencies = self.defaults.currencies; }
				self.loaded = true;
				self.updateDom(0);
			} else {
				setTimeout(function() { self.getListings(); }, self.config.retryDelay);
			}*/
			
		}
	},
	
	validateCurrenciesAgainstListings: function() {
		var self = this;
		var i;
		for (i = self.config.currencies.length - 1; i >= 0; i--) {
			var listing = self.selectListing(self.config.currencies[i].id, self.config.currencies[i].name);
			if (axis.isUndefined(listing)) {
				self.config.currencies.splice(i, 1);
			} else {
				self.config.currencies[i].id = listing.id;
				self.config.currencies[i].name = listing.name;
				self.config.currencies[i].symbol = listing.symbol;
			}
		}
	},
	
	selectListing: function(id, name) {
		var self = this;
		if (!axis.isNumber(id)) { id = -1; }
		if (!axis.isString(name)) { name = ''; }
		name = name.toLowerCase();
		return self.listings.find(function(listing) {
			return (listing.id === this.id ||
					listing.symbol.toLowerCase() === this.name ||
					listing.name.toLowerCase() === this.name ||
					listing.website_slug.toLowerCase() === this.name);
		}, { id: id, name: name });
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
		
		self.config.currencies.forEach(function(c) {
			var newListItem = document.createElement("li");
			newListItem.innerHTML += c.name + ' (' + c.id + '): ' + c.symbol;
			listContainer.appendChild(newListItem);
		});
		
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
