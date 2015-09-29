# BOOM API

1. run `npm install`
2. run `gulp`

# gulp watcher
any changes to files inside `/server` and `/common` are automatically watched by gulp watcher, no need to restart node server

## Dummy Data Population

Dummy data gets populated via gulp which invokes `server/populate-dummy-data.js` which reads dummy data from `server/dummy-data.json`

To populate dummy data issue gulp command

1. `gulp populate-dummy-data`

## Datbase connection ##

If you are not granted access to the main database yet then you will have have to have mongodb installed locally.

** Use MongoDB 2.6.9 **

1. Edit datasources.json
    * Remove username
	* Remove password
	* Remove dPassword
	* Change host to localhost

