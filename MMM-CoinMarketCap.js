/* global Module */

/**
 * Magic Mirror
 * Module: MMM-CoinMarketCap
 *
 * By David Dearden
 * MIT Licensed.
 */

var axis, Log, config;
Module.register('MMM-CoinMarketCap', {
	
	defaults: {
		currencies: [ 1, 1027 ], // The currencies to display, in the order that they will be displayed
		updateInterval: 10, // Minutes, minimum 5
		retryDelay: 10, // Seconds, minimum 0
		columns: [ 'name', 'price', 'change1h', 'change24h', 'change7d' ], // The columns to display, in the order that they will be displayed
		showColumnHeaders: true, // Enable / Disable the column header text.  Set to an array to enable by name
		columnHeaderText: {},
		/*	name: 'Currency',
			symbol: 'Currency',
			price: 'Price ({conversion})',
			priceWithChanges: 'Price ({conversion})',
			priceUSD: 'Price (USD)',
			logo: '',
			change1h: 'Hour',
			change24h: 'Day',
			change7d: 'Week',
			graph: 'Trend ({range})',
			changes: 'Changes',
		},*/
		logoSize: 'medium', // small, medium, large, 'x-large'
		logoColored: false, // if true, use the original logo, if false, use filter to make a black and white version
		percentChangeColored: false,
		cacheLogos: true, // Whether to download the logos from coinmarketcap or just access them from the site directly
		conversion: 'USD',
		significantDigits: 0, // How many significant digits to round to in the price display
		decimalPlaces: 2, // How many decimal places to show
		usePriceDigitGrouping: true, // Whether to use loacle specific separators for currency (1000 vs 1,000)
		graphRange: 7, // How many days for the graph data.  Options: 1, 7, 30
		fontSize: 'small',
		graphSize: 'medium',
		showRowSeparator: true,
		fontColor: '', //https://www.w3schools.com/cssref/css_colors_legal.asp
		showCurrencyWithPrice: false,
		fullWidthMode: true, // If true, the module will fill the space of the region when other modules in the region are wider
		tallHeader: null,
		developerMode: false,
	},

	requiresVersion: '2.1.0', // Required version of MagicMirror
	
	/* setConfig(config)
	 * Set the module config and combine it with the module defaults.
	 *
	 * argument config obejct - Module config.
	 */
	setConfig: function (config) {
		var self = this;
		
		if (typeof config.view === 'string') {
			switch (config.view) {
				case 'detailed': self.defaults.columns = [ 'name', 'price', 'change1h', 'change24h', 'change7d' ]; break;
				case 'detailedSymbol': self.defaults.columns = [ 'symbol', 'price', 'change1h', 'change24h', 'change7d' ]; break;
				case 'detailedWithUSD': self.defaults.columns = [ 'name', 'price', 'priceUSD', 'change1h', 'change24h', 'change7d' ]; break;
				case 'graph':
					self.defaults.columns = [ 'logo', 'price', 'graph' ];
					self.defaults.showColumnHeaders = false;
					self.defaults.percentChangeColored = true;
					self.defaults.fullWidthMode = false;
					self.defaults.fontSize = 'medium';
					break;
				case 'graphColored':
					self.defaults.columns = [ 'logo', 'price', 'graph' ];
					self.defaults.showColumnHeaders = false;
					self.defaults.percentChangeColored = true;
					self.defaults.fullWidthMode = false;
					self.defaults.logoColored = true;
					self.defaults.fontSize = 'medium';
					break;
				case 'graphWithChanges':
					self.defaults.columns = [ 'logo', 'priceWithChanges', 'graph' ];
					self.defaults.showColumnHeaders = false;
					self.defaults.percentChangeColored = true;
					self.defaults.showCurrencyWithPrice = true;
					self.defaults.fullWidthMode = false;
					break;
				case 'logo':
					self.defaults.columns = [ 'logo', 'price' ];
					self.defaults.showColumnHeaders = false;
					self.defaults.showCurrencyWithPrice = true;
					self.defaults.fontSize = 'medium';
					self.defaults.fullWidthMode = false;
					break;
				case 'logoColored':
					self.defaults.columns = [ 'logo', 'price' ];
					self.defaults.showColumnHeaders = false;
					self.defaults.showCurrencyWithPrice = true;
					self.defaults.fontSize = 'medium';
					self.defaults.logoColored = true;
					self.defaults.fullWidthMode = false;
					break;
			}
		}

		self.config = Object.assign({}, self.defaults, config);
	},
	
	start: function() {
		var self = this;
		var i, c;
		self.modID = self.identifier + '_' + Math.random().toString().substring(2);
		self.sendSocketNotification('INIT', { modID: self.modID } );
		self.loaded = false;
		self.dataLoaded = false;
		self.listings = null;
		self.updateTimer = null;
		self.lastUpdateTime = null;
		self.currencyData = {};
		self.logosBaseURL = 'https://s2.coinmarketcap.com/static/img/coins/';
		self.logosURLTemplate = self.logosBaseURL + '{size}x{size}/{id}.png';
		self.apiBaseURL = 'https://api.coinmarketcap.com/';
		self.apiVersion = 'v2/';
		self.apiListingsEndpoint = 'listings/';
		self.maxListingAttempts = 4; // How many times to try downloading the listing before giving up and displaying an error
		self.apiTickerEndpoint = 'ticker/';
		self.maxTickerAttempts = 2; // How many times to try updating a currency before giving up
		self.allColumnTypes = [ 'name', 'symbol', 'price', 'priceUSD', 'logo', 'change1h', 'change24h', 'change7d', 'graph', 'changes', 'priceWithChanges' ];
		self.tallColumns = [ 'graph', 'changes', 'priceWithChanges' ];
		self.tableHeader = null;
		self.LocalLogoFolder = self.path + '/logos/';
		self.LocalLogoFolderBW = self.path + '/logos/bw/';
		self.httpLogoFolder = '/' + self.name + '/logos/';
		self.httpLogoFolderBW = '/' + self.name + '/logos/bw/';
		self.validLogoSizes = [ 'small', 'medium', 'large', 'x-large' ];
		self.validFontSizes = [ 'x-small', 'small', 'medium', 'large', 'x-large' ];
		self.validGraphSizes = [ 'x-small', 'small', 'medium', 'large', 'x-large' ];
		self.validGraphRangeValues = [ 1, 7, 30 ];
		self.logoSizeToPX = { 'small': 16, 'medium': 32, 'large': 64, 'x-large': 128 };
		self.validConversions = [ "AUD", "BRL", "CAD", "CHF", "CLP", "CNY", "CZK", "DKK", "EUR", "GBP", "HKD", "HUF", "IDR", "ILS", "INR", 
								"JPY", "KRW", "MXN", "MYR", "NOK", "NZD", "PHP", "PKR", "PLN", "RUB", "SEK", "SGD", "THB", "TRY", "TWD", "ZAR",
								"BTC", "ETH", "XRP", "LTC", "BCH" ]; // Valid cryptocurrency values
		
		// Process and validate configuration options
		
		self.defaults.columnHeaderText = {
			name: self.translate('CURRENCY_TITLE'),
			symbol: self.translate('CURRENCY_TITLE'),
			price: self.translate('PRICE_TITLE', { 'conversion_var': '{conversion}' }),
			priceWithChanges: self.translate('PRICE_TITLE', { 'conversion_var': '{conversion}' }),
			priceUSD: self.translate('PRICE_USD_TITLE'),
			logo: '',
			change1h: self.translate('HOUR_TITLE'),
			change24h: self.translate('DAY_TITLE'),
			change7d: self.translate('WEEK_TITLE'),
			graph: self.translate('TREND_TITLE', { 'range_var': '{range}', 'days_var': '{days}' }),
			changes: self.translate('CHANGES_TITLE'),
		};
		if (!axis.isObject(self.config.columnHeaderText)) { self.config.columnHeaderText = {}; }
		for (var key in self.config.columnHeaderText) {
			if (self.config.columnHeaderText.hasOwnProperty(key) && axis.isString(self.config.columnHeaderText[key])) {
				self.defaults.columnHeaderText[key] = self.config.columnHeaderText[key];
			}
		}
		self.config.columnHeaderText = self.defaults.columnHeaderText;
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
		if (!axis.isArray(self.config.columns)) { self.config.view = self.defaults.columns; }
		if (axis.isArray(self.config.showColumnHeaders)) { // filter out items from config.showColumnHeaders that are not in allColumnTypes
			self.config.showColumnHeaders = self.config.showColumnHeaders.filter(function(val) { return this.includes(val); }, self.allColumnTypes);
		}
		if (!axis.isBoolean(self.config.showColumnHeaders) &&
			!axis.isArray(self.config.showColumnHeaders) ||
			(axis.isArray(self.config.showColumnHeaders) && self.config.showColumnHeaders.length < 1)
		) { self.config.showColumnHeaders = self.defaults.showColumnHeaders; }
		if (!self.validLogoSizes.includes(self.config.logoSize)) { self.config.logoSize = self.defaults.logoSize; }
		if (!axis.isBoolean(self.config.logoColored)) { self.config.logoColored = self.defaults.logoColored; }
		if (!axis.isBoolean(self.config.cacheLogos)) { self.config.cacheLogos = self.defaults.cacheLogos; }
		if (!axis.isBoolean(self.config.percentChangeColored)) { self.config.percentChangeColored = self.defaults.percentChangeColored; }
		if (!self.validConversions.includes(self.config.conversion)) { self.config.conversion = self.defaults.conversion; }
		if (!axis.isNumber(self.config.significantDigits) || self.config.significantDigits < 0) { self.config.significantDigits = self.defaults.significantDigits; }
		else { self.config.significantDigits = Math.round(self.config.significantDigits); }
		if (!axis.isNumber(self.config.decimalPlaces) || self.config.decimalPlaces < 0) { self.config.decimalPlaces = self.defaults.decimalPlaces; }
		else { self.config.decimalPlaces = Math.round(self.config.decimalPlaces); }
		if (!axis.isBoolean(self.config.usePriceDigitGrouping)) { self.config.usePriceDigitGrouping = self.defaults.usePriceDigitGrouping; }
		if (!self.validGraphRangeValues.includes(self.config.graphRange)) { self.config.graphRange = self.defaults.graphRange; }
		if (!self.validFontSizes.includes(self.config.fontSize)) { self.config.fontSize = self.defaults.fontSize; }
		if (!self.validGraphSizes.includes(self.config.graphSize)) { self.config.graphSize = self.defaults.graphSize; }
		if (!axis.isBoolean(self.config.showRowSeparator)) { self.config.showRowSeparator = self.defaults.showRowSeparator; }
		if (!axis.isString(self.config.fontColor)) { self.config.fontColor = self.defaults.fontColor; }
		if (!axis.isBoolean(self.config.showCurrencyWithPrice)) { self.config.showCurrencyWithPrice = self.defaults.showCurrencyWithPrice; }
		if (!axis.isBoolean(self.config.developerMode)) { self.config.developerMode = self.defaults.developerMode; }
		if (!axis.isBoolean(self.config.fullWidthMode)) { self.config.fullWidthMode = self.defaults.fullWidthMode; }
		if (!axis.isBoolean(self.config.tallHeader)) { self.config.tallHeader = self.config.columns.some(function(val) { return this.includes(val); }, self.tallColumns); }
		
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
			c.logoSizePX = self.logoSizeToPX[c.logoSize];
			if (!axis.isBoolean(c.logoColored)) { c.logoColored = self.config.logoColored; }
			if (!axis.isBoolean(c.percentChangeColored)) { c.percentChangeColored = self.config.percentChangeColored; }
			if (!axis.isNumber(c.significantDigits) || c.significantDigits < 0) { c.significantDigits = self.defaults.significantDigits; }
			else { c.significantDigits = Math.round(c.significantDigits); }
			if (!axis.isNumber(c.decimalPlaces) || c.decimalPlaces < 0) { c.decimalPlaces = self.defaults.decimalPlaces; }
			else { c.decimalPlaces = Math.round(c.decimalPlaces); }
			if (!axis.isBoolean(c.usePriceDigitGrouping)) { c.usePriceDigitGrouping = self.config.usePriceDigitGrouping; }
			if (!self.validFontSizes.includes(c.fontSize)) { c.fontSize = self.config.fontSize; }
			if (!self.validGraphSizes.includes(c.graphSize)) { c.graphSize = self.config.graphSize; }
			if (!axis.isString(c.fontColor) || c.fontColor.length < 1) { c.fontColor = self.config.fontColor; }
			if (!axis.isBoolean(c.showCurrencyWithPrice)) { c.showCurrencyWithPrice = self.config.showCurrencyWithPrice; }
		}
		
		self.config.columnHeaderText.price = self.replaceAll(self.config.columnHeaderText.price, '{conversion}', self.config.conversion);
		self.config.columnHeaderText.priceWithChanges = self.replaceAll(self.config.columnHeaderText.priceWithChanges, '{conversion}', self.config.conversion);
		var range = '1 week';
		if (self.config.graphRange === 1) { range = '1 day'; } else if (self.config.graphRange === 30) { range = '1 month'; }
		self.config.columnHeaderText.graph = self.replaceAll(self.config.columnHeaderText.graph, '{range}', range);
		self.config.columnHeaderText.graph = self.replaceAll(self.config.columnHeaderText.graph, '{days}', self.config.graphRange);
		
		self.log(('start(): self.config: ' + JSON.stringify(self.config)), 'dev');
		self.log(('start(): self.data: ' + JSON.stringify(self.data)), 'dev');
		self.getListings(1);
	},
	
	suspend: function() {
        var self = this;
		self.log(self.translate('SUSPENDED') + '.');
		clearInterval(self.updateTimer);
    },
	
	resume: function() {
        var self = this;
		self.log(self.translate('RESUMED') + '.');
		self.scheduleUpdate();
		var date = new Date();
		var threashold = new Date( self.lastUpdateTime.getTime() + self.config.updateInterval );
		if (date >= threashold) { self.getAllCurrencyDetails(); }
    },
	
	scheduleUpdate: function() {
        var self = this;
        self.updateTimer = setInterval(function() { self.getAllCurrencyDetails(); }, self.config.updateInterval);
		self.log( self.translate('UPDATE_SCHEDULED', { 'minutes': (self.config.updateInterval / (1000 * 60)) }) );
    },
	
	getListings: function(attemptNum) {
		var self = this;
		self.log(self.translate('LISTINGS_REQUESTED'));
		var url = self.apiBaseURL + self.apiVersion + self.apiListingsEndpoint;
		self.sendSocketNotification('GET_LISTINGS', { modID: self.modID, url: url, attemptNum: attemptNum, notification: 'LISTINGS_RECEIVED' } );
	},
	
	getSingleCurrencyDetails: function(id, attemptNum) {
		var self = this;
		self.log(self.translate('CURRENCY_UPDATE_REQUESTED', { 'name': self.currencyData[id].name, 'id': id }));
		var url = self.apiBaseURL + self.apiVersion + self.apiTickerEndpoint + id + '/?convert=' + self.config.conversion;
		self.sendSocketNotification('GET_CURRENCY_DETAILS', { modID: self.modID, url: url, id: id, attemptNum: attemptNum, notification: 'CURRENCY_DETAILS_RECEIVED' } );
	},
	
	getAllCurrencyDetails: function() {
		var self = this;
		self.log(self.translate('UPDATE_STARTED'));
		self.lastUpdateTime = new Date();
		for (var key in self.currencyData) {
			if (!self.currencyData.hasOwnProperty(key)) { continue; }
			self.getSingleCurrencyDetails(key, 1);
		}
	},
	
	cacheLogos: function() {
		var self = this;
		if (!self.config.cacheLogos || !self.config.columns.includes('logo')) { return; }
		for (var key in self.currencyData) {
			if (!self.currencyData.hasOwnProperty(key)) { continue; }
			var symbol = self.currencyData[key].symbol.toLowerCase();
			for (var sizeKey in self.logoSizeToPX) {
				if (!self.logoSizeToPX.hasOwnProperty(sizeKey)) { continue; }
				var sizePX = self.logoSizeToPX[sizeKey];
				var imageURL = self.getLogoURL(sizePX, key);
				if (!self.fileExists(self.httpLogoFolder + symbol + '-' + sizePX + '.png')) {
					self.log(self.translate('REQUEST_LOGO_DOWNLOAD', { 'filename': imageURL }));
					self.sendSocketNotification('DOWNLOAD_FILE', {
						modID: self.modID,
						url: imageURL,
						saveToFileName: self.LocalLogoFolder + symbol + '-' + sizePX + '.png',
						attemptNum: 1,
						notification: 'LOGO_DOWNLOADED'
					});
				}
			}
		}
	},
	
	// socketNotificationReceived from node_helper
	socketNotificationReceived: function(notification, payload) {
		var self = this;
		
		if (!axis.isString(payload.original.modID)) {
			if (notification === 'LOG') {
				if (payload.translate) { self.log(self.translate(payload.message, payload.translateVars)); }
				else { self.log(payload.message); }
			}
			return;
		}
		// Filter our notifications for other instances
		if (payload.original.modID !== self.modID) {
			self.log(('Notification ignored for ID "' + payload.original.modID + '".'), 'dev');
			return;
		}
		
		if (notification === 'LOG') {
			if (payload.translate) { self.log(self.translate(payload.message, payload.translateVars)); }
			else { self.log(payload.message); }
		} else if (notification === 'LISTINGS_RECEIVED' && !self.loaded) {//payload.isSuccessful = false;
			if (payload.isSuccessful && payload.data.metadata.error === null) {
				self.log(self.translate('LISTINGS_SUCCESS', { 'numberOfAttempts': payload.original.attemptNum }));
				self.listings = payload.data.data;
				self.filterCurrenciesAndSetupDataSet();
				self.loaded = true;
				self.updateDom(0);
				self.scheduleUpdate();
				self.getAllCurrencyDetails();
				self.cacheLogos();
				self.log(('self.config.currencies: ' + JSON.stringify(self.config.currencies)), 'dev');
				//self.log(('self.currencyData: ' + JSON.stringify(self.currencyData)), 'dev');
			} else if (payload.original.attemptNum < self.maxListingAttempts) {
				self.log(self.translate('LISTINGS_FAILURE', { 'retryTimeInSeconds': 8 }));
				setTimeout(function() { self.getListings(Number(payload.original.attemptNum) + 1); }, 8000);
			} else {
				if (payload.data) { self.listings = payload.data; }
				else { self.listings = payload.response.statusCode; }
				self.loaded = true;
				self.updateDom(0);
			}
		} else if (notification === 'CURRENCY_DETAILS_RECEIVED') {//payload.isSuccessful = false;
			if (payload.isSuccessful && payload.data.metadata.error === null) {
				self.log(self.translate('CURRENCY_UPDATE_SUCCESS',
					{ 'name': self.currencyData[payload.original.id].name, 'id': payload.original.id, 'numberOfAttempts': payload.original.attemptNum }));
				self.updateCurrency(payload.data.data);
				self.updateDom(0);
			} else if (payload.original.attemptNum < self.maxTickerAttempts) {
				self.log(self.translate('CURRENCY_UPDATE_FAILURE',
					{ 'name': self.currencyData[payload.original.id].name, 'id': payload.original.id, 'retryTimeInSeconds': (self.config.retryDelay/1000) }));
				setTimeout(function() { self.getSingleCurrencyDetails(payload.original.id, Number(payload.original.attemptNum) + 1); }, self.config.retryDelay);
			}
		} else if (notification === 'LOGO_DOWNLOADED') {
			if (payload.isSuccessful) {
				self.log(self.translate('LOGO_DOWNLOAD_SUCCESS', { 'filename': payload.original.saveToFileName }));
			} else {
				self.log(self.translate('LOGO_DOWNLOAD_FAILURE', { 'filename': payload.original.saveToFileName }));
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
				self.log(self.translate('INVALID_CURRENCY', { 'name': c.name, 'id': c.id }));
			} else {
				c.id = listing.id;
				c.name = listing.name;
				c.symbol = listing.symbol;
				c.website_slug = listing.website_slug;
				temp.push(c);
				self.currencyData[listing.id] = { name: listing.name, symbol: listing.symbol, data: null, loaded: false };
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
		if (!self.dataLoaded) { self.dataLoaded = true; }
		self.currencyData[data.id].data = data;
	},
	
	// Override the default notificationReceived function
	notificationReceived: function(notification, payload, sender) {
		if (sender) { // If the notification is coming from another module
			
		}
	},
	
	getDom: function() {
		
		// Initialize some variables
		var self = this;
		var c, i, k;
		var wrapper = document.createElement('div');
		//wrapper.classList.add('small');
		
		if (!self.loaded) {
			wrapper.classList.add('loading');
			wrapper.classList.add('small');
			wrapper.innerHTML += self.translate('LOADING');
			return wrapper;
		}
		
		if (!axis.isArray(self.listings)) {
			wrapper.classList.add('loading');
			wrapper.classList.add('small');
			wrapper.innerHTML += self.translate('API_ERROR', { 'website': 'CoinMarketCap.com' } ); // Unable to get data from {website};
			if (self.config.developerMode) { wrapper.innerHTML += '<br />Error: ' + self.listings; }
			return wrapper;
		}
		
		if (!self.dataLoaded) {
			wrapper.classList.add('loading');
			wrapper.classList.add('small');
			wrapper.innerHTML += self.translate('LOADING');
			return wrapper;
		}
		
		var table = document.createElement('table');
		if (self.config.showRowSeparator) { table.classList.add('row-separator'); }
		if (self.config.fullWidthMode) { table.classList.add('fullSize'); }
		else { table.classList.add('minimalSize'); }
		if (self.config.tallHeader) { table.classList.add('tallHeader'); }
		
		if (self.tableHeader === null) { self.tableHeader = self.getTableHeader(); }
		if (self.tableHeader !== null) { table.appendChild(self.tableHeader); }
		
		for (k = 0; k < self.config.currencies.length; k++) {
			c = self.config.currencies[k];
			if (self.currencyData[c.id].loaded) {
				var row = document.createElement('tr');
				if (c.fontColor.length > 0) { row.style.color = c.fontColor; }
				row.classList.add(c.fontSize);
				for (i = 0; i < self.config.columns.length; i++) {
					row.appendChild(self.getCell(self.config.columns[i], c));
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
			output = document.createElement('tr');
			output.classList.add(self.config.fontSize);
			if (self.config.fontColor.length > 0) { output.style.color = self.config.fontColor; }
			for (i = 0; i < self.config.columns.length; i++) {
				var cell = document.createElement('th');
				cell.classList.add('cell-' + self.config.columns[i]);
				if (self.config.showColumnHeaders === true || (axis.isArray(self.config.showColumnHeaders) && self.config.showColumnHeaders.includes(self.config.columns[i])) ) {
					cell.innerHTML = self.config.columnHeaderText[self.config.columns[i]];
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
	getCell: function(colType, currency) {
		var self = this;
		var data = self.currencyData[currency.id].data;
		var cell = document.createElement('td');
		switch (colType) {
			case 'name': cell.classList.add('cell-' + colType); cell.innerHTML = data.name; break;
			case 'symbol': cell.classList.add('cell-' + colType); cell.innerHTML = data.symbol; break;
			case 'price':
				cell.classList.add('cell-' + colType);
				if (axis.isObject(data.quotes[self.config.conversion]) && !axis.isNull(data.quotes[self.config.conversion])) {
					var price = self.conformNumber(data.quotes[self.config.conversion].price, currency.significantDigits, currency.decimalPlaces);
					var priceOptions = { style: 'currency', currency: self.config.conversion, useGrouping: currency.usePriceDigitGrouping };
					priceOptions.minimumFractionDigits = priceOptions.maximumFractionDigits = currency.decimalPlaces; 
					price = Number(price).toLocaleString(config.language, priceOptions);
					var regex = /[A-Z]+(.+)/;
					var matches = regex.exec(price);
					cell.innerHTML = matches === null ? price : matches[1];
					if (currency.showCurrencyWithPrice) { cell.innerHTML += ' ' + self.config.conversion; }
				} else {
					cell.innerHTML = '?';	
				}
				break;
			case 'priceUSD':
				cell.classList.add('cell-' + colType);
				var priceUSD = self.conformNumber(data.quotes.USD.price, currency.significantDigits, currency.decimalPlaces);
				var priceOptionsUSD = { style: 'currency', currency: 'USD', useGrouping: currency.usePriceDigitGrouping };
				priceOptionsUSD.minimumFractionDigits = priceOptionsUSD.maximumFractionDigits = currency.decimalPlaces;
				cell.innerHTML = Number(priceUSD).toLocaleString(config.language, priceOptionsUSD);
				if (currency.showCurrencyWithPrice) { cell.innerHTML += ' USD'; }
				break;
			case 'change1h':
				cell.classList.add('cell-' + colType);
				if (currency.percentChangeColored && data.quotes.USD.percent_change_1h > 0) { cell.classList.add('positive'); }
				if (currency.percentChangeColored && data.quotes.USD.percent_change_1h < 0) { cell.classList.add('negative'); }
				cell.innerHTML = Number(data.quotes.USD.percent_change_1h / 100).toLocaleString(config.language,
								{ style: 'percent', currency: self.config.conversion, maximumFractionDigits: 2 });
				break;
			case 'change24h':
				cell.classList.add('cell-' + colType);
				if (currency.percentChangeColored && data.quotes.USD.percent_change_24h > 0) { cell.classList.add('positive'); }
				if (currency.percentChangeColored && data.quotes.USD.percent_change_24h < 0) { cell.classList.add('negative'); }
				cell.innerHTML = Number(data.quotes.USD.percent_change_24h / 100).toLocaleString(config.language,
								{ style: 'percent', currency: self.config.conversion, maximumFractionDigits: 2 });
				break;
			case 'change7d':
				cell.classList.add('cell-' + colType);
				if (currency.percentChangeColored && data.quotes.USD.percent_change_7d > 0) { cell.classList.add('positive'); }
				if (currency.percentChangeColored && data.quotes.USD.percent_change_7d < 0) { cell.classList.add('negative'); }
				cell.innerHTML = Number(data.quotes.USD.percent_change_7d / 100).toLocaleString(config.language,
								{ style: 'percent', currency: self.config.conversion, maximumFractionDigits: 2 });
				break;
			case 'changes':
				cell.classList.add('cell-' + colType);
				var hour = document.createElement('div');
				var day = document.createElement('div');
				var week = document.createElement('div');
				var h = self.getCell('change1h', currency);
				var d = self.getCell('change24h', currency);
				var w = self.getCell('change7d', currency);
				hour.innerHTML = 'H: ' + h.innerHTML;
				day.innerHTML = 'D: ' + d.innerHTML;
				week.innerHTML = 'W: ' + w.innerHTML;
				hour.setAttribute('class', h.getAttribute('class'));
				day.setAttribute('class', d.getAttribute('class'));
				week.setAttribute('class', w.getAttribute('class'));
				cell.appendChild(hour);
				cell.appendChild(day);
				cell.appendChild(week);
				break;
			case 'priceWithChanges':
				cell.classList.add('cell-' + colType);
				var pricePart = document.createElement('div');
				pricePart.classList.add('pricePart');
				pricePart.innerHTML = self.getCell('price', currency).innerHTML;
				var changesPart = document.createElement('div');
				changesPart.classList.add('changesPart');
				changesPart.innerHTML = self.getCell('changes', currency).innerHTML;
				cell.appendChild(pricePart);
				cell.appendChild(changesPart);
				break;
			case 'logo':
				cell.classList.add('cell-' + colType);
				cell.classList.add('logo-' + currency.logoSize);
				var LocalLogoFileName = self.httpLogoFolder + data.symbol.toLowerCase() + '-' + currency.logoSizePX + '.png';
				var LocalLogoFileNameBW = self.httpLogoFolderBW + data.symbol.toLowerCase() + '-' + currency.logoSizePX + '.png';
				var LocalLogoExists = self.fileExists(LocalLogoFileName);
				var logoFileName = self.getLogoURL(currency.logoSizePX, data.id);
				var logo = new Image();
				if (currency.logoColored && LocalLogoExists) { logoFileName = LocalLogoFileName; }
				else if (!currency.logoColored) {
					if (self.fileExists(LocalLogoFileNameBW)) { logoFileName = LocalLogoFileNameBW; }
					else {
						logo.classList.add('image-bw');
						if (LocalLogoExists) { logoFileName = LocalLogoFileName; }
					}
				}
				logo.src = logoFileName;
				cell.appendChild(logo);
				break;
			case 'graph':
				cell.classList.add('cell-' + colType);
				cell.classList.add('graph-' + currency.graphSize);
				var graph = new Image();
				graph.src = 'https://s2.coinmarketcap.com/generated/sparklines/web/' + self.config.graphRange + 'd/usd/' + data.id + '.png?noCache=' + Math.random();
				cell.appendChild(graph);
				break;
			default: cell.innerHTML = ' ';
		}
		return cell;
	},
	
	/**
	 * Format a number to have a specified amount of significant digits and/or a fixes amount of decimal places
	 * @param number the number to format
	 * @param significantDigits the number of digits to consider before rounding the number (minimum value: 1)
	 * @param decimalPlaces the number of decimal places the formatted number should display (includes 0's) (minimum value: 0)
	 * @return (string) the formatted number
	 */
	conformNumber: function(number, significantDigits, decimalPlaces) {
		var self = this;
		if (!axis.isNumber(significantDigits) || significantDigits < 0) { significantDigits = 0; }
		if (!axis.isNumber(decimalPlaces) || decimalPlaces < -1) { decimalPlaces = -1; }
		significantDigits = Math.round(significantDigits);
		decimalPlaces = Math.round(decimalPlaces);
		var result;
		var isNegative = number < 0;
		number = Math.abs(number);
		
		if (significantDigits === 0) {
			if (decimalPlaces === -1) { result = number; }
			else { result = self.roundNumber(number, decimalPlaces).toFixed(decimalPlaces); }
		} else {
			var integerPartSize = Math.floor(number) === 0 ? 0 : Math.floor(number).toString().length;
			if (decimalPlaces === -1) {
				if (integerPartSize === 0) { // Handle the special case: 0 < number < 1
					var parts = number.toExponential(significantDigits).split('e');
        			result = Number(self.roundNumber(parts[0], significantDigits - 1) + 'e' + parts[1]);
				} else {
					result = self.roundNumber(number, significantDigits - integerPartSize);
				}
			} else {
				result = self.conformNumber( self.conformNumber(number, significantDigits, 0), 0, decimalPlaces );
			}
		}
		return isNegative ? '-' + result : result.toString();
    },
	
	roundNumber: function(number, precision) {
        if (precision >= 0) { return Number(Math.round(number + 'e' + precision) + 'e-' + precision); }
    	else { return Number(Math.round(number + 'e-' + Math.abs(precision)) + 'e' + Math.abs(precision)); }
    },
	
	getLogoURL: function(size, id) {
		var self = this;
		if (axis.isString(size)) { size = self.logoSizeToPX[size]; }
		var output = self.logosURLTemplate;
		output = self.replaceAll(output, '{size}', size.toString());
		output = self.replaceAll(output, '{id}', id.toString());
		return output;
	},
	
	fileExists: function(fileName) {
		var request = new XMLHttpRequest();
		request.open('HEAD', fileName, false);
		request.send();
		return Number(request.status) !== 404;
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
	
	log: function(message, type) {
		var self = this;
		if (self.config.developerMode) {
			var date = new Date();
			var time = date.getHours() + ':' + date.getMinutes() + ':' + date.getSeconds();
			message = self.name + ': (' + self.data.index + ')(' + time + ') ' + message;
		} else { message = self.name + ': ' + message; }
		switch (type) {
			case 'error': Log.error(message); break;
			case 'info': Log.info(message); break;
			case 'dev': if (self.config.developerMode) { Log.log(message); } break;
			default: Log.log(message);
		}
	}
	
});
