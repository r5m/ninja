define([
    "dojo/_base/declare",
    'app/request-dispatcher'], function(declare, Dispatcher, domGeometry,dom){
	return declare(null, {
		constructor: function(){
			window.d = new Dispatcher();
			
		}
	})
})
