dojoConfig = {
	async: true,
	has: {
		"dojo-firebug": false
	},	
	baseUrl: "js/",
	locale: 'ru-ru',
	packages: [
		{ name: "dojo", location: "dojo" },
		{ name: "dijit", location: "dijit" },
		{ name: "dojox", location: "dojox" },
		{ name: "app", location: "app", main: "application" },
		{ name: "jquery", location: "jQuery", main: "jquery-2.1.1.min" }
	]
};
