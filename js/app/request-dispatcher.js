define([
    "dojo/_base/declare",
    'dojo/Deferred',
    'dojo/request/script','dojo/dom-class',
    'dojo/dom-geometry','dojo/dom', 'dojo/query', 'dojo/on', 'dojo/dom-attr',
    'dojo/dom-construct'], function(declare, Deferred, script, domClass , domGeometry, dom, query, on,domAttr, domConstruct){
	return declare(null, {
        
        currentOffset: 0, //offset value for vk requests
        postsPerRequest: 10, //count value for vk requests
        publics: {
            'tomsktip': {title: 'Томск: Бесплатные объявления'},
            'posmotri.tomsk': {title: 'Фотодоска Томска'},
            'desk70' : {title: 'Еще одна группа', default: true},
            '70baraholka': {title: '70baraholka'},
            'swetselltll': {title: 'Томск|Объявления|Авто|Работа|'},
            'club49470911': {title: '417 человек'},
            'tomsk_photodoska': {title: 'ФОтодоСкА'}
        },
        currentPublic: 'tomsktip',
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
        *  Test wrapper for VK api
        *  returns received data
        */
        vkTestRequestDispatcher : function(response){
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
        
        //example implementation of _getData
        getGroupInfo: function(groupId){
            var deferredResult = new Deferred()
            var requestParams = {group_id: groupId};
            var url = 'http://api.vk.com/method/groups.getById';
            var dispatcher = this.vkTestRequestDispatcher;
            this._getData(url, requestParams, dispatcher).then(function(data){
                deferredResult.resolve(data)
            });
            return deferredResult
        },
        
        /*
        *   get array of posts from wall with id wallId and Executes callback on them
        */
        getWallPosts: function(wallId){
            var deferredResult = new Deferred();
            var requestParams = { count: this.postsPerRequest, offset: this.currentOffset, owner_id: -wallId };
            var url = '//api.vk.com/method/wall.get';
            var dispatcher = this.vkTestRequestDispatcher;
            this._getData(url, requestParams, dispatcher).then(function(data){
                deferredResult.resolve(data);
            });
            return deferredResult;
        },
        
        getUserInfo: function(userId){
            var deferredResult = new Deferred();
            var requestParams = { user_ids:  userId};
            var url = '//api.vk.com/method/users.get';
            var dispatcher = this.vkTestRequestDispatcher;
            this._getData(url, requestParams, dispatcher).then(function(data){
                deferredResult.resolve(data);
            });
            return deferredResult;
        },
        
        getWallUserInfo: function(userId){
            var deferredResult = new Deferred();
            //console.log(userId)
            var requestParams = { group_id:  Math.abs(userId)};
            var url = '//api.vk.com/method/groups.getById';
            var dispatcher = this.vkTestRequestDispatcher;
            this._getData(url, requestParams, dispatcher).then(function(data){
                deferredResult.resolve(data);
            });
            return deferredResult;
        },
        
        getSearchResult: function(query){
            var deferredResult = new Deferred();
            var requestParams = { count: this.postsPerRequest, offset: this.currentOffset, q:query };
            var url = '//api.vk.com/method/newsfeed.search';
            var dispatcher = this.vkTestRequestDispatcher;
            this._getData(url, requestParams, dispatcher).then(function(data){
                deferredResult.resolve(data);
            });
            return deferredResult;
        },
        
        getTopicsByGroup: function(groupId){
            var deferredResult = new Deferred();
            var requestParams = { count: 50, offset: 0, group_is:groupId };
            var url = '//api.vk.com/method/board.getTopics';
            var dispatcher = this.vkTestRequestDispatcher;
            this._getData(url, requestParams, dispatcher).then(function(data){
                deferredResult.resolve(data);
            });
            return deferredResult;
        },
        
        logPosts: function(data){
            var self = this
            for(var i = 1; i < data.length; i++){
                var nodeId = data[i].to_id+'_'+data[i].id
                var originLink = '<a id= "'+nodeId+'" href="http://vk.com/'+self.currentPublic+'?w=wall'+data[i].to_id+'_'+data[i].id+'">original</a>';
                var userId = data[i].from_id 
                var uinfoId = 'ulink-'+Math.random()
                var li = domConstruct.create('li',{
                   innerHTML : '<p><span id="'+uinfoId+'">'+''+'</span>'+originLink+'</p>' + data[i].text
                }, 'posts','last');
                
                (function(uid, node){
                    if(uid > 0)
                        self.getUserInfo(uid).then(function(data){
                            var originAuthorLink = '<a onclick="openNewWindow(event)" id= "'+nodeId+'" href="http://vk.com/id'+uid+'">'+ data[0].first_name +' '+ data[0].last_name+'</a> :: '
                            domAttr.set(node, 'innerHTML', originAuthorLink)
                        })
                    else
                        self.getWallUserInfo(uid).then(function(data){
                            //console.log('WALL: ',data)
                            var originAuthorLink = '<a onclick="openNewWindow(event)" id= "'+nodeId+'" href="http://vk.com/id'+uid+'">'+ data[0].name+'</a> :: '
                            domAttr.set(node, 'innerHTML', originAuthorLink)
                        })
                })(userId, uinfoId);
                
                (function(id){
                    on(dom.byId(id), 'click', function(e){
                        openNewWindow.call(dom.byId(id), e)
                    })
                })(nodeId)
                var div = domConstruct.create('div',{
                }, li, 'last')
                if(data[i].attachments)
                for(var j=0; j<data[i].attachments.length; j++){
                    var a = data[i].attachments[j]
                    if(a.type == "photo")
                        var img = domConstruct.create('img',{
                            src: a.photo.src,
                            'class': 'post-photo'
                        },div,'last')
                }
                //console.log(data[i]);
            }
        },
        
        testWallRequest: function(){
            var deferredResult = new Deferred();
            this.currentMode = 'Wall'
            var group = this.currentPublic, self = this
            console.log(group)
            //this.testTopicsRequest()
            
            this.getGroupInfo(group).then( function(groupInfo){
                return self.getWallPosts( groupInfo[0].gid )
            }).then(function(posts){
                self.logPosts(posts)
                self.isWaitingForData = false
                deferredResult.resolve()
            })
            return deferredResult
        },
        
        testSearchRequest: function(queryString){
            var deferredResult = new Deferred();
            var self = this
            this.currentMode = 'Search'
            this.currentSearchString = queryString
            this.getSearchResult( this.currentSearchString ).then(function(posts){
                console.log(posts)
                self.logPosts(posts)
                self.isWaitingForData = false
                deferredResult.resolve()
            })
            return deferredResult
        },
        
        testTopicsRequest: function(){
            var deferredResult = new Deferred();
            var self = this
            this.getTopicsByGroup( this.currentPublic ).then(
                function(posts){
                    console.log(posts)
                    self.logPosts(posts)
                    //self.isWaitingForData = false
                    //deferredResult.resolve()
                }
            )
            return deferredResult
        },
        
        clear: function(){
            domConstruct.empty('posts')
            this.currentOffset = 0;
            var links = query('nav li')
            for(var i=0; i< links.length; i++){
                domClass.remove(links[i],'selected')
            }
        },
        registerLoadOnScroll: function(){
            var self = this
            var onScroll = function(){
                var scrollPosition = domGeometry.docScroll();
                var bodyRealSizes = domGeometry.getMarginBox("body");
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
                var flag = bodyRealSizes.h - scrollPosition.y - bodyHeight
                if(flag <= 0){
                    if(!self.isWaitingForData){
                        self.currentOffset += self.postsPerRequest + 1;
                       // console.log('LOAD NEW DATA', self.isWaitingForData, flag);
                        self.isWaitingForData = true;
                        self['test'+self.currentMode+'Request']( self.currentMode == 'Search' ? self.currentSearchString : '').then(
                            function(){ 
                                console.log(scrollPosition.x, scrollPosition.y, domGeometry.docScroll().x, domGeometry.docScroll().y) 
                                //window.scrollTo(scrollPosition.x, scrollPosition.y) 
                            }
                        )
                    }
                }
            }
            
            window.onscroll =  onScroll
            
            
        },
        
        constructor: function(){
            //do test
            //just send GET-request to VK.COM
            var self = this
            
            var nav = query('.left-column nav ul')[0]
            for(var i in this.publics){
                var link = 'http://vk.com/'+i
                
                domConstruct.create('li',{
                    "data-href": i,
                    'class' :'nav '+(this.publics[i].default ? "selected" :""),
                    innerHTML : '<div><div><span>'+this.publics[i].title+'</span>'+
                        '<span><a onclick="openNewWindow(event)" href="'+link+'">'+i+'</a></span></div></div>'
                }, nav, 'last')
                if(this.publics[i].default)
                    this.currentPublic = i
            }
            
            this.testWallRequest();
            this.registerLoadOnScroll();
            
            var navLinks = query('li.nav');
            for(var i = 0; i<navLinks.length; i++){
                var link = navLinks[i];
                (function(a){
                    on(a, 'click', function(e){
                        self.clear()
                        if (e.preventDefault) {  // если метод существует
                            e.preventDefault();
                        } else { // вариант IE<9:
                            e.returnValue = false;
                        }
                        self.currentPublic = domAttr.get(a,'data-href')
                        self.testWallRequest()
                        domClass.add(this,'selected')
                    }) 
                })(link)
            }
            
            var searchLinks = query('.search');
            for(var i = 0; i<searchLinks.length; i++){
                var link = searchLinks[i];
                (function(a){
                    on(a, 'click', function(e){
                        self.clear()
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
            
        }    
	})
})