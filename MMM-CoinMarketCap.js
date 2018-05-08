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
		updateInterval: 10, // Minutes, minimum 5
		retryDelay: 5 // Seconds
	},

	requiresVersion: '2.1.0', // Required version of MagicMirror

	start: function() {
		var self = this;
		self.loaded = false;
		self.listings = null;
		self.currencies = {};
		self.apiBaseURL = 'https://api.coinmarketcap.com/';
		self.apiVersion = 'v2/';
		self.apiListingsEndpoint = 'listings/';
		self.maxListingAttempts = 4; // How many times to try downloading the listing before giving up and displaying an error
		self.apiTickerEndpoint = 'ticker/';
		self.maxTickerAttempts = 2; // How many times to try updating a currency before giving up
		
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
		if (axis.isNumber(self.config.updateInterval) && self.config.updateInterval >= 5) { self.config.updateInterval = self.config.updateInterval * 60* 1000; }
		else { self.config.updateInterval = self.defaults.updateInterval * 60 * 1000; }
		
		self.getListings(1);
	},
	
	scheduleUpdate: function() {
        var self = this;
        setInterval(function() { self.getAllCurrencyDetails(); }, self.config.updateInterval);
    },
	
	getListings: function(attemptNum) {
		var self = this;
		var url = self.apiBaseURL + self.apiVersion + self.apiListingsEndpoint;
		self.sendSocketNotification('GET_LISTINGS', { url: url, attemptNum: attemptNum } );
	},
	
	getSingleCurrencyDetails: function(id, attemptNum) {
		var self = this;
		var url = self.apiBaseURL + self.apiVersion + self.apiTickerEndpoint + id + '/';
		self.sendSocketNotification('GET_CURRENCY_DETAILS', { url: url, attemptNum: attemptNum } );
	},
	
	getAllCurrencyDetails: function() {
		var self = this;
		for (var key in self.currencies) {
			if (!self.currencies.hasOwnProperty(key)) { continue; }
			getSingleCurrencyDetails(key, 1);
		}
	},
	
	// socketNotificationReceived from node_helper
	socketNotificationReceived: function (notification, payload) {
		var self = this;
		if (notification === 'LISTINGS_RECEIVED') {
			if (payload.isSuccessful) {
				Log.log('MMM-CoinMarketCap: Listings retrieved successfully!');
				self.listings = payload.data.data;
				self.validateCurrenciesAgainstListings();
				self.loaded = true;
				self.updateDom(0);
				self.getAllCurrencyDetails();
				self.scheduleUpdate();
			} else if (payload.original.attemptNum < self.maxListingAttempts) {
				setTimeout(function() { self.getListings(payload.original.attemptNum + 1); }, 8000);
			} else {
				if (payload.data) { self.listings = payload.data; }
				else { self.listings = payload.response.statusCode; }
				self.loaded = true;
				self.updateDom(0);
			}
		} else if (notification === 'CURRENCY_DETAILS_RECEIVED') {
			if (payload.isSuccessful) {
				Log.log('MMM-CoinMarketCap: Currency Update Received for ID: ' + payload.original.id);
				self.updateCurrency(payload.data.data);
				self.updateDom(0);
			} else if (payload.original.attemptNum < self.maxTickerAttempts) {
				setTimeout(function() { self.getCurrencyDetails(payload.original.id, payload.original.attemptNum + 1); }, self.config.retryDelay);
			}
		}
	},
	
	validateCurrenciesAgainstListings: function() {
		var self = this;
		self.config.currencies.forEach(function(c){
			var listing = self.selectListing(c.id, c.name);
			if (!axis.isUndefined(listing)) {
				self.currencies[c.id] = { id: listing.id, name: listing.name, symbol: listing.symbol, loaded: false };
			}
		});
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
	
	updateCurrency: function(data) {
		var self = this;
		self.currencies[data.id].loaded = true;
		
		
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
		
		if (!axis.isArray(self.listings)) {
			wrapper.innerHTML += 'Unable to get data from CoinMarketCap.com';
			wrapper.innerHTML += '<br />Error: ' + self.listings;
			return wrapper;
		}
		
		// Create and configure DOM elements
		var listContainer = document.createElement("ul");
		listContainer.classList.add("fa-ul");
		
		
		for (var key in self.currencies) {
			if (!self.currencies.hasOwnProperty(key)) { continue; }
			var c = self.currencies[key];
			if (!c.loaded) { continue; }
			var newListItem = document.createElement("li");
			newListItem.innerHTML += JSON.stringify(c);
			//newListItem.innerHTML += c.name + ' (' + c.id + '): ' + c.symbol;
			listContainer.appendChild(newListItem);
		}
		
		/*
		self.config.currencies.forEach(function(c) {
			var newListItem = document.createElement("li");
			newListItem.innerHTML += c.name + ' (' + c.id + '): ' + c.symbol;
			listContainer.appendChild(newListItem);
		});*/
		
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
