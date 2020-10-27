# MMM-CoinMarketCap Change Log
All notable changes to this project will be documented in this file.
This project adheres to [Semantic Versioning](http://semver.org/).

## [2.3.0] - 2020-10-27

### Added
- Spanish translation, thanks to [memolfb](https://github.com/memolfb)!

## [2.2.1] - 2020-10-22

### Fixed
- Currency value display for some locales was removing numeric value (Issues #8 and #11)

## [2.2.0] - 2020-10-19

### Added
- Option to enable colors for graphs (for 1d and 7d graphs only)

### Fixed
- Sparkline Graphs not updating, showing a straight line (Issue #10)

## [2.1.0] - 2020-03-10

### Added
- Italian translation, thanks to [roccotocco](https://github.com/roccotocco)! (Issue #6)

## [2.0.1] - 2020-03-10

### Fixed
- README instructions for api key location

## [2.0.0] - 2020-03-10

### Changed
- Removed priceUSD view options (the new API no longer includes USD with all requests).  USD can still be used as the main conversion currency.  
- Updated README with API details
- Some CSS Updates
- lastUpdateTime initialized with new Date(0) so that it can always be used in calculations
- Conversion option no longer strictly validated (since the list keeps growing)

### Fixed
- Issue #5: Switched to the CoinMarketCap Pro API becuase the Public API is now disabled

## [1.0.1] - 2018-05-16

### Changed
- Updated Readme file
- Tweaked CSS file for minor improvements

### Fixed
- Updated IOTA logo so that it is not black on black in color mode


## [1.0.0] - 2018-05-15

Initial Release of the MMM-CoinMarketCap module
