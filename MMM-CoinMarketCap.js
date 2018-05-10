/* global Module */

/**
 * Magic Mirror
 * Module: MMM-CoinMarketCap
 *
 * By David Dearden
 * MIT Licensed.
 */

var axis, Log;
Module.register('MMM-CoinMarketCap', {
	
	defaults: {
		//currencies: [ { id: 1 }, { id: 1027 }, { id: 1592 } ], // The currencies to display, in the order that they will be displayed
		currencies: [ 1,
			{ id: 1, logoColored: true, logoSize: 'small' },
			{ name: 'taas', logoSize: 'small', logoColored: false },
			{ id: 1592, logoColored: true },
			{ name: 'eth', logoSize: 'large' },
			'ethereum', 'ABC',
			5000, { name: 'ethnotereum' }, { id: 5000 }, { id: 'therf' }, { name: 56666 }, [1] ],
		updateInterval: 10, // Minutes, minimum 5
		retryDelay: 5, // Seconds, minimum 0
		view: [ 'logo', 'symbol', 'name', 'price' ], // The columns to display, in the order that they will be displayed
		showColumnHeaders: [ 'symbol', 'price', 'logo' ], // Enable / Disagle the column header text.  Set to an array to enable by name
		columnHeaderText: { name: 'Currency', symbol: 'Currency', price: 'Price', logo: 'Logo' },
		logoSize: 'medium', // small, medium, large, 'x-large'
		logoColored: false, // if true, use the original logo, if false, use filter to make a black and white version
		
	},

	requiresVersion: '2.1.0', // Required version of MagicMirror

	start: function() {
		var self = this;
		var i, c;
		self.loaded = false;
		self.listings = null;
		self.currencyData = {};
		self.logosBaseURL = 'https://s2.coinmarketcap.com/static/img/coins/';
		self.logosURLTemplate = self.logosBaseURL + '{size}x{size}/{id}.png';
		self.apiBaseURL = 'https://api.coinmarketcap.com/';
		self.apiVersion = 'v2/';
		self.apiListingsEndpoint = 'listings/';
		self.maxListingAttempts = 4; // How many times to try downloading the listing before giving up and displaying an error
		self.apiTickerEndpoint = 'ticker/';
		self.maxTickerAttempts = 2; // How many times to try updating a currency before giving up
		self.allColumnTypes = [ 'name', 'symbol', 'price', 'logo' ];
		self.tableHeader = null;
		self.logoFolder = '/' + self.data.name + '/logos/';
		self.validLogoSizes = [ 'small', 'medium', 'large', 'x-large' ];
		self.logoSizeToPX = { 'small': 16, 'medium': 32, 'large': 64, 'x-large': 128 };
		
		// Process and validate configuration options
		if (!axis.isArray(self.config.currencies)) { self.config.currencies = self.defaults.currencies; }
		else { // Filter out invalid currency configurations (must have an id or name)
			self.config.currencies = self.config.currencies.filter(function(val) {
				return ( (axis.isNumber(val) && val > 0) || (axis.isString(val) && val.length > 0) ||
				(axis.isObject(val) && ( (axis.isNumber(val.id) && val.id > 0) || (axis.isString(val.name) && val.name.length > 0) )) );
			});
		}
		if (!axis.isObject(self.config.columnHeaderText)) { self.config.columnHeaderText = {}; }
		for (var key in self.config.columnHeaderText) {
			if (self.config.columnHeaderText.hasOwnProperty(key) && axis.isString(self.config.columnHeaderText[key])) {
				self.defaults.columnHeaderText[key] = self.config.columnHeaderText[key];
			}
		}
		self.config.columnHeaderText = self.defaults.columnHeaderText;
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
		if (!self.validLogoSizes.includes(self.config.logoSize)) { self.config.logoSize = self.defaults.logoSize; }
		if (!axis.isBoolean(self.config.logoColored)) { self.config.logoColored = self.defaults.logoColored; }
		
		// Configure all the currencies as objects with the requested settings
		for (i = 0; i < self.config.currencies.length; i++) {
			c = self.config.currencies[i];
			// Ensure that the currency is an object
			if (axis.isNumber(c)) {
				c = self.config.currencies[i] = { id: c };
			} else if (axis.isString(c)) {
				c = self.config.currencies[i] = { name: c };
			}
			if (!self.validLogoSizes.includes(c.logoSize)) { c.logoSize = self.config.logoSize; }
			if (!axis.isBoolean(c.logoColored)) { c.logoColored = self.config.logoColored; }
			
		}
		
		
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
		self.sendSocketNotification('GET_LISTINGS', { url: url, attemptNum: attemptNum, notification: 'LISTINGS_RECEIVED' } );
	},
	
	getSingleCurrencyDetails: function(id, attemptNum) {
		var self = this;
		Log.log(self.data.name + ': Request sent to update ' + self.currencyData[id].name + ' using ID: ' + id + '.  ');
		var url = self.apiBaseURL + self.apiVersion + self.apiTickerEndpoint + id + '/';
		self.sendSocketNotification('GET_CURRENCY_DETAILS', { url: url, id: id, attemptNum: attemptNum, notification: 'CURRENCY_DETAILS_RECEIVED' } );
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
				Log.log(self.data.name + ': Listings retrieved successfully after ' + payload.original.attemptNum + ' attempt(s).');
				self.listings = payload.data.data;
				self.filterCurrenciesAndSetupDataSet();
				self.loaded = true;
				self.updateDom(0);
				self.scheduleUpdate();
				self.getAllCurrencyDetails();
				Log.log(self.data.name + ': self.config.currencies: ' + JSON.stringify(self.config.currencies));
				//Log.log(self.data.name + ': self.currencyData: ' + JSON.stringify(self.currencyData));
			} else if (payload.original.attemptNum < self.maxListingAttempts) {
				Log.log(self.data.name + ': Listings retrieval FAILED! Retrying in 8 seconds.');
				setTimeout(function() { self.getListings(payload.original.attemptNum + 1); }, 8000);
			} else {
				if (payload.data) { self.listings = payload.data; }
				else { self.listings = payload.response.statusCode; }
				self.loaded = true;
				self.updateDom(0);
			}
		} else if (notification === 'CURRENCY_DETAILS_RECEIVED') {
			if (payload.isSuccessful && payload.data.metadata.error === null) {
				Log.log(self.data.name + ': Currency Update Received for ' + self.currencyData[payload.original.id].name + 
					' using ID: ' + payload.original.id + ' after ' + payload.original.attemptNum + ' attempt(s).');
				self.updateCurrency(payload.data.data);
				self.updateDom(0);
			} else if (payload.original.attemptNum < self.maxTickerAttempts) {
				Log.log(self.data.name + ': Currency Update FAILED for ' + self.currencyData[payload.original.id].name + ' using ID: ' + payload.original.id + '. Retrying in ' + (self.config.retryDelay/1000) + ' seconds.');
				setTimeout(function() { self.getCurrencyDetails(payload.original.id, payload.original.attemptNum + 1); }, self.config.retryDelay);
			}
		}
	},
	
	filterCurrenciesAndSetupDataSet: function() {
		var self = this;
		var i, c, listing;
		var temp = [];
		for (i = 0; i < self.config.currencies.length; i++) {
			c = self.config.currencies[i];
			listing = self.selectListing(c.id, c.name);
			if (axis.isUndefined(listing)) {
				Log.log(self.data.name + ': Unable to find currency with id: "' + c.id + '" or name: "' + c.name + '".');
			} else {
				c.id = listing.id;
				c.name = listing.name;
				c.symbol = listing.symbol;
				c.website_slug = listing.website_slug;
				temp.push(c);
				self.currencyData[listing.id] = { name: listing.name, data: null, loaded: false };
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
		
		if (self.tableHeader === null) { self.tableHeader = self.getTableHeader(); }
		if (self.tableHeader !== null) { table.appendChild(self.tableHeader); }
		
		for (k = 0; k < self.config.currencies.length; k++) {
			c = self.config.currencies[k];
			if (self.currencyData[c.id].loaded) {
				var row = document.createElement("tr");
				for (i = 0; i < self.config.view.length; i++) {
					var cell = document.createElement("td");
					//cell.innerHTML += self.getViewColContent(self.config.view[i], c.id);
					cell.appendChild(self.getViewColContent(self.config.view[i], c));
					row.appendChild(cell);
				}
				table.appendChild(row);
			}
		}
		
		wrapper.appendChild(table);
		
		return wrapper;
		
	},
	
	getTableHeader: function() {
		var self = this;
		var output = null, i;
		if (self.config.showColumnHeaders === true || (axis.isArray(self.config.showColumnHeaders) && self.config.showColumnHeaders.length > 0) ) {
			output = document.createElement("tr");
			for (i = 0; i < self.config.view.length; i++) {
				var cell = document.createElement("th");
				if (self.config.showColumnHeaders === true || (axis.isArray(self.config.showColumnHeaders) && self.config.showColumnHeaders.includes(self.config.view[i])) ) {
					cell.innerHTML = self.config.columnHeaderText[self.config.view[i]];
				} else {
					cell.innerHTML = ' ';
				}
				output.appendChild(cell);
			}
		}
		return output;
	},
	
	/**
	 * Generates the content for each content cell given the currency and column type
	 * @param colType the type of column to genereate
	 * @param currency a currency object from the self.config.currencies list
	 * @return a dom object containing the cell content
	 */
	getViewColContent: function(colType, currency) {
		var self = this;
		var data = self.currencyData[currency.id].data;
		switch (colType) {
			case 'name': return document.createTextNode(data.name);
			case 'symbol': return document.createTextNode(data.symbol);
			case 'price': return document.createTextNode(data.quotes.USD.price);
			case 'logo':
				var logoWrapper = document.createElement("span");
				logoWrapper.classList.add("logo-container");
				var logoFileName = self.logoFolder + data.symbol.toLowerCase() + '.png';
				if (!self.fileExists(logoFileName)) { logoFileName = self.getLogoURL(currency.logoSize, data.id); }
				if (self.fileExists(logoFileName)) {
					var logo = new Image();
					logo.src = logoFileName;
					logo.classList.add('logo-' + currency.logoSize);
					if (!currency.logoColored) { logo.classList.add('image-bw'); }
					logoWrapper.appendChild(logo);
					//self.logosURLTemplate
				}
				return logoWrapper;
		}
		return ' ';
	},
	
	getLogoURL: function(size, id) {
		var self = this;
		var output = self.logosURLTemplate;
		output = self.replaceAll(output, '{size}', self.logoSizeToPX[size].toString());
		output = self.replaceAll(output, '{id}', id.toString());
		return output;
	},
	
	fileExists: function(fileName) {
		var http = new XMLHttpRequest();
		http.open('HEAD', fileName, false);
		http.send();
		return http.status != 404;
	},
	
	replaceAll: function(str, find, replace) {
		var output = '';
		var idx = str.indexOf(find);
		while (idx >= 0) {
			output += str.substr(0, idx) + replace;
			str = str.substring(idx + find.length);
			idx = str.indexOf(find);
		}
		output += str;
		return output;
	},
	
	// Load Scripts
	getScripts: function() {
		var scripts = [];
		if (typeof axis !== 'function') { scripts.push(this.file('scripts/axis.js')); }
		return scripts;
	},
	
	// Load Style Sheets
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
