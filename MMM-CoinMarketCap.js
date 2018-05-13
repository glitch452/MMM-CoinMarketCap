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
		//currencies: [ { id: 1 }, { id: 1027 }, { id: 1592 } ], // The currencies to display, in the order that they will be displayed
		/*currencies: [ 1,
			{ id: 1, logoColored: true, logoSize: 'small', significantDigits: 3 },
			{ name: 'taas', logoSize: 'small', logoColored: false, decimalPlaces: 4, percentChangeColored: false },
			{ id: 1592, logoColored: true, significantDigits: 2, decimalPlaces: 2, },
			{ name: 'eth', logoSize: 'large' },
			'ethereum', 'ABC',
			5000, { name: 'ethnotereum' }, { id: 5000 }, { id: 'therf' }, { name: 56666 }, [1] ],*/
		//currencies: [ 1, 1027 ],
		currencies: [ 1, 'ethereum', 'ripple', 'tron', 'taas', 'eos', 'litecoin', 'iota', 'dash', 'monero', 'Bytecoin', 'icon', ],
		updateInterval: 10, // Minutes, minimum 5
		retryDelay: 5, // Seconds, minimum 0
		//view: [ 'logo', 'price' ],
		view: [ 'logo', 'symbol', 'name', 'price', 'priceUSD', 'change1h', 'change24h', 'change7d', 'graph' ], // The columns to display, in the order that they will be displayed
		showColumnHeaders: [ 'symbol', 'price', 'priceUSD', 'logo', 'change1h', 'change24h', 'change7d', 'graph' ], // Enable / Disagle the column header text.  Set to an array to enable by name
		columnHeaderText: { name: 'Currency', symbol: 'Currency', price: 'Price ({conversion})', priceUSD: 'Price (USD)', logo: '', change1h: 'Hour', 
							change24h: 'Day', change7d: 'Week', graph: 'Trend ({range})' },
		logoSize: 'medium', // small, medium, large, 'x-large'
		logoColored: false, // if true, use the original logo, if false, use filter to make a black and white version
		percentChangeColored: true,
		cacheLogos: false, // Whether to download the logos from coinmarketcap or just access them from the site directly
		conversion: 'EUR',
		significantDigits: 0,
		decimalPlaces: 0,
		usePriceDigitGrouping: true, // Whether to use loacle specific separators for currency (1000 vs 1,000)
		graphRange: 30,
		
	},

	requiresVersion: '2.1.0', // Required version of MagicMirror

	start: function() {
		var self = this;
		var i, c;
		self.sendSocketNotification('INIT', null);
		self.loaded = false;
		self.dataLoaded = false;
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
		self.allColumnTypes = [ 'name', 'symbol', 'price', 'priceUSD', 'logo', 'change1h', 'change24h', 'change7d', 'graph' ];
		self.tableHeader = null;
		self.LocalLogoFolder = 'modules/' + self.data.name + '/public/logos/';
		self.LocalLogoFolderBW = 'modules/' + self.data.name + '/public/logos_bw/';
		self.httpLogoFolder = '/' + self.data.name + '/logos/';
		self.httpLogoFolderBW = '/' + self.data.name + '/logos_bw/';
		self.validLogoSizes = [ 'small', 'medium', 'large', 'x-large' ];
		self.validGraphRangeValues = [ 1, 7, 30 ];
		self.logoSizeToPX = { 'small': 16, 'medium': 32, 'large': 64, 'x-large': 128 };
		self.validConversions = [ "AUD", "BRL", "CAD", "CHF", "CLP", "CNY", "CZK", "DKK", "EUR", "GBP", "HKD", "HUF", "IDR", "ILS", "INR", 
								"JPY", "KRW", "MXN", "MYR", "NOK", "NZD", "PHP", "PKR", "PLN", "RUB", "SEK", "SGD", "THB", "TRY", "TWD", 
								"ZAR", "BTC", "ETH", "XRP", "LTC", "BCH" ];
		
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
		if (!axis.isBoolean(self.config.cacheLogos)) { self.config.cacheLogos = self.defaults.cacheLogos; }
		if (!axis.isBoolean(self.config.percentChangeColored)) { self.config.percentChangeColored = self.defaults.percentChangeColored; }
		if (!self.validConversions.includes(self.config.conversion)) { self.config.conversion = self.defaults.conversion; }
		if (!axis.isNumber(self.config.significantDigits) || self.config.significantDigits < 0) { self.config.significantDigits = self.defaults.significantDigits; }
		else { self.config.significantDigits = Math.round(self.config.significantDigits); }
		if (!axis.isNumber(self.config.decimalPlaces) || self.config.decimalPlaces < 0) { self.config.decimalPlaces = self.defaults.decimalPlaces; }
		else { self.config.decimalPlaces = Math.round(self.config.decimalPlaces); }
		if (!axis.isBoolean(self.config.usePriceDigitGrouping)) { self.config.usePriceDigitGrouping = self.defaults.usePriceDigitGrouping; }
		if (!self.validGraphRangeValues.includes(self.config.graphRange)) { self.config.graphRange = self.defaults.graphRange; }
		
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
			
		}
		
		self.config.columnHeaderText.price = self.replaceAll(self.config.columnHeaderText.price, '{conversion}', self.config.conversion);
		var range = '1 week';
		if (self.config.graphRange === 1) { range = '1 day'; } else if (self.config.graphRange === 30) { range = '1 month'; }
		self.config.columnHeaderText.graph = self.replaceAll(self.config.columnHeaderText.graph, '{range}', range);
		
		Log.log(self.data.name + ': self.config: ' + JSON.stringify(self.config));
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
		var url = self.apiBaseURL + self.apiVersion + self.apiTickerEndpoint + id + '/?convert=' + self.config.conversion;
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
	
	cacheLogos: function() {
		var self = this;
		if (!self.config.cacheLogos) { return; }
		//Log.log(self.data.name + ': Requesting to cache logos.');
		for (var key in self.currencyData) {
			if (!self.currencyData.hasOwnProperty(key)) { continue; }
			var symbol = self.currencyData[key].symbol.toLowerCase();
			for (var sizeKey in self.logoSizeToPX) {
				if (!self.logoSizeToPX.hasOwnProperty(sizeKey)) { continue; }
				var sizePX = self.logoSizeToPX[sizeKey];
				var imageURL = self.getLogoURL(sizePX, key);
				if (!self.fileExists(self.httpLogoFolder + symbol + '-' + sizePX + '.png')) {
					Log.log(self.data.name + ': Requesting logo download: "' + imageURL + '".');
					self.sendSocketNotification('DOWNLOAD_FILE', {
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
		if (notification === 'LOG') {
			Log.log(self.data.name + ': ' + payload);
		} else if (notification === 'LISTINGS_RECEIVED' && !self.loaded) {
			if (payload.isSuccessful && payload.data.metadata.error === null) {
				Log.log(self.data.name + ': Listings retrieved successfully after ' + payload.original.attemptNum + ' attempt(s).');
				self.listings = payload.data.data;
				self.filterCurrenciesAndSetupDataSet();
				self.loaded = true;
				self.updateDom(0);
				self.scheduleUpdate();
				self.getAllCurrencyDetails();
				self.cacheLogos();
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
		} else if (notification === 'LOGO_DOWNLOADED') {
			if (payload.isSuccessful) {
				Log.log(self.data.name + ': Successfully download logo: "' + payload.original.saveToFileName + '".');
			} else {
				Log.log(self.data.name + ': Logo download failed for: "' + payload.original.saveToFileName + '".');
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
			wrapper.classList.add("loading");
			wrapper.innerHTML += 'Loading ...';
			return wrapper;
		}
		
		if (!axis.isArray(self.listings)) {
			wrapper.innerHTML += 'Unable to get data from CoinMarketCap.com';
			wrapper.innerHTML += '<br />Error: ' + self.listings;
			return wrapper;
		}
		
		if (!self.dataLoaded) {
			wrapper.classList.add("loading");
			wrapper.innerHTML += 'Loading ...';
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
					row.appendChild(self.getCell(self.config.view[i], c));
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
	getCell: function(colType, currency) {
		var self = this;
		//Log.log(self.data.name + ': getCell(' + colType + ', ' + currency + ')');
		var data = self.currencyData[currency.id].data;
		var cell = document.createElement("td");
		switch (colType) {
			case 'name': cell.classList.add('cell-' + colType); cell.innerHTML = data.name; break;
			case 'symbol': cell.classList.add('cell-' + colType); cell.innerHTML = data.symbol; break;
			case 'price':
				cell.classList.add('cell-' + colType);
				if (axis.isObject(data.quotes[self.config.conversion]) && !axis.isNull(data.quotes[self.config.conversion])) {
					var price = self.conformNumber(data.quotes[self.config.conversion].price, currency.significantDigits, currency.decimalPlaces);
					var formatLocaleOptions = { style: 'currency', currency: self.config.conversion, useGrouping: currency.usePriceDigitGrouping };
					if (currency.decimalPlaces !== 0) { formatLocaleOptions.minimumFractionDigits = formatLocaleOptions.maximumFractionDigits = currency.decimalPlaces; }
					price = Number(price).toLocaleString(config.language, formatLocaleOptions);
					var regex = /[A-Z]+(.+)/;
					var matches = regex.exec(price);
					cell.innerHTML = matches === null ? price : matches[1];
				} else {
					cell.innerHTML = 'N/A';	
				}
				break;
			case 'priceUSD':
				cell.classList.add('cell-' + colType);
				var price = self.conformNumber(data.quotes.USD.price, currency.significantDigits, currency.decimalPlaces);
				var formatLocaleOptions = { style: 'currency', currency: 'USD', useGrouping: currency.usePriceDigitGrouping };
				if (currency.decimalPlaces !== 0) { formatLocaleOptions.minimumFractionDigits = formatLocaleOptions.maximumFractionDigits = currency.decimalPlaces; }
				cell.innerHTML = Number(price).toLocaleString(config.language, formatLocaleOptions);
				break;
			case 'change1h':
				cell.classList.add('cell-' + colType);
				if (currency.percentChangeColored && data.quotes.USD.percent_change_1h > 0) { cell.classList.add("positive"); }
				if (currency.percentChangeColored && data.quotes.USD.percent_change_1h < 0) { cell.classList.add("negative"); }
				cell.innerHTML = Number(data.quotes.USD.percent_change_1h / 100).toLocaleString(config.language,
								{ style: 'percent', currency: self.config.conversion, maximumFractionDigits: 2 });
				break;
			case 'change24h':
				cell.classList.add('cell-' + colType);
				if (currency.percentChangeColored && data.quotes.USD.percent_change_24h > 0) { cell.classList.add("positive"); }
				if (currency.percentChangeColored && data.quotes.USD.percent_change_24h < 0) { cell.classList.add("negative"); }
				cell.innerHTML = Number(data.quotes.USD.percent_change_24h / 100).toLocaleString(config.language,
								{ style: 'percent', currency: self.config.conversion, maximumFractionDigits: 2 });
				break;
			case 'change7d':
				cell.classList.add('cell-' + colType);
				if (currency.percentChangeColored && data.quotes.USD.percent_change_7d > 0) { cell.classList.add("positive"); }
				if (currency.percentChangeColored && data.quotes.USD.percent_change_7d < 0) { cell.classList.add("negative"); }
				cell.innerHTML = Number(data.quotes.USD.percent_change_7d / 100).toLocaleString(config.language,
								{ style: 'percent', currency: self.config.conversion, maximumFractionDigits: 2 });
				break;
			case 'logo':
				cell.classList.add('cell-' + colType);
				var LocalLogoFileName = self.httpLogoFolder + data.symbol.toLowerCase() + '-' + currency.logoSizePX + '.png';
				var LocalLogoFileNameBW = self.httpLogoFolderBW + data.symbol.toLowerCase() + '-' + currency.logoSizePX + '.png';
				var LocalLogoExists = self.fileExists(LocalLogoFileName);
				var logoFileName = self.getLogoURL(currency.logoSizePX, data.id);
				var filterImageForBW = false;
				if (currency.logoColored) {
					if (LocalLogoExists) { logoFileName = LocalLogoFileName; }
				} else {
					if (self.fileExists(LocalLogoFileNameBW)) {
						logoFileName = LocalLogoFileNameBW;
					} else if(LocalLogoExists) {
						logoFileName = LocalLogoFileName;
						filterImageForBW = true;
					} else {
						filterImageForBW = true;
					}
				}
				var logo = new Image();
				logo.src = logoFileName;
				logo.classList.add('logo-' + currency.logoSize);
				if (filterImageForBW) { logo.classList.add('image-bw'); }
				cell.appendChild(logo);
				break;
			case 'graph':
				cell.classList.add('cell-' + colType);
				var graph = new Image();
				// 1d, 7d, 30d
				graph.src = 'https://s2.coinmarketcap.com/generated/sparklines/web/7d/usd/' + data.id + '.png';
				cell.appendChild(graph);
				break;
			default: cell.innerHTML = ' ';
		}
		return cell;
	},
	
	//price.toLocaleString(config.language, { style: 'currency', currency: this.config.conversion, maximumSignificantDigits: significantDigits })
	
	/**
	 * Format a number to have a specified amount of significant digits and/or a fixes amount of decimal places
	 * @param number the number to format
	 * @param significantDigits the number of digits to consider before rounding the number
	 * @param decimalPlaces the number of decimal places the formatted number should display (includes 0's)
	 * @return (string) the formatted number
	 */
	conformNumber: function(number, significantDigits, decimalPlaces) {
		var self = this;
		//Log.log(self.data.name + ': conformNumber(' + number + ', ' + significantDigits + ', ' + decimalPlaces + ')');
		if (!axis.isNumber(significantDigits) || significantDigits < 0) { significantDigits = 0; }
		if (!axis.isNumber(decimalPlaces) || decimalPlaces < 0) { decimalPlaces = 0; }
		significantDigits = Math.round(significantDigits);
		decimalPlaces = Math.round(decimalPlaces);
		var result;
		var isNegative = number < 0;
		number = Math.abs(number);
		
		if (significantDigits === 0) {
			if (decimalPlaces === 0) { result = number; }
			else { result = self.roundNumber(number, decimalPlaces).toFixed(decimalPlaces); }
		} else {
			var integerPartSize = Math.floor(number) === 0 ? 0 : Math.floor(number).toString().length;
			if (decimalPlaces === 0) {
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
		//Log.log(self.data.name + ': getLogoURL(): size = "' + size + '", id: "' + id + '".');
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
	
});
