define([
    "dojo/_base/declare",'dojo/hash','dojo/router','dojo/topic',
    'dojo/Deferred','dojo/DeferredList',
    'dojo/request/script','dojo/dom-class','dojo/_base/lang', 'dojo/date/locale',
    'dojo/dom-geometry','dojo/dom', 'dojo/query', 'dojo/on', 'dojo/dom-attr',
    'dojo/dom-construct','dojo/dom-style'], function(declare, hash, router, topic, Deferred, DeferredList, script, domClass , lang, locale, domGeometry, dom, query, on,domAttr, domConstruct, domStyle){
	return declare(null, {
        
        currentOffset   : 0, //offset value for vk requests
        postsPerRequest : 8, //count value for vk requests
        postsToShow     : 5, //how many new posts will be rendered on scroll 
        
        // has - how many posts were loaded
        // used - how many of them
        publics: {
           // 'tomsktip'      : {title: 'Томск: Бесплатные объявления', has: 0, used: 0},
            'posmotri.tomsk': {title: 'Фотодоска Томска', has: 0, used: 0},
            'desk70'        : {title: 'Еще одна группа', has: 0, used: 0},
            '70baraholka'   : {title: '70baraholka', has: 0, used: 0},
            'swetselltll'   : {title: 'Томск|Объявления| Авто|Работа|', has: 0, used: 0},
            'club49470911'  : {title: '417 человек', has: 0, used: 0},
           // 'tomsk_photodoska': {title: 'ФОтодоСкА', has: 0, used: 0},
            'sellithere'    : {title: 'Супер Барахолка', default: true, has: 0, used: 0}
        },
        currentPublic: 'swetselltll',
        selectedCssClass: 'active',
        filterSpam: true,
        
        // All posts from all publics
        posts: [],
        postsHash: [],
        // Wall, Search or New
        currentMode: 'Wall',
       
		/////////////////  PUBLIC METHOD  //////////////////////////
		///////// CAN BE CALLED DIRECTLY FROM UI ///////////////////
		
		
		/*
		 * Reload page with given public
		 */ 
        loadPublic: function(publicName){
            var self = this           
            this.updateSinglePublicPage( publicName, true )
        },
        
		/*
		 * Add content from publicName || this.currentPublic to page
		 */ 
        updateSinglePublicPage: function( publicName, doClear ){
			var doClear = doClear || false;
			var deferredRes = new Deferred, self = this;
            
			if(doClear) {
				this._clear();
				domClass.add( dom.byId('menu-'+publicName), this.selectedCssClass )
				this.currentPublic = publicName;
			}
			
            
			this.currentOffset += this.postsPerRequest + 1;
            return this['_getPostsFromWall']( this.currentMode == 'Search' ? this.currentSearchString : '').then( function( posts ){
				self.logPosts( posts );
				deferredRes.resolve('ok');
			})
			
			return deferredRes
		},
		
		/*
		 * Add content from all publics to page
		 */
        updateNewModePage: function( doClear ){
			var self = this,
				doClear = doClear || false;
			
			 
            if(doClear) {
				this._clear();
				this.currentMode = 'New';           
			}
			
			var deferredRes = new Deferred;
            this._getNextPostsFromAllWalls( ).then( function(){
				self.logPosts(self.posts);
				deferredRes.resolve('ok');
			})
			return deferredRes;
        },
        
      
        constructor: function(){
            var self = this
            
            var nav = query('.list-publics')[0]
            
           /* domAttr.set(dom.byId('search-button'),'onclick', function(){
				//self.searchPostsOnWall('Телевизор');
				//self.testTopicsRequest('Телевизор');
			})*/
            
            for(var i in this.publics){
                var link = 'http://vk.com/'+i
                
                domConstruct.create('a',{
                    href: '#wall/'+i,
                    //"data-href": i,
                    id: 'menu-' + i,
                    'class' :'teal item '+(this.publics[i].default ? self.selectedCssClass :""),
                    innerHTML : '<div>'+this.publics[i].title+'</div>'+
                        '</br><div><a color: grey;" onclick="openNewWindow(event)" href="'+link+'">vk.com/'+i+'</a></div>'
                }, nav, 'last')
                if(this.publics[i].default)
                    this.currentPublic = i
            }
            
            this._registerLoadOnScroll();
            
            var navLinks = query('a.nav');
            
            var searchLinks = query('.search');
            for(var i = 0; i<searchLinks.length; i++){
                var link = searchLinks[i];
                (function(a){
                    on(a, 'click', function(e){
                        self._clear()
                        if (e.preventDefault) {  // если метод существует
                            e.preventDefault();
                        } else { // вариант IE<9:
                            e.returnValue = false;
                        }
                       // console.log(domAttr.get(a,'data-href'))
                        self.testSearchRequest(domAttr.get(a,'data-href'))
                    })  
                })(link)
            }
            
            var checkHash = function(h){
                if ( (h.substr(0,5) != 'wall/') && (h != 'all') )
                    hash('notfound')
            }
            topic.subscribe("/dojo/hashchange", checkHash);
            
            router.register("wall/:id", function (event) {
               // console.log("Hash change", event.params.id);
                var publicName = event.params.id
                domStyle.set(dom.byId("loader"), "display", "");
                document.getElementById("show-all-posts-button").classList.remove("active");
                document.getElementById("show-all-posts-button").innerHTML='Показать все записи';
                self.loadPublic(publicName)
            });
            
            router.register("all", function (event) {
   				domStyle.set(dom.byId("loader"), "display", "");
   				document.getElementById("show-all-posts-button").classList.add("active");
   				document.getElementById("show-all-posts-button").innerHTML='Показаны все записи';
   				self.updateNewModePage( true )
            });
            
            router.register("notfound", function (event) {
                alert(':-(')
            });
            
            router.startup()
            if(!hash()) router.go('all')
            
            window.r = router
        },
        
        
        
        /////////////////  PRIVATE METHODS ////////////////////////
        //////////  NEVER CALLED DIRECTLY FROM UI /////////////////
        
        /*
         * Show next <this.postsToShow> posts in TM mode
         * or all available data in stanrard mode
         */ 
        logPosts: function(data){
            var self = this
            domStyle.set('loader','display','none')
            console.log('SHOWPOSTS', data)
            for(var i = 1, k=0; ( k < ( ( this.currentMode == 'New' ) ? this.postsToShow : data.length ) ) && ( i < data.length ); i++, k++){
                var thePost = data[i], isNewPost = true 
                if(this.filterSpam){
                    var postMd5 = md5(thePost.text)
                    for(var z = 0; z< this.postsHash.length; z++){
                    //    console.log(this.postsHash[z], postMd5, this.postsHash[z] == postMd5)
                        if(this.postsHash[z] == postMd5){
                            isNewPost = false; break
                        }
                    }
                    if(!isNewPost)
                        k--;
                }
                    
                    
                if(thePost.GROUP_NAME)
                    self.publics[thePost.GROUP_NAME].used ++
                
                if(isNewPost){    
                    this.postsHash.push(postMd5)
                    var nodeId = data[i].to_id+'_'+data[i].id
                    var originLink = '<a class="ui large black label" id= "'+nodeId+'" href="http://vk.com/'+data[i].GROUP_NAME+'?w=wall'+data[i].to_id+'_'+data[i].id+'">Посмотреть обявление в ВК</a>';
                    var userId = data[i].from_id 
                    var uinfoId = 'ulink-'+Math.random()
                    var date = new Date(data[i].date * 1000)
                    var dateString = locale.format(date, {datePattern: 'dd MMM yyyy', timePattern : 'HH:mm:ss'})
                    
                    var li = domConstruct.create('li',{
                      // innerHTML : '<p><span>'+ dateString + ' :: </span><span id="'+uinfoId+'">'+''+'</span>'+originLink+'</p>' + data[i].text,
                       innerHTML : '<div class="event" style="width: 100%" ><div class="content" style="text-align: justify"><div class="date">'+ dateString + '</div><div class="summary"><a class="ui teal label" ><span id="'+uinfoId+'"></span></a></div><div style="margin-top: 10px; color: grey">' + data[i].text+ '</div></div></div>',
                       'class' : 'ui piled feed segment'
                    }, 'posts','last');
                    
                    domConstruct.create('div', {innerHTML : '<i class="vk icon"></i>', 'class' : 'ui horizontal icon divider'}, 'posts','last');
                 
                    (function(uid, node){
                        if(uid > 0)
                            self._requestUserByUserId( uid ).then(function(data){
                                var originAuthorLink =  '<a onclick="openNewWindow(event)" id= "'+nodeId+'" href="http://vk.com/id'+uid+'">'+ data[0].first_name +' '+ data[0].last_name+'</a>'
                                domAttr.set(node, 'innerHTML', originAuthorLink)
                            })
                        else
                            self._getGroupInfo( Math.abs(uid) ).then(function(data){
                                //console.log('WALL: ',data)
                                var originAuthorLink = '<a onclick="openNewWindow(event)" id= "'+nodeId+'" href="http://vk.com/public' + Math.abs(uid) + '">'+ data[0].name+'</a>'
                                domAttr.set(node, 'innerHTML', originAuthorLink)
                            })
                    })(userId, uinfoId);
    
                    

                    var div = domConstruct.create('div', {
						'class' : 'ui small rounded images'
                    }, li, 'last')
                    if(data[i].attachments){
                        var groupId = 'gr-' + Math.random();
                        
                        for(var j=0; j < data[i].attachments.length; j++){
                            var a = data[i].attachments[j]
                            console.log(groupId)

                            if(a.type == "photo"){
								console.log(a.photo)
								var colorboxLink = domConstruct.create('a',{
									href: a.photo.src_big,
									rel: groupId,
									'class': 'gallery'
								}, div, 'last')
								var img = domConstruct.create('img',{
									src: a.photo.src
								},colorboxLink,'last')
								
								jQuery(colorboxLink).colorbox({ rel: groupId });
							}
                        }
					}
                    li.innerHTML=li.innerHTML+'</br>'+originLink;
                    
                     (function(id){
                        on(dom.byId(id), 'click', function(e){
                            openNewWindow.call(dom.byId(id), e)
                        })
                    })(nodeId); 
                }
                if(this.currentMode == "New") { 
                    data.splice(0, 1); i-- ;
                }
            }
          //  console.log(self.publics, self.posts)
        },
        
        /*
         * 	Reset counts and posts
         */ 
        _clear: function(){
            domConstruct.empty('posts')
            this.currentOffset = 0;
            this.postsHash = []
            var links = query('.list-publics a')
            for(var i in this.publics){
                this.publics[i].has = 0;
                this.publics[i].used = 0;
            }
            this.posts = []
            for(var i=0; i< links.length; i++){
                domClass.remove(links[i],this.selectedCssClass)
            }
        },
        
        
        /*
        *   Dispatch data returned from crossDomain XHR
        *   check for errors and then do anything we need
        *
        *   @response - data returned
        *   @onSuccess(response) - what should we do if everything is ok
        *   @onError(response) - ...and if wrong data returned
        *
        */
        _requestDispatcher : function(response, onSuccess, onError){
            if(response.error || !response.response){
                //error
                return onError(response);
            }else{
                //wow :-)
                return onSuccess(response);
            }
        },
        
        //ok callback
        _vkSuccessRequestDispatcher : function(response){
            return response.response
        },
        
        //error callback
        _vkErrorRequestDispatcher : function(response){
            //console.log(response)
            return response
        },
        
        
        /*
        *  Request dispatcher wrapper for VK api
        *  returns received data / error info
        */
        _vkBasicRequestDispatcher : function(response){
           return this._requestDispatcher(response, this._vkSuccessRequestDispatcher, this._vkErrorRequestDispatcher)
        },
        
        
        /*
        *   universal crossdomain data getter
        *   send get request & execute dispatcher on received data
        *   
        *   @url - where is data? :-)
        *   @requestParams - object, will be transformed into get request params
        *   @dispatcher - function that will be executed on request result
        *
        *   return Deferred object
        */
        _getData: function(url, requestParams, dispatcher){
            var self = this, deferredResult = new Deferred()
            
            script.get(url, {
                query: requestParams,
                jsonp: 'callback'
            }).then( function(data) {				
				deferredResult.resolve( dispatcher.call(self, data) )
            })
            
            return deferredResult
        },
        
        /*
         * 	The same as previous method, but
         * 		with vkBasicRequestDispatcher as dispatcher
         * 
         * SHOULD BE USED instead of _getData
         */ 
        _getDataFromVk: function(url, requestParams){
			return this._getData( url, requestParams, this._vkBasicRequestDispatcher )
		},
        
        /*
         * returns basic info about group with id == groupId
         */ 
        _getGroupInfo: function(groupId){
			var deferredResult = new Deferred()
            var requestParams = { group_id: groupId };
            var url = 'http://api.vk.com/method/groups.getById';
            this._getDataFromVk(url, requestParams).then(function(data){
                deferredResult.resolve(data)
            });
            return deferredResult
        },
        
        /*
         * Show posts from currentPublic
         * 
         */ 
        _getPostsFromWall: function(){
            var deferredResult = new Deferred(),
				group = this.currentPublic, 
				self = this, emptyDeferred;
				
            this.currentMode = 'Wall'
            
            
            //this.testTopicsRequest()           
            this._getGroupInfo(group).then( function(groupInfo){
                if(!groupInfo.error) {
					self.isWaitingForData = true;            
					return self._requestPostsByWallId( groupInfo[0].gid )
				}
				else {
					emptyDeferred = new Deferred()
					return emptyDeferred;
				}
            }).then(function(posts){
                self.isWaitingForData = false
                deferredResult.resolve( posts )
            })
            window.t = self
            //emptyDeferred.resolve({})
            return deferredResult
        },
         
        /*
         * get next <this.postsPerRequest> from all publics
         * sort them by date
         * 
         * save them into this.posts
         */ 
        _getNextPostsFromAllWalls: function(  ){
            var publics = lang.clone(this.publics)
           	
            var defArray = [], result = new Deferred;
            var self = this
			for (var i in this.publics){
                if(publics[i].has <= publics[i].used){
                    var deferredWall = new Deferred();
                    (function(def, i){
                        self._getGroupInfo(i).then( function(groupInfo){
                            if(!groupInfo.error){
								self.currentOffset = self.publics[i].used
								var grPostGetter = self._requestPostsByWallId( groupInfo[0].gid )
								grPostGetter.then(function(posts){
									for(var j = 1; j<posts.length; j++){
										posts[j].GROUP_NAME = i
										self.publics[i].has ++
										self.posts.push(posts[j])
									}
									def.resolve('ok')
								})
							}else def.resolve('error')
                        })
                        defArray.push(def)
                    })(deferredWall, i)
                }
            }
            //console.log(defArray)
            var deferredResult = new DeferredList(defArray)
            deferredResult.then(function(){
                self.posts.sort(function(a, b){
                    return a.date < b.date
                })
                self.isWaitingForData = false
                result.resolve ('ok');
                
            })
            return result
        },
        
        
        /*
         * Returns <body> height
         */ 
        _getBodyHeight: function() {
			var bodyHeight = 0
            if( typeof( window.innerWidth ) == 'number' ) {
                //Non-IE
                bodyHeight = window.innerHeight;
            } else if( document.documentElement && ( document.documentElement.clientWidth || document.documentElement.clientHeight ) ) {
                //IE 6+ in 'standards compliant mode'
                bodyHeight = document.documentElement.clientHeight;
            } else if( document.body && ( document.body.clientWidth || document.body.clientHeight ) ) {
                 //IE 4 compatible
                bodyHeight = document.body.clientHeight;
            }
            
            return bodyHeight;
		},
        /*
         * Update page when user scrolls to bottom
         * 
         */ 
        _registerLoadOnScroll: function(){
            var self = this
            var onScroll = function(){
                var scrollPosition = domGeometry.docScroll();
                var bodyRealSizes = domGeometry.getMarginBox("body");
                var bodyHeight = self._getBodyHeight();
                
                var flag = bodyRealSizes.h - scrollPosition.y - bodyHeight;
                if(flag <= 0){
					console.log(self.isWaitingForData)
                
				    if(!self.isWaitingForData){
                        if(self.currentMode != "New"){
                            self.currentOffset += self.postsPerRequest + 1;
                            // console.log('LOAD NEW DATA', self.isWaitingForData, flag);
                            //self.isWaitingForData = true;
                            self['updateSinglePublicPage']( self.currentMode == 'Search' ? self.currentSearchString : '').then(
                                function(){ 
                                    //console.log(scrollPosition.x, scrollPosition.y, domGeometry.docScroll().x, domGeometry.docScroll().y) 
                                    //window.scrollTo(scrollPosition.x, scrollPosition.y) 
                                }
                            )
                        }else{
                            console.log('NEW MODE!')
                            self.isWaitingForData = true;
                            self.updateNewModePage().then(
                                function(){ 
                                    //console.log(scrollPosition.x, scrollPosition.y, domGeometry.docScroll().x, domGeometry.docScroll().y) 
                                    //window.scrollTo(scrollPosition.x, scrollPosition.y) 
                                }
                            )
                        }
                    }
                }
            }
            
            window.onscroll =  onScroll            
            
        },
        
        
        /*
        *   request array of posts from wall with id wallId
        */
        _requestPostsByWallId: function( wallId ){
			var deferredResult = new Deferred();
            var requestParams = { count: this.postsPerRequest, offset: this.currentOffset, owner_id: -wallId };
            var url = '//api.vk.com/method/wall.get';
            this._getDataFromVk(url, requestParams).then(function(data){
                deferredResult.resolve(data);
            });
            return deferredResult;
        },
        
        /*
         * Request user summary by user id
         */ 
        _requestUserByUserId: function( userId ){
            var deferredResult = new Deferred();
            var requestParams = { user_ids:  userId};
            var url = '//api.vk.com/method/users.get';
            var dispatcher = this.vkBasicRequestDispatcher;
            this._getDataFromVk(url, requestParams).then(function(data){
                deferredResult.resolve(data);
            });
            return deferredResult;
        },
        
        
        ///////////////////////// TRASH//// ////////////////////
        ///// NOT USED NOW ///
        
         /*
         * Shows posts that have <queryString> from vk
         * Not used.
         */ 
        searchPostsInNewsfeed: function(queryString){
            var deferredResult = new Deferred();
            var self = this
            self._clear();
            
            this.currentMode = 'Search'
            this.currentSearchString = queryString
            this.getSearchResult( this.currentSearchString ).then(function(posts){
               // console.log(posts)
                self.logPosts(posts)
                self.isWaitingForData = false
                deferredResult.resolve()
            })
            return deferredResult
        },
        getSearchResult: function(query){
            var deferredResult = new Deferred();
            var requestParams = { count: this.postsPerRequest, offset: this.currentOffset, q:query };
            var url = '//api.vk.com/method/newsfeed.search';
            this._getDataFromVk(url, requestParams).then(function(data){
                deferredResult.resolve(data);
            });
            return deferredResult;
        },
        
        
       
        getTopicsByGroup: function(groupId){
            var deferredResult = new Deferred();
            var requestParams = { count: 50, offset: 0, group_is:groupId };
            var url = '//api.vk.com/method/board.getTopics';
            this._getDataFromVk(url, requestParams).then(function(data){
                deferredResult.resolve(data);
            });
            return deferredResult;
        },
                
               
        testTopicsRequest: function(){
            var deferredResult = new Deferred();
            var self = this
            this.getTopicsByGroup( this.currentPublic ).then(
                function(posts){
                  //  console.log(posts)
                    self.logPosts(posts)
                    //self.isWaitingForData = false
                    //deferredResult.resolve()
                }
            )
            return deferredResult
        }
        

        
        
	})
})


/*
 * В общем такая поломатость. Вместо selected я хочу просто сделать 
 * данную li друшим классом. Вместо list-group-item поставить 
 * list-group-item-success, чтобы выделенный паблик показывался другим цветом
 * Я также изменил в HTML разметку для этих li и в данном файле пару функций
 * (коммит). Но вот такая проблемка встала, selected при выборе паблика 
 * добавляется, но старый не удаляется. 371-я строчка так и осталась для меня загадкой)))
 * 
 * В общем вместо "selected" надо подписывать "list-group-item-success"
 * и тогда при выборе паблика строчка будет зелененькой)))
 * 
 * selectedCssClass (22стр) - то, что мы хотим вместо "selected"
 * 
 * 371 стр - выбираем все <li>, у которых есть класс .nav  (т.е весь список пабликов) :-)
 * 
 * */
