/* global Module */

/**
 * Magic Mirror
 * Module: MMM-CoinMarketCap
 *
 * By David Dearden
 * MIT Licensed.
 */

/**
 * Register the module with the MagicMirror program
 */
Module.register("MMM-CoinMarketCap", {

	/**
	 * The default configuration options
	 */
	defaults: {
		apiKey: null,
		currencies: [ 1, 1027 ], // The currencies to display, in the order that they will be displayed
		columns: [ "name", "price", "change1h", "change24h", "change7d" ], // The columns to display, in the order that they will be displayed
		conversion: "USD",
		showColumnHeaders: true, // Enable / Disable the column header text.  Set to an array to enable by name
		columnHeaderText: {},
		showRowSeparator: true,
		fullWidthMode: true, // If true, the module will fill the space of the region when other modules in the region are wider
		fontSize: "small",
		fontColor: "", // https://www.w3schools.com/cssref/css_colors_legal.asp
		percentChangeColored: false,
		significantDigits: 0, // How many significant digits to round to in the price display
		decimalPlaces: 2, // How many decimal places to show
		usePriceDigitGrouping: true, // Whether to use locale specific separators for currency (1000 vs 1,000)
		showCurrencyWithPrice: false,
		logoSize: "medium", // small, medium, large, "x-large"
		logoColored: false, // if true, use the original logo, if false, use filter to make a black and white version
		cacheLogos: true, // Whether to download the logos from coinmarketcap or just access them from the site directly
		graphRange: 7, // How many days for the graph data.  Options: 1, 7, 30
		graphSize: "medium", // The graph size to display.  Options: "x-small", "small", "medium", "large", "x-large"
		graphColored: false,
		updateInterval: 10, // Minutes, minimum 5
		retryDelay: 10, // Seconds, minimum 0

		tallHeader: null,
		developerMode: false,
	},

	/**
	 * The minimum version of magic mirror that is required for this module to run. 
	 */
	requiresVersion: "2.2.1",

	/**
	 * Override the setConfig function to change some of the default configuration options (based on the user's view option) 
	 * before they are merged with the user configuration options 
	 * 
	 * @param config (object) The user specified configuration options
	 */
	setConfig: function (config) {
		var self = this;

		if (typeof config.view === "string") {
			switch (config.view) {
				case "detailedSymbol": self.defaults.columns = [ "symbol", "price", "change1h", "change24h", "change7d" ]; break;
				case "detailedWithUSD": self.defaults.columns = [ "name", "price", "change1h", "change24h", "change7d" ]; break;
				case "graph":
					self.defaults.columns = [ "logo", "price", "graph" ];
					self.defaults.showColumnHeaders = false;
					self.defaults.percentChangeColored = true;
					self.defaults.fullWidthMode = false;
					self.defaults.fontSize = "medium";
					break;
				case "graphColored":
					self.defaults.columns = [ "logo", "price", "graph" ];
					self.defaults.showColumnHeaders = false;
					self.defaults.percentChangeColored = true;
					self.defaults.fullWidthMode = false;
					self.defaults.logoColored = true;
					self.defaults.fontSize = "medium";
					self.defaults.graphColored = true;
					break;
				case "graphWithChanges":
					self.defaults.columns = [ "logo", "priceWithChanges", "graph" ];
					self.defaults.showColumnHeaders = false;
					self.defaults.percentChangeColored = true;
					self.defaults.showCurrencyWithPrice = true;
					self.defaults.fullWidthMode = false;
					break;
				case "logo":
					self.defaults.columns = [ "logo", "price" ];
					self.defaults.showColumnHeaders = false;
					self.defaults.showCurrencyWithPrice = true;
					self.defaults.fontSize = "medium";
					self.defaults.fullWidthMode = false;
					break;
				case "logoColored":
					self.defaults.columns = [ "logo", "price" ];
					self.defaults.showColumnHeaders = false;
					self.defaults.showCurrencyWithPrice = true;
					self.defaults.fontSize = "medium";
					self.defaults.logoColored = true;
					self.defaults.fullWidthMode = false;
					break;
				default:
					// for the case "detailed":
					self.defaults.columns = [ "name", "price", "change1h", "change24h", "change7d" ];
			}
		}

		self.config = Object.assign({}, self.defaults, config);
	},

	/**
	 * Override the start function.  Set some instance variables and validate the selected 
	 * configuration options before loading the rest of the module.  
	 */
	start: function() {
		var self = this;
		var i, c;
		self.instanceID = self.identifier + "_" + Math.random().toString().substring(2);
		self.sendSocketNotification("INIT", { instanceID: self.instanceID } );
		self.loaded = false;
		self.dataLoaded = false;
		self.listings = null;
		self.updateTimer = null;
		self.lastUpdateTime = new Date(0);
		self.currencyData = {};
		self.assetsBaseURL = "https://s3.coinmarketcap.com/";
		self.logosURLTemplate = self.assetsBaseURL + "static/img/coins/{size}x{size}/{id}.png";
		self.graphURLTemplate = self.assetsBaseURL + "generated/sparklines/web/{range}d/usd/{id}.png?noCache={noCache}";
		self.apiBaseURL = "https://pro-api.coinmarketcap.com/";
		self.apiVersion = "v1/";
		self.apiListingsEndpoint = "cryptocurrency/map";
		self.maxListingAttempts = 4; // How many times to try downloading the listing before giving up and displaying an error
		self.apiTickerEndpoint = "cryptocurrency/quotes/latest";
		self.maxTickerAttempts = 2; // How many times to try updating a currency before giving up
		self.allColumnTypes = [ "name", "symbol", "price", "logo", "change1h", "change24h", "change7d", "graph", "changes", "priceWithChanges" ];
		self.tallColumns = [ "graph", "changes", "priceWithChanges" ];
		self.tableHeader = null;
		self.LocalLogoFolder = self.data.path + "logos/";
		self.LocalLogoFolderBW = self.data.path + "logos/bw/";
		self.httpLogoFolder = "/" + self.name + "/logos/";
		self.httpLogoFolderBW = "/" + self.name + "/logos/bw/";
		self.validLogoSizes = [ "small", "medium", "large", "x-large" ];
		self.validFontSizes = [ "x-small", "small", "medium", "large", "x-large" ];
		self.validGraphSizes = [ "x-small", "small", "medium", "large", "x-large" ];
		self.validGraphRangeValues = [ 1, 7, 30 ];
		self.logoSizeToPX = { "small": 16, "medium": 32, "large": 64, "x-large": 128 };

		// Process and validate configuration options
		if (!axis.isString(self.config.apiKey) || self.config.apiKey.length < 1) { self.config.apiKey = self.defaults.apiKey; }
		self.apiKey = self.config.apiKey;
		self.defaults.columnHeaderText = {
			name: self.translate("CURRENCY_TITLE"),
			symbol: self.translate("CURRENCY_TITLE"),
			price: self.translate("PRICE_TITLE", { "conversion_var": "{conversion}" }),
			priceWithChanges: self.translate("PRICE_TITLE", { "conversion_var": "{conversion}" }),
			logo: "",
			change1h: self.translate("HOUR_TITLE"),
			change24h: self.translate("DAY_TITLE"),
			change7d: self.translate("WEEK_TITLE"),
			graph: self.translate("TREND_TITLE", { "range_var": "{range}", "days_var": "{days}" }),
			changes: self.translate("CHANGES_TITLE"),
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
				return ( (axis.isNumber(val) && !isNaN(val) && val > 0) || (axis.isString(val) && val.length > 0) ||
				(axis.isObject(val) && ( (axis.isNumber(val.id) && !isNaN(val.id) && val.id > 0) || (axis.isString(val.name) && val.name.length > 0) )) );
			});
		}
		if (axis.isNumber(self.config.retryDelay) && !isNaN(self.config.retryDelay) && self.config.retryDelay >= 0) { self.config.retryDelay = self.config.retryDelay * 1000; }
		else { self.config.retryDelay = self.defaults.retryDelay * 1000; }
		if (axis.isNumber(self.config.updateInterval) && !isNaN(self.config.updateInterval) && self.config.updateInterval >= 5) { self.config.updateInterval = self.config.updateInterval * 60 * 1000; }
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
		if (!axis.isString(self.config.conversion) || self.config.conversion.length < 1) { self.config.conversion = self.defaults.conversion; }
		if (!axis.isNumber(self.config.significantDigits) || isNaN(self.config.significantDigits) || self.config.significantDigits < 0) { self.config.significantDigits = self.defaults.significantDigits; }
		else { self.config.significantDigits = Math.round(self.config.significantDigits); }
		if (!axis.isNumber(self.config.decimalPlaces) || isNaN(self.config.decimalPlaces) || self.config.decimalPlaces < 0) { self.config.decimalPlaces = self.defaults.decimalPlaces; }
		else { self.config.decimalPlaces = Math.round(self.config.decimalPlaces); }
		if (!axis.isBoolean(self.config.usePriceDigitGrouping)) { self.config.usePriceDigitGrouping = self.defaults.usePriceDigitGrouping; }
		if (!self.validGraphRangeValues.includes(self.config.graphRange)) { self.config.graphRange = self.defaults.graphRange; }
		if (!self.validFontSizes.includes(self.config.fontSize)) { self.config.fontSize = self.defaults.fontSize; }
		if (!self.validGraphSizes.includes(self.config.graphSize)) { self.config.graphSize = self.defaults.graphSize; }
		if (!axis.isBoolean(self.config.graphColored)) { self.config.graphColored = self.defaults.graphColored; }
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
			if (!axis.isNumber(c.significantDigits) || isNaN(c.significantDigits) || c.significantDigits < 0) { c.significantDigits = self.config.significantDigits; }
			else { c.significantDigits = Math.round(c.significantDigits); }
			if (!axis.isNumber(c.decimalPlaces) || isNaN(c.decimalPlaces) || c.decimalPlaces < 0) { c.decimalPlaces = self.config.decimalPlaces; }
			else { c.decimalPlaces = Math.round(c.decimalPlaces); }
			if (!axis.isBoolean(c.usePriceDigitGrouping)) { c.usePriceDigitGrouping = self.config.usePriceDigitGrouping; }
			if (!self.validFontSizes.includes(c.fontSize)) { c.fontSize = self.config.fontSize; }
			if (!self.validGraphSizes.includes(c.graphSize)) { c.graphSize = self.config.graphSize; }
			if (!axis.isString(c.fontColor) || c.fontColor.length < 1) { c.fontColor = self.config.fontColor; }
			if (!axis.isBoolean(c.showCurrencyWithPrice)) { c.showCurrencyWithPrice = self.config.showCurrencyWithPrice; }
		}

		// Replace variables in the column header text
		self.config.columnHeaderText.price = self.replaceAll(self.config.columnHeaderText.price, "{conversion}", self.config.conversion);
		self.config.columnHeaderText.priceWithChanges = self.replaceAll(self.config.columnHeaderText.priceWithChanges, "{conversion}", self.config.conversion);
		var range = self.translate("ONE_WEEK");
		if (self.config.graphRange === 1) { range = self.translate("ONE_DAY"); } else if (self.config.graphRange === 30) { range = self.translate("ONE_MONTH"); }
		self.config.columnHeaderText.graph = self.replaceAll(self.config.columnHeaderText.graph, "{range}", range);
		self.config.columnHeaderText.graph = self.replaceAll(self.config.columnHeaderText.graph, "{days}", self.config.graphRange);

		self.log(("start(): self.data: " + JSON.stringify(self.data)), "dev");
		self.log(("start(): self.config: " + JSON.stringify(self.config)), "dev");

		// Start the loading process by requesting the currency listings
		if (!self.apiKey) {
			self.updateDom(0);
		} else {
			self.getListings(1);
		}
	},

	/**
	 * Override the suspend function that is called when the module instance is hidden.  
	 * This method stops the update timer.
	 */
	suspend: function() {
		var self = this;
		self.log(self.translate("SUSPENDED") + ".");
		clearInterval(self.updateTimer);
	},

	/**
	 * Override the resume function that is called when the module instance is un-hidden.  
	 * This method re-starts the update timer and calls for an update if the update interval
	 * has been passed since the module was suspended. 
	 */
	resume: function() {
		var self = this;
		self.log(self.translate("RESUMED") + ".");
		self.scheduleUpdate();
		var date = new Date();
		var threshold = new Date( self.lastUpdateTime.getTime() + self.config.updateInterval );
		if (date >= threshold) { self.getAllCurrencyDetails(1); }
	},

	/**
	 * The scheduleUpdate function starts the auto update timer.  
	 */
	scheduleUpdate: function() {
		var self = this;
		self.updateTimer = setInterval(function() { self.getAllCurrencyDetails(1); }, self.config.updateInterval);
		self.log( self.translate("UPDATE_SCHEDULED", { "minutes": (self.config.updateInterval / (1000 * 60)) }) );
	},

	/**
	 * The getListings function sends a request to the node helper to download the list of available currencies.  
	 * 
	 * @param attemptNum (number) The number of attempts to download the listings
	 */
	getListings: function(attemptNum) {
		var self = this;
		self.log(self.translate("LISTINGS_REQUESTED"));
		var url = self.apiBaseURL + self.apiVersion + self.apiListingsEndpoint;
		self.sendSocketNotification("GET_LISTINGS", {
			apiKey: self.apiKey,
			instanceID: self.instanceID,
			url: url,
			attemptNum: attemptNum,
			notification: "LISTINGS_RECEIVED",
		} );
	},

	/**
	 * The getAllCurrencyDetails function loops through the list of currencies and initiates requests to
	 * download the latest information for each currency. 
	 */
	getAllCurrencyDetails: function(attemptNum) {
		var self = this;
		if ( axis.isUndefined(attemptNum) ) { attemptNum = 1; }
		self.log(self.translate("UPDATE_STARTED"));
		self.lastUpdateTime = new Date();
		var id_list = [];
		for (var key in self.currencyData) {
			if (!self.currencyData.hasOwnProperty(key)) { continue; }
			id_list.push(key);
		}
		var id_string = id_list.join(",");
		var url = self.apiBaseURL + self.apiVersion + self.apiTickerEndpoint + "?id=" + id_string + "&convert=" + self.config.conversion;
		self.sendSocketNotification("GET_CURRENCY_DETAILS", {
			apiKey: self.apiKey,
			instanceID: self.instanceID,
			url: url,
			id: id_string,
			attemptNum: attemptNum,
			notification: "CURRENCY_DETAILS_RECEIVED",
		} );
	},

	/**
	 * The cacheLogos function sends a download request to the node helper for the logos of the configured currencies.  
	 */
	cacheLogos: function() {
		var self = this;
		if (!self.config.cacheLogos || !self.config.columns.includes("logo")) { return; }
		for (var key in self.currencyData) {
			if (!self.currencyData.hasOwnProperty(key)) { continue; }
			var symbol = self.currencyData[key].symbol.toLowerCase();
			for (var sizeKey in self.logoSizeToPX) {
				if (!self.logoSizeToPX.hasOwnProperty(sizeKey)) { continue; }
				var sizePX = self.logoSizeToPX[sizeKey];
				var imageURL = self.getLogoURL(sizePX, key);
				if (!self.fileExists(self.httpLogoFolder + symbol + "-" + sizePX + ".png")) {
					self.log(self.translate("REQUEST_LOGO_DOWNLOAD", { "filename": imageURL }));
					self.sendSocketNotification("DOWNLOAD_FILE", {
						instanceID: self.instanceID,
						url: imageURL,
						saveToFileName: self.LocalLogoFolder + symbol + "-" + sizePX + ".png",
						attemptNum: 1,
						notification: "LOGO_DOWNLOADED"
					});
				}
			}
		}
	},

	/**
	 * Override the socketNotificationReceived function to handle the notifications sent from the node helper
	 * 
	 * @param notification (string) The type of notification sent
	 * @param payload (any) The data sent with the notification
	 */
	socketNotificationReceived: function(notification, payload) {
		var self = this;

		// If there is no module ID sent with the notification
		if (!axis.isString(payload.original.instanceID)) {
			if (notification === "LOG") {
				if (payload.translate) { self.log(self.translate(payload.message, payload.translateVars), payload.logType); }
				else { self.log(payload.message, payload.logType); }
			}
			return;
		}

		// Filter out notifications for other instances
		if (payload.original.instanceID !== self.instanceID) {
			self.log(("Notification ignored for ID \"" + payload.original.instanceID + "\"."), "dev");
			return;
		}

		if (notification === "LOG") {
			if (payload.translate) { self.log(self.translate(payload.message, payload.translateVars), payload.logType); }
			else { self.log(payload.message, payload.logType); }
		} else if (notification === "LISTINGS_RECEIVED" && !self.loaded) {
			if (payload.isSuccessful && payload.data.status.error_code == 0) {
				self.log(self.translate("LISTINGS_SUCCESS", { "numberOfAttempts": payload.original.attemptNum }));
				self.listings = payload.data.data;
				self.filterCurrenciesAndSetupDataSet();
				self.loaded = true;
				self.updateDom(0);
				self.scheduleUpdate();
				self.getAllCurrencyDetails(1);
				self.cacheLogos();
				self.log(("self.config.currencies: " + JSON.stringify(self.config.currencies)), "dev");
			} else if (payload.original.attemptNum < self.maxListingAttempts) {
				self.log(self.translate("LISTINGS_FAILURE", { "retryTimeInSeconds": 8 }));
				setTimeout(function() { self.getListings(Number(payload.original.attemptNum) + 1); }, 8000);
			} else {
				if (payload.data) { self.listings = payload.data; }
				else { self.listings = payload.response.statusCode; }
				self.loaded = true;
				self.updateDom(0);
			}
		} else if (notification === "CURRENCY_DETAILS_RECEIVED") {
			if (payload.isSuccessful && payload.data.status.error_code == 0) {
				self.log(self.translate("CURRENCY_UPDATE_SUCCESS", { "id": payload.original.id, "numberOfAttempts": payload.original.attemptNum }));
				self.updateCurrencyData(payload.data.data);
				self.updateDom(0);
			} else if (payload.original.attemptNum < self.maxTickerAttempts) {
				self.log(self.translate("CURRENCY_UPDATE_FAILURE",
					{ "id": payload.original.id, "retryTimeInSeconds": (self.config.retryDelay/1000) }));
				setTimeout(function() { self.getAllCurrencyDetails(Number(payload.original.attemptNum) + 1); }, self.config.retryDelay);
			}
		} else if (notification === "LOGO_DOWNLOADED") {
			if (payload.isSuccessful) {
				self.log(self.translate("LOGO_DOWNLOAD_SUCCESS", { "filename": payload.original.saveToFileName }));
			} else {
				self.log(self.translate("LOGO_DOWNLOAD_FAILURE", { "filename": payload.original.saveToFileName }));
			}
		}
	},

	/**
	 * The filterCurrenciesAndSetupDataSet function compares the requested currency list with the downloaded listings.  
	 * It filters out requested currencies that are not on the listing and setups up an entry in the currencyData
	 * object for all the valid currencies.  
	 */
	filterCurrenciesAndSetupDataSet: function() {
		var self = this;
		var i, c, listing;
		var temp = [];
		for (i = 0; i < self.config.currencies.length; i++) {
			c = self.config.currencies[i];
			listing = self.selectListing(c.id, c.name);
			if (axis.isUndefined(listing)) {
				self.log(self.translate("INVALID_CURRENCY", { "name": c.name, "id": c.id }), "warn");
			} else {
				c.id = listing.id;
				c.name = listing.name;
				c.symbol = listing.symbol;
				c.website_slug = listing.slug;
				temp.push(c);
				self.currencyData[listing.id] = { name: listing.name, symbol: listing.symbol, data: null, loaded: false };
			}
		}
		self.config.currencies = temp;
	},

	/**
	 * The selectListing function is a helper function for filterCurrenciesAndSetupDataSet.  
	 * It searches the listing by id and name to determine whether a currency exists.  
	 * 
	 * @param id (number) The id of the currency to search for
	 * @param name (string) The symbol, name or slug of the currency to search for
	 * @return (boolean) returns true if the currency was found in the list, false otherwise
	 */
	selectListing: function(id, name) {
		var self = this;
		if (!axis.isNumber(id) || isNaN(id)) { id = null; }
		if (!axis.isString(name)) { name = null; }
		else { name = name.toLowerCase(); }
		return self.listings.find(function(listing) {
			return (listing.id === this.id ||
					listing.symbol.toLowerCase() === this.name ||
					listing.name.toLowerCase() === this.name ||
					listing.slug === this.name);
		}, { id: id, name: name });
	},

	/**
	 * The updateCurrencyData function sets the data parameter of the currencyData item with the given data set.  
	 * This function is called when new data is received from the API request.  
	 * It also sets variables to track whether data has been received.  
	 * 
	 * @param data (object) The data object received from the API
	 */
	updateCurrencyData: function(data) {
		var self = this;
		for (var key in data) {
			if (!data.hasOwnProperty(key)) { continue; }
			var id = data[key].id;
			if (!self.currencyData[id].loaded) { self.currencyData[id].loaded = true; }
			if (!self.dataLoaded) { self.dataLoaded = true; }
			self.currencyData[id].data = data[key];
		}
	},

	/**
	 * Override the notificationReceived function.  
	 * For now, there are no actions based on system or module notifications.  
	 * 
	 * @param notification (string) The type of notification sent
	 * @param payload (any) The data sent with the notification
	 * @param sender (object) The module that the notification originated from
	 */
	notificationReceived: function(notification, payload, sender) {
		if (sender) { // If the notification is coming from another module

		}
	},

	/**
	 * Override the getDom function to generate the DOM objects to be displayed for this module instance
	 */
	getDom: function() {

		// Initialize some variables
		var self = this;
		var c, i, k;
		var wrapper = document.createElement("div");
		//wrapper.classList.add("small");

		if (!self.apiKey) {
			wrapper.classList.add("loading");
			wrapper.classList.add("small");
			wrapper.innerHTML += self.translate("API_KEY_REQUIRED");
			return wrapper;
		}

		if (!self.loaded) {
			wrapper.classList.add("loading");
			wrapper.classList.add("small");
			wrapper.innerHTML += self.translate("LOADING");
			return wrapper;
		}

		if (!axis.isArray(self.listings)) {
			wrapper.classList.add("loading");
			wrapper.classList.add("small");
			wrapper.innerHTML += self.translate("API_ERROR", { "website": "CoinMarketCap.com" } );
			if (self.config.developerMode) { wrapper.innerHTML += "<br />Error: " + self.listings; }
			return wrapper;
		}

		if (!self.dataLoaded) {
			wrapper.classList.add("loading");
			wrapper.classList.add("small");
			wrapper.innerHTML += self.translate("LOADING");
			return wrapper;
		}

		var table = document.createElement("table");
		if (self.config.showRowSeparator) { table.classList.add("row-separator"); }
		if (self.config.fullWidthMode) { table.classList.add("fullSize"); }
		else { table.classList.add("minimalSize"); }
		if (self.config.tallHeader) { table.classList.add("tallHeader"); }

		if (self.tableHeader === null) { self.tableHeader = self.getTableHeader(); }
		if (self.tableHeader !== null) { table.appendChild(self.tableHeader); }

		for (k = 0; k < self.config.currencies.length; k++) {
			c = self.config.currencies[k];
			if (self.currencyData[c.id].loaded) {
				var row = document.createElement("tr");
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

	/**
	 * The getTableHeader function generates the header row of the main display table
	 * 
	 * @return (object) The DOM object containing the table header row
	 */
	getTableHeader: function() {
		var self = this;
		var output = null, i;
		if (self.config.showColumnHeaders === true || (axis.isArray(self.config.showColumnHeaders) && self.config.showColumnHeaders.length > 0) ) {
			output = document.createElement("tr");
			output.classList.add(self.config.fontSize);
			if (self.config.fontColor.length > 0) { output.style.color = self.config.fontColor; }
			for (i = 0; i < self.config.columns.length; i++) {
				var cell = document.createElement("th");
				cell.classList.add("cell-" + self.config.columns[i]);
				if (self.config.showColumnHeaders === true || (axis.isArray(self.config.showColumnHeaders) && self.config.showColumnHeaders.includes(self.config.columns[i])) ) {
					cell.innerHTML = self.config.columnHeaderText[self.config.columns[i]];
				} else {
					cell.innerHTML = " ";
				}
				output.appendChild(cell);
			}
		}
		return output;
	},

	/**
	 * The getCell function generates the content for each table cell given the currency (row) and column type
	 * 
	 * @param (string) colType the type of column to generate
	 * @param (object) currency a currency object from the self.config.currencies list
	 * @return (object) a DOM object containing the cell content
	 */
	getCell: function(colType, currency) {
		var self = this;
		var data = self.currencyData[currency.id].data;
		var cell = document.createElement("td");
		var conversion = self.config.conversion;
		switch (colType) {
			case "name": cell.classList.add("cell-" + colType); cell.innerHTML = data.name; break;
			case "symbol": cell.classList.add("cell-" + colType); cell.innerHTML = data.symbol; break;
			case "price":
				cell.classList.add("cell-" + colType);
				if (axis.isObject(data.quote[conversion]) && !axis.isNull(data.quote[conversion])) {
					var price = self.conformNumber(data.quote[conversion].price, currency.significantDigits, currency.decimalPlaces);
					var priceOptions = { style: "currency", currency: self.config.conversion, useGrouping: currency.usePriceDigitGrouping };
					priceOptions.minimumFractionDigits = priceOptions.maximumFractionDigits = currency.decimalPlaces;
					// Localize the price and remove currency label
					cell.innerHTML = Number(price).toLocaleString(config.language, priceOptions).replace(/[A-Za-z]+/g, '');
					// Language Codes (BCP 47) https://github.com/libyal/libfwnt/wiki/Language-Code-identifiers
					if (currency.showCurrencyWithPrice) { cell.innerHTML += " " + self.config.conversion; }
				} else {
					cell.innerHTML = "?";
				}
				break;
			case "change1h":
				cell.classList.add("cell-" + colType);
				if (currency.percentChangeColored && data.quote[conversion].percent_change_1h >= 0) { cell.classList.add("positive"); }
				if (currency.percentChangeColored && data.quote[conversion].percent_change_1h < 0) { cell.classList.add("negative"); }
				cell.innerHTML = Number(data.quote[conversion].percent_change_1h / 100).toLocaleString(config.language,
								{ style: "percent", currency: self.config.conversion, maximumFractionDigits: 2 });
				break;
			case "change24h":
				cell.classList.add("cell-" + colType);
				if (currency.percentChangeColored && data.quote[conversion].percent_change_24h >= 0) { cell.classList.add("positive"); }
				if (currency.percentChangeColored && data.quote[conversion].percent_change_24h < 0) { cell.classList.add("negative"); }
				cell.innerHTML = Number(data.quote[conversion].percent_change_24h / 100).toLocaleString(config.language,
								{ style: "percent", currency: self.config.conversion, maximumFractionDigits: 2 });
				break;
			case "change7d":
				cell.classList.add("cell-" + colType);
				if (currency.percentChangeColored && data.quote[conversion].percent_change_7d >= 0) { cell.classList.add("positive"); }
				if (currency.percentChangeColored && data.quote[conversion].percent_change_7d < 0) { cell.classList.add("negative"); }
				cell.innerHTML = Number(data.quote[conversion].percent_change_7d / 100).toLocaleString(config.language,
								{ style: "percent", currency: self.config.conversion, maximumFractionDigits: 2 });
				break;
			case "changes":
				cell.classList.add("cell-" + colType);
				var hour = document.createElement("div");
				var day = document.createElement("div");
				var week = document.createElement("div");
				var h = self.getCell("change1h", currency);
				var d = self.getCell("change24h", currency);
				var w = self.getCell("change7d", currency);
				hour.innerHTML = "H: " + h.innerHTML;
				day.innerHTML = "D: " + d.innerHTML;
				week.innerHTML = "W: " + w.innerHTML;
				hour.setAttribute("class", h.getAttribute("class"));
				day.setAttribute("class", d.getAttribute("class"));
				week.setAttribute("class", w.getAttribute("class"));
				cell.appendChild(hour);
				cell.appendChild(day);
				cell.appendChild(week);
				break;
			case "priceWithChanges":
				cell.classList.add("cell-" + colType);
				var pricePart = document.createElement("div");
				pricePart.classList.add("pricePart");
				pricePart.innerHTML = self.getCell("price", currency).innerHTML;
				var changesPart = document.createElement("div");
				changesPart.classList.add("changesPart");
				changesPart.innerHTML = self.getCell("changes", currency).innerHTML;
				cell.appendChild(pricePart);
				cell.appendChild(changesPart);
				break;
			case "logo":
				cell.classList.add("cell-" + colType);
				cell.classList.add("logo-" + currency.logoSize);
				var LocalLogoFileName = self.httpLogoFolder + data.symbol.toLowerCase() + "-" + currency.logoSizePX + ".png";
				var LocalLogoFileNameBW = self.httpLogoFolderBW + data.symbol.toLowerCase() + "-" + currency.logoSizePX + ".png";
				var LocalLogoExists = self.fileExists(LocalLogoFileName);
				var logoFileName = self.getLogoURL(currency.logoSizePX, data.id);
				var logo = new Image();
				if (currency.logoColored && LocalLogoExists) { logoFileName = LocalLogoFileName; }
				else if (!currency.logoColored) {
					if (self.fileExists(LocalLogoFileNameBW)) { logoFileName = LocalLogoFileNameBW; }
					else {
						logo.classList.add("image-bw");
						if (LocalLogoExists) { logoFileName = LocalLogoFileName; }
					}
				}
				logo.src = logoFileName;
				cell.appendChild(logo);
				break;
			case "graph":
				cell.classList.add("cell-" + colType);
				cell.classList.add("graph-" + currency.graphSize);
				var graph = new Image();
				var graphURL = self.graphURLTemplate;
				graphURL = self.replaceAll(graphURL, "{id}", data.id.toString());
				graphURL = self.replaceAll(graphURL, "{range}", self.config.graphRange.toString());
				graphURL = self.replaceAll(graphURL, "{noCache}", Math.random().toString());
				graph.src = graphURL;
				if (self.config.graphColored && self.config.graphRange === 1) {
					graph.classList.add(data.quote[conversion].percent_change_24h >= 0 ? 'up' : 'down');
				} else if (self.config.graphColored && self.config.graphRange === 7) {
					graph.classList.add(data.quote[conversion].percent_change_7d >= 0 ? 'up' : 'down');
				} else {
					graph.classList.add('grey');
				}
				cell.appendChild(graph);
				break;
			default: cell.innerHTML = " ";
		}
		return cell;
	},

	/**
	 * The conformNumber function formats a number to have a specified number of significant digits and/or a fixes the amount of decimal places
	 * 
	 * @param number (number) The number to format
	 * @param significantDigits (number) The number of digits to consider before rounding the number (minimum value: 1)
	 * @param decimalPlaces (number) The number of decimal places the formatted number should display (includes 0's) (minimum value: 0)
	 * @return (string) the formatted number
	 */
	conformNumber: function(number, significantDigits, decimalPlaces) {
		var self = this;
		if (!axis.isNumber(significantDigits) || isNaN(significantDigits) || significantDigits < 1) { significantDigits = 0; }
		if (!axis.isNumber(decimalPlaces) || isNaN(decimalPlaces) || decimalPlaces < 0) { decimalPlaces = -1; }
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
					var parts = number.toExponential(significantDigits).split("e");
					result = Number(self.roundNumber(parts[0], significantDigits - 1) + "e" + parts[1]);
				} else {
					result = self.roundNumber(number, significantDigits - integerPartSize);
				}
			} else {
				result = self.conformNumber( self.conformNumber(number, significantDigits, -1), 0, decimalPlaces );
			}
		}
		return isNegative ? "-" + result : result.toString();
	},

	/**
	 * The roundNumber function rounds a number to the specified number of decimal places.  
	 * Use a negative precision value to round to a position left of the decimal.  
	 * This function overcomes the floating-point rounding issues and rounds away from 0.  
	 * 
	 * @param number (number) The number to round
	 * @param precision (number) The position to round to before or after the decimal
	 * @return (number) The rounded number
	 */
	roundNumber: function(number, precision) {
		if (precision >= 0) { return Number(Math.round(number + "e" + precision) + "e-" + precision); }
		else { return Number(Math.round(number + "e-" + Math.abs(precision)) + "e" + Math.abs(precision)); }
	},

	/**
	 * The getLogoURL function gets the URL for a specified logo on the coin market cap website.
	 * 
	 * @param size (number) The size of the logo
	 * @param id (number) The ID if the currency
	 * @return (string) The URL of the logo
	 */
	getLogoURL: function(size, id) {
		var self = this;
		if (axis.isString(size)) { size = self.logoSizeToPX[size]; }
		var output = self.logosURLTemplate;
		output = self.replaceAll(output, "{size}", size.toString());
		output = self.replaceAll(output, "{id}", id.toString());
		return output;
	},

	/**
	 * The fileExists function tests if a file exists using a web URL
	 * 
	 * @param fileName (string) The URL of the file
	 * @return (boolean) Returns true if the file exists, false otherwise
	 */
	fileExists: function(fileName) {
		var request = new XMLHttpRequest();
		request.open("HEAD", fileName, false);
		request.send();
		return Number(request.status) !== 404;
	},

	/**
	 * The replaceAll function replaces all occurrences of a string within the given string. 
	 * 
	 * @param str (string) The string to search within
	 * @param find (string) The string to find within str
	 * @param replace (string) The string to use as a replacement for the find string
	 * @return (string) A copy of str with all the find occurrences replaced with replace
	 */
	replaceAll: function(str, find, replace) {
		var output = "";
		var idx = str.indexOf(find);
		while (idx >= 0) {
			output += str.substr(0, idx) + replace;
			str = str.substring(idx + find.length);
			idx = str.indexOf(find);
		}
		output += str;
		return output;
	},

	/**
	 * Override the getScripts function to load additional scripts used by this module. 
	 */
	getScripts: function() {
		var scripts = [];
		if (typeof axis !== "object") { scripts.push(this.file("scripts/axis.js")); }
		return scripts;
	},


	/**
	 * Override the getStyles function to load CSS files used by this module. 
	 */
	getStyles: function () {
		return [
			"MMM-CoinMarketCap.css",
		];
	},


	/**
	 * Override the getTranslations function to load translation files specific to this module. 
	 */
	getTranslations: function() {
		return {
			en: "translations/en.json",
			it: "translations/it.json",
			es: "translations/es.json",
		};
	},

	/**
	 * The log function is a convenience alias that sends a message to the console.  
	 * This is an alias for the MagicMirror Log functions with a developer mode feature added.  
	 * This function prepends the module name to the message.  
	 * 
	 * @param message (string) The message to be sent to the console
	 * @param type (string) The type of message (dev, error, info, log)
	 */
	log: function(message, type) {
		var self = this;
		if (self.config.developerMode) {
			var date = new Date();
			var time = date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds();
			message = self.name + ": (" + self.data.index + ")(" + time + ") " + message;
		} else { message = self.name + ": " + message; }
		switch (type) {
			case "error": Log.error(message); break;
			case "warn": Log.warn(message); break;
			case "info": Log.info(message); break;
			case "dev": if (self.config.developerMode) { Log.log(message); } break;
			default: Log.log(message);
		}
	}

});
