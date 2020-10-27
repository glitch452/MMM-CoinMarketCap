# MMM-CoinMarketCap

This is a module for the [MagicMirror²](https://github.com/MichMich/MagicMirror/) smart mirror project.

This module displays cryptocurrency information from the [Coin Market Cap](https://coinmarketcap.com) website. 

| Status  | Version | Date       | Maintained? | Minimum MagicMirror² Version |
|:------- |:------- |:---------- |:----------- |:---------------------------- |
| Working | `2.3.0` | 2020-10-27 | Yes         |`2.2.1`                       |

### Example
![Example of MMM-CoinMarketCap](images/sample.png?raw=true "Example screenshot")

### Notable Features
1. Get data for any currency (Coins and Tokens) listed on [Coin Market Cap](https://coinmarketcap.com)
2. Automatic download of currency logos
3. Line graph of value changes over 1 day, 1 week, or 1 month
4. Simple built-in view selection with highly customizable view configuration

### Dependencies
1. The [Coin Market Cap Pro API (v1)](https://coinmarketcap.com/api/): For the currency data
    - A free API key is required, sign up on the [Coin Market Cap Developers](https://pro.coinmarketcap.com/signup/) page
2. The Coin Market Cap website: For the graphs and downloading currency logos

## Installation
To install the module, use your terminal to:
1. Navigate to your MagicMirror's modules folder. If you are using the default installation directory, use the command:<br />`cd ~/MagicMirror/modules`
2. Copy the module to your computer by executing the following command:<br />`git clone https://github.com/glitch452/MMM-CoinMarketCap.git`

## Using the module

### Api Keys

CoinMarketCap has disabled their fully public API, so this module has been updated to use their [Pro API](https://coinmarketcap.com/api/).  Unfortunately, this API requires an API key when accessing the data.  Thankfully, there is a free tier called `basic` which should be sufficient for most users.  To get your API Key, sign up on [CoinMarketCap](https://pro.coinmarketcap.com/signup/). 

The new API does track and limit usage by a credit system.  At this time, the limit for credit usage on the `basic` (Free) tier is a soft 333 per day and a hard 10,000 per month.  This module uses 1 credit on startup to download the list of available currencies.  Then, each udate request uses 1 credit per 100 currencies (rounded up to the nearest 100).  Therefore, for a list of currencies that is less than 100, in a 31 day month, the update request rate should be less than or equal to 13 updates per hour (ie. an update approximately every 4.6 minutes).  

A quick note: The updates are managed by the module instance on the front-end, so each additional instance of the module will perform its own API calls and consume credits.  If you require multiple instances of the module, they should each get their own API key, or the update rate can be adjusted accordingly.  

### MagicMirror² Configuration

To use this module, add the following configuration block to the modules array in the `config/config.js` file:
```js
var config = {
    modules: [
        ...
        {
            module: 'MMM-CoinMarketCap',
            position: "top_left",
            header: "Cryptocurrencies",
            config: {
                apiKey: 'your_api_key_here',
                currencies: ['bitcoin', 'ethereum', 'litecoin', 'ripple'],
                view: 'graphWithChanges',
                conversion: 'CAD',
                // See below for more Configuration Options
            }
        },
        ...
    ]
}
```

### Configuration Options

| Option                  | Details
|------------------------ |--------------
| `apiKey`                | **REQUIRED** - A free API key for the CoinMarketCap Pro API.  <br>Sign up for your API Key [Here](https://pro.coinmarketcap.com/signup/). <br />**Type:** `string` |
| `currencies`            | *Optional* - A list of currencies to display. Each item in the list can be either the name, symbol, or id of the currency, or an object that contains specific configuration options for the currency. See the [Coin Market Cap API](https://api.coinmarketcap.com/v2/listings/) for a list of available currencies. <br />**Type:** `array`<br />**Default:** `[ 'bitcoin', 'ethereum' ]`<br />**Array Item Types:**<br />- `number` The ID of the currency<br />- `string` The name of the currency.  (can be the full name, symbol [short name] or slug)<br />- `object` An object containing formatting options specific to the individual currency.  Either the `id` or `name` properties are required.  The available properties for the object are: `fontSize`, `fontColor`, `percentChangeColored`, `significantDigits`, `decimalPlaces`, `usePriceDigitGrouping`, `showCurrencyWithPrice`, `logoSize`, `logoColored`, `graphSize`.  See below for the details of each option.  If an option is not provided for a currency entry, it will default to the value of the option of the same name from the main options list.  
| `view`                  | *Optional* - A pre-configured view, used to display the currencies. The view option can be used with or without other configuration options. The other configuration options will override the options configured by the selected view. See the [View Examples](#view-examples) section for an example of each view. <br />**Type:** `string`<br />**Default:** `'detailed'`<br />**Options:** `'detailed'`, `'detailedSymbol'`, `'detailedWithUSD'`, `'graph'`, `'graphColored'`, `'graphWithChanges'`, `'logo'`, `'logoColored'`
| `conversion`            | *Optional* - The currency to convert the price into. [See the Full List](https://coinmarketcap.com/api/documentation/v1/#section/Standards-and-Conventions)<br />**Type:** `string`<br />**Default:** `'USD'`<br />**Options (FIAT):** `'AUD'`, `'BRL'`, `'CAD'`, `'EUR'`, `'GBP'`, ... <br />**Options (Crypto):** `'BTC'`, `'ETH'`, `'XRP'`, `'LTC'`, `'BCH'`, ...
| `columns`               | *Optional* - A list of columns to display. The columns will be displayed in the order of the items in this array. <br />**Type:** `array`<br />**Default:** `[ 'name', 'price', 'change1h', 'change24h', 'change7d' ]` (depending on `view`)<br />**Options:**<br /> - `'name'` The full name of the currency (ex: Bitcoin)<br /> - `'symbol'` The short name of the currency (ex: BTC or ETH)<br /> - `'price'` The price of the currency using the currency type specified by the conversion option<br /> - `'logo'` The image of the currency logo<br /> - `'change1h'` The percentage change of the currency value over 1 hour<br /> - `'change24h'` The percentage change of the currency value over 24 hours<br /> - `'change7d'` The percentage change of the currency value over 7 days<br /> - `'graph'` A line graph representing the changes in the currency value. The time period for the graph data can be set using the `'graphRange'` option<br /> - `'changes'` The percentage change of the currency value for all three time periods (stacked vertically)<br /> - `'priceWithChanges'` The price in the selected currency with the percentage changes below the price
| `showColumnHeaders`     | *Optional* - Show the table header row. <br />**Type:** `boolean`<br />**Default:** `true` (depending on `view`)
| `columnHeaderText`      | *Optional* - The text to be shown for the header of each column. The object is formatted as follows: `{ column_type: 'header_text' }` where the column_type can be any valid value for the `columns` option and the header_text is the text to be displayed for that column's header. For the price and priceWithChanges columns, the string `'{conversion}'` will be replaced with the value from the `conversion` option. For the graph column, the string `'{range}'` will be replaced with a short text representation of the selected `graphRange` option, and the string `'{days}'` will be replaced with the number of days selected in the `graphRange` option.<br />**Type:** `object`<br />**Default:** `{ name: 'Currency', symbol: 'Currency', price: 'Price ({conversion})', priceWithChanges: 'Price ({conversion})', logo: '', change1h: 'Hour', change24h: 'Day', change7d: 'Week', graph: 'Trend ({range})', changes: 'Changes' }`
| `showRowSeparator`      | *Optional* - Show a line to separate each currency. <br />**Type:** `boolean`<br />**Default:** `true`
| `fullWidthMode`         | *Optional* - Whether the table should fill the width of the region that it is assigned to. When true, the table width is set to `'100%'`. <br />**Type:** `boolean `<br />**Default:** `true` (depending on `view`)
| `fontSize`              | *Optional* - The main font size to use for the module text. <br />**Type:** `string`<br />**Default:** `'small'` (depending on `view`)<br />**Options:** `'x-small'`, `'small'`, `'medium'`, `'large'`, `'x-large'`
| `fontColor`             | *Optional* - The colour to use for the module text. <br />**Type:** `string`<br />**Default:** MagicMirror's default color<br />**Options:** Any valid CSS color value.  See [w3schools](https://www.w3schools.com/cssref/css_colors_legal.asp) for more info.
| `percentChangeColored`  | *Optional* - Whether the change percentages should be coloured.  When true, the negative values will be colored red and the positive values will be colored green. <br />**Type:** `boolean`<br />**Default:** `false` (depending on `view`)
| `significantDigits`     | *Optional* - The maximum number of significant digits to round the price to. (including digits after the decimal) Set to `0` to disable the filter. <br />**Type:** `integer`<br />**Default:** `0`
| `decimalPlaces`         | *Optional* - How many digits to display in the price after the decimal. <br />**Type:** `integer`<br />**Default:** `2`
| `usePriceDigitGrouping` | *Optional* - Whether the digits in the price should be grouped.  This is locale specific based on the MagicMirror language selected and the `conversion` option. (ex: $95,462 vs $95462)<br />**Type:** `boolean`<br />**Default:** `true`
| `showCurrencyWithPrice` | *Optional* - Whether the currency type should be shown after the price.  When true, the price value will be followed by the currency type selected in `conversion`. (ex: $56.25 USD)<br />**Type:** `boolean`<br />**Default:** `false` (depending on `view`)
| `logoSize`              | *Optional* - The size of image to be used in the `logo` column.<br />**Type:** `string`<br />**Default:** `'medium'`<br />**Options:** `'small'`, `'medium'`, `'large'`, `'x-large'`
| `logoColored`           | *Optional* - Whether to show a color or black and white logo image. When true, the color logo will be used. <br />**Type:** `boolean`<br />**Default:** `false` (depending on `view`)
| `cacheLogos`            | *Optional* - Whether or not to download the logo images. When true the images will be downloaded, when false, they will be referenced from Coin Market Cap. <br />**Type:** `boolean`<br />**Default:** `true`
| `graphRange`            | *Optional* - The number of days to show for the `graph` column. <br />**Type:** `number`<br />**Default:** `7`<br />**Options:** `1`, `7`, `30`
| `graphSize`             | *Optional* - The size of graph to display in the `graph` column. <br />**Type:** `string`<br />**Default:** `'medium'`<br />**Options:** `'x-small'`, `'small'`, `'medium'`, `'large'`, `'x-large'`
| `graphColored`          | *Optional* - Whether or not to use colors for the sparkline graps. When true the 1 day and 7 day graphs will be green when the currency value has increased over the period, and red when it has decreased. If false or using 30 day graphs, the standard grey color will be used.  <br />**Type:** `boolean`<br />**Default:** `false`
| `updateInterval`        | *Optional* - The number of minutes between data updates.  The minimum value is `5`. <br />**Type:** `number`<br />**Default:** `10`
| `retryDelay`            | *Optional* - If a data update request fails, this is the number of seconds to wait before trying again. <br />**Type:** `number`<br />**Default:** `10`

### View Examples

| View Name          | Example  |
|------------------- |--------- |
| `detailed`         | ![Example of the view 'detailed'](images/view_detailed.png?raw=true "detailed view")                          |
| `graph`            | ![Example of the view 'graph'](images/view_graph.png?raw=true "graph view")                                   |
| `graphColored`     | ![Example of the view 'graphColored'](images/view_graphColored.png?raw=true "graphColored view")             |
| `graphWithChanges` | ![Example of the view 'graphWithChanges'](images/view_graphWithChanges.png?raw=true "graphWithChanges view") |
| `logo`             | ![Example of the view 'logo'](images/view_logo.png?raw=true "logo view")                                     |
| `logoColored`      | ![Example of the view 'logoColored'](images/view_logoColored.png?raw=true "logoColored view")                |


### Custom Views

Here is an example of a custom view created using the following configuration options:

```js
    ...
    config: {
        currencies: [
            { decimalPlaces: 0, name: 'bitcoin', logoSize: 'large', logoColored: true, percentChangeColored: true, fontSize: 'medium', fontColor: 'yellow' },
            'ethereum',
            { name: 'Ripple', significantDigits: 0, decimalPlaces: 5 },
            'litecoin',
            'iota'
        ],
        showColumnHeaders: false,
        columns: [ 'logo', 'price', 'changes', 'graph' ],
        significantDigits: 3,
        decimalPlaces: 3,
    }
    ...
```
![Example of a custom view](images/view_custom.png?raw=true "Custom view")

### Custom Logo Images

By default, this module will download the logo image files for the requested currencies. It will save them into the `logos` folder located in the module's folder.  Some logos for popular currencies have already been provided with this module. If you would like to use your own logo for a particular currency, simply replace the `.png` file in the `logos` folder with your custom logo file. New logo files will only be downloaded if there is NOT already an existing file in the `logos` folder.  

When using black and white logo mode, this module actually loads the color logos and a CSS filter is applied to convert the image to grayscale. This looks great for most of the logos, but as you can imagine, there may be some that don't look as good as the rest. If you would prefer a better black and white logo for a particular currency, you can make your own image file and place it into the `logos\bw` folder. Note: the images from the `logos\bw` will be displayed as is, with no CSS filtering applied, so they need to be grayscale images.  

The naming convention for the logos is as follows: `{symbol}-{size}.png`. `{symbol}` represents the currency's short name, usually 3 to 5 characters, which MUST be in lower case.  `{size}` represents the size of the image in pixels.  There are 4 sizes configured in this module: 16, 32, 64, and 128.  These image files should be 16x16px, 32x32px, 64x64px, and 128x128px respectively.  Example: `btc-16.png`

## Updates
To update the module to the latest version, use your terminal to:
1. Navigate to your MMM-CoinMarketCap folder. If you are using the default installation directory, use the command:<br />`cd ~/MagicMirror/modules/MMM-CoinMarketCap`
2. Update the module by executing the following command:<br />`git pull`

If you have changed the module on your own, the update will fail. <br />To force an update (WARNING! your changes will be lost), reset the module and then update with the following commands:
```
git reset --hard
git pull
```

## Manually Choose a Version

To use an older version of this module, use your terminal to:
1. Navigate to your MMM-CoinMarketCap folder. If you are using the default installation directory, use the command:<br />`cd ~/MagicMirror/modules/MMM-CoinMarketCap`
2. Fetch all the available tags<br />`git fetch`
3. Show all the available tags<br />`git tag`
4. Checkout one of the available tags<br />`git checkout {tag_name}`<br />Example: `git checkout v1.0.0`


To switch back to the latest version, use your terminal to:
1. Navigate to your MMM-CoinMarketCap folder. If you are using the default installation directory, use the command:<br />`cd ~/MagicMirror/modules/MMM-CoinMarketCap`
2. Checkout the master branch<br />`git checkout master`

## License

### The MIT License (MIT)

Copyright © 2018 David Dearden

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the “Software”), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

**The software is provided “as is”, without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose and noninfringement. In no event shall the authors or copyright holders be liable for any claim, damages or other liability, whether in an action of contract, tort or otherwise, arising from, out of or in connection with the software or the use or other dealings in the software.**
