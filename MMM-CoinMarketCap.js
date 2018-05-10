/* global Module */

/* Magic Mirror
 * Module: MMM-CoinMarketCap
 *
 * By David Dearden
 * MIT Licensed.
 */

var axis, Log;
Module.register('MMM-CoinMarketCap', {
	
	defaults: {
		//currencies: [ { id: 1 }, { id: 1027 }, { id: 1592 } ], // The currencies to display, in the order that they will be displayed
		currencies: [ 1, { name: 'taas' }, { id: 1592 }, { name: 'eth' }, 'ethereum', 'btc', 5000, { name: 'ethnotereum' }, { id: 5000 }, { id: 'therf' }, { name: 56666 }, [1] ],
		updateInterval: 10, // Minutes, minimum 5
		retryDelay: 5, // Seconds
		view: [ 'symbol', 'name', 'price' ], // The columns to display, in the order that they will be displayed
		showColumnHeaders: [ 'symbol', 'price' ], // Enable / Disagle the column header text.  Set to an array to enable by name
	},

	requiresVersion: '2.1.0', // Required version of MagicMirror

	start: function() {
		var self = this;
		self.loaded = false;
		self.listings = null;
		self.currencyData = {};
		self.apiBaseURL = 'https://api.coinmarketcap.com/';
		self.apiVersion = 'v2/';
		self.apiListingsEndpoint = 'listings/';
		self.maxListingAttempts = 4; // How many times to try downloading the listing before giving up and displaying an error
		self.apiTickerEndpoint = 'ticker/';
		self.maxTickerAttempts = 2; // How many times to try updating a currency before giving up
		self.allColumnTypes = [ 'name', 'symbol', 'price' ];
		
		// Process and validate configuration options
		if (!axis.isArray(self.config.currencies)) { self.config.currencies = self.defaults.currencies; }
		else { // Filter out invalid currency configurations (must have an id or name)
			self.config.currencies = self.config.currencies.filter(function(val) {
				return ( (axis.isNumber(val) && val > 0) || (axis.isString(val) && val.length > 0) ||
				(axis.isObject(val) && ( (axis.isNumber(val.id) && val.id > 0) || (axis.isString(val.name) && val.name.length > 0) )) );
			});
		}
		if (axis.isNumber(self.config.retryDelay) && self.config.retryDelay >= 0) { self.config.retryDelay = self.config.retryDelay * 1000; }
		else { self.config.retryDelay = self.defaults.retryDelay * 1000; }
		if (axis.isNumber(self.config.updateInterval) && self.config.updateInterval >= 5) { self.config.updateInterval = self.config.updateInterval * 60* 1000; }
		else { self.config.updateInterval = self.defaults.updateInterval * 60 * 1000; }
		if (!axis.isArray(self.config.view)) { self.config.view = self.defaults.view; }
		if (axis.isArray(self.config.showColumnHeaders)) { // filter out items from config.showColumnHeaders that are not in allColumnTypes
			self.config.showColumnHeaders = self.config.showColumnHeaders.filter(function(val) { return this.includes(val); }, self.allColumnTypes);
		}
		if (!axis.isBoolean(self.config.showColumnHeaders) &&
			!axis.isArray(self.config.showColumnHeaders) ||
			(axis.isArray(self.config.showColumnHeaders) && self.config.showColumnHeaders.length < 1)
		) { self.config.showColumnHeaders = self.defaults.showColumnHeaders; }
		
		
		self.getListings(1);
	},
	
	scheduleUpdate: function() {
        var self = this;
		Log.log(self.data.name + ': Update scheduled to run automatically every ' + (self.config.updateInterval / (1000 * 60)) + ' minutes.');
        setInterval(function() { self.getAllCurrencyDetails(); }, self.config.updateInterval);
    },
	
	getListings: function(attemptNum) {
		var self = this;
		Log.log(self.data.name + ': Request sent for currency listings.  ');
		var url = self.apiBaseURL + self.apiVersion + self.apiListingsEndpoint;
		self.sendSocketNotification('GET_LISTINGS', { url: url, attemptNum: attemptNum } );
	},
	
	getSingleCurrencyDetails: function(id, attemptNum) {
		var self = this;
		Log.log(self.data.name + ': Request sent to update ' + self.currencyData[id].name + ' using ID: ' + id + '.  ');
		var url = self.apiBaseURL + self.apiVersion + self.apiTickerEndpoint + id + '/';
		self.sendSocketNotification('GET_CURRENCY_DETAILS', { url: url, id: id, attemptNum: attemptNum } );
	},
	
	getAllCurrencyDetails: function() {
		var self = this;
		Log.log(self.data.name + ': Update triggered.');
		for (var key in self.currencyData) {
			if (!self.currencyData.hasOwnProperty(key)) { continue; }
			self.getSingleCurrencyDetails(key, 1);
		}
	},
	
	// socketNotificationReceived from node_helper
	socketNotificationReceived: function (notification, payload) {
		var self = this;
		if (notification === 'LISTINGS_RECEIVED' && !self.loaded) {
			if (payload.isSuccessful && payload.data.metadata.error === null) {
				Log.log(self.data.name + ': Listings retrieved successfully!');
				self.listings = payload.data.data;
				self.validateCurrenciesAgainstListings();
				self.loaded = true;
				self.updateDom(0);
				self.scheduleUpdate();
				self.getAllCurrencyDetails();
				//Log.log(self.data.name + ': self.config.currencies: ' + JSON.stringify(self.config.currencies));
				//Log.log(self.data.name + ': self.currencyData: ' + JSON.stringify(self.currencyData));
			} else if (payload.original.attemptNum < self.maxListingAttempts) {
				setTimeout(function() { self.getListings(payload.original.attemptNum + 1); }, 8000);
			} else {
				if (payload.data) { self.listings = payload.data; }
				else { self.listings = payload.response.statusCode; }
				self.loaded = true;
				self.updateDom(0);
			}
		} else if (notification === 'CURRENCY_DETAILS_RECEIVED') {
			if (payload.isSuccessful && payload.data.metadata.error === null) {
				Log.log(self.data.name + ': Currency Update Received for ' + self.currencyData[payload.original.id].name + ' using ID: ' + payload.original.id + '.');
				self.updateCurrency(payload.data.data);
				self.updateDom(0);
			} else if (payload.original.attemptNum < self.maxTickerAttempts) {
				setTimeout(function() { self.getCurrencyDetails(payload.original.id, payload.original.attemptNum + 1); }, self.config.retryDelay);
			}
		}
	},
	
	validateCurrenciesAgainstListings: function() {
		var self = this;
		var i, val, listing;
		var temp = [];
		for (i = 0; i < self.config.currencies.length; i++) {
			val = self.config.currencies[i];
			if (axis.isNumber(val)) {
				listing = self.selectListing(val, null);
				if (axis.isUndefined(listing)) {
					Log.log(self.data.name + ': Unable to find currency with id: "' + val + '".');
				} else {
					temp.push( { id: listing.id } );
					self.currencyData[listing.id] = { name: listing.name, data: null, loaded: false };
				}
			} else if (axis.isString(val)) {
				listing = self.selectListing(null, val);
				if (axis.isUndefined(listing)) {
					Log.log(self.data.name + ': Unable to find currency with name: "' + val + '".');
				} else {
					temp.push( { id: listing.id } );
					self.currencyData[listing.id] = { name: listing.name, data: null, loaded: false };
				}
			} else if (axis.isObject(val)) {
				listing = self.selectListing(val.id, val.name);
				if (axis.isUndefined(listing)) {
					Log.log(self.data.name + ': Unable to find currency with id: "' + val.id + '" and name: "' + val.name + '".');
				} else {
					val.id = listing.id;
					temp.push(val);
					self.currencyData[listing.id] = { name: listing.name, data: null, loaded: false };
				}
			}
		}
		self.config.currencies = temp;
	},
	
	selectListing: function(id, name) {
		var self = this;
		if (!axis.isNumber(id)) { id = null; }
		if (!axis.isString(name)) { name = null; }
		else { name = name.toLowerCase(); }
		return self.listings.find(function(listing) {
			return (listing.id === this.id ||
					listing.symbol.toLowerCase() === this.name ||
					listing.name.toLowerCase() === this.name ||
					listing.website_slug.toLowerCase() === this.name);
		}, { id: id, name: name });
	},
	
	updateCurrency: function(data) {
		var self = this;
		if (!self.currencyData[data.id].loaded) { self.currencyData[data.id].loaded = true; }
		self.currencyData[data.id].data = data;
		//Log.log(self.data.name + ': The currency "' + data.name + '" has been updated.');
	},
	
	// Override the default notificationReceived function
	notificationReceived: function(notification, payload, sender) {
		var self = this;
		if (sender) { // If the notification is coming from another module
			
		}
	},
	
	getDom: function() {
		
		// Initialize some variables
		var self = this;
		var c, i, k;
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
		
		var table = document.createElement("table");
		
		if (self.config.showColumnHeaders === true ||
			(axis.isArray(self.config.showColumnHeaders) && self.config.showColumnHeaders.length > 0)
		) {
			var headerRow = document.createElement("tr");
			
			for (i = 0; i < self.config.view.length; i++) {
				var headerCell = document.createElement("th");
				headerCell.innerHTML += self.getViewColName(self.config.view[i]);
				headerRow.appendChild(headerCell);
			}
			
			table.appendChild(headerRow);
		}
		
		for (k = 0; k < self.config.currencies.length; k++) {
			c = self.config.currencies[k];
			if (self.currencyData[c.id].loaded) {
				var row = document.createElement("tr");
				for (i = 0; i < self.config.view.length; i++) {
					var cell = document.createElement("td");
					cell.innerHTML += self.getViewColContent(self.config.view[i], c.id);
					row.appendChild(cell);
				}
				table.appendChild(row);
			}
		}
		
		wrapper.appendChild(table);
		
		return wrapper;
		
	},
	
	getViewColName: function(colID) {
		self = this;
		var output = '';
		switch (colID) {
			case 'name': output = 'Currency'; break;
			case 'symbol': output = 'Symbol'; break;
			case 'price': output = 'Price'; break;
		}
		if (self.config.showColumnHeaders === true ||
			(axis.isArray(self.config.showColumnHeaders) && self.config.showColumnHeaders.includes(colID))
		) { return output; }
		else { return ''; }
	},
	
	getViewColContent: function(colType, currencyID) {
		self = this;
		switch (colType) {
			case 'name': return self.currencyData[currencyID].data.name;
			case 'symbol': return self.currencyData[currencyID].data.symbol;
			case 'price': return self.currencyData[currencyID].data.quotes.USD.price;
		}
		return '&nbsp;';
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
