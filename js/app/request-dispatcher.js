define([
    "dojo/_base/declare",'dojo/hash','dojo/router','dojo/topic',
    'dojo/Deferred','dojo/DeferredList',
    'dojo/request/script','dojo/dom-class','dojo/_base/lang', 'dojo/date/locale',
    'dojo/dom-geometry','dojo/dom', 'dojo/query', 'dojo/on', 'dojo/dom-attr',
    'dojo/dom-construct'], function(declare, hash, router, topic, Deferred, DeferredList, script, domClass , lang, locale, domGeometry, dom, query, on,domAttr, domConstruct){
	return declare(null, {
        
        currentOffset   : 0, //offset value for vk requests
        postsPerRequest : 8, //count value for vk requests
        postsToShow     : 5, //how many new posts will be rendered on scroll 
        publics: {
            'tomsktip'      : {title: 'Томск: Бесплатные объявления', has: 0, used: 0},
            'posmotri.tomsk': {title: 'Фотодоска Томска', has: 0, used: 0},
            'desk70'        : {title: 'Еще одна группа', has: 0, used: 0},
            '70baraholka'   : {title: '70baraholka', has: 0, used: 0},
            'swetselltll'   : {title: 'Томск|Объявления| Авто|Работа|', has: 0, used: 0},
            'club49470911'  : {title: '417 человек', has: 0, used: 0},
            'tomsk_photodoska': {title: 'ФОтодоСкА', has: 0, used: 0},
            'sellithere'    : {title: 'Супер Барахолка', default: true, has: 0, used: 0}
        },
        currentPublic: 'tomsktip',
        selectedCssClass: 'active',
        // All posts from all publics
        posts: [],
        postsHash: [],
        filterSpam: true,
        // Wall, Search or New
        currentMode: 'Wall',
       
       
        loadPublic: function(publicName){
            this.clear()
            this.currentPublic = publicName
            domClass.add( dom.byId('menu-'+this.currentPublic), this.selectedCssClass )
            console.log(dom.byId('menu-'+this.currentPublic))
            
            this.testWallRequest()
            
        },
        
        loadNewModePage: function(){
            this.showNPostsFromAllWalls()
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
        
        
        getNpostsFromAllWalls: function(){
            var defArray = []
            for (var i in this.publics){
                var publicPosts = new Deferred()
                defArray.push(publicPosts)
                
                //var requestParams = { count: this.postsPerRequest, offset: this.currentOffset, owner_id: -wallId };
                var requestParams = { count: this.postsPerRequest, offset: 0, owner_id: - ( this.publics[i].wallId) };
                var url = '//api.vk.com/method/wall.get';
                var dispatcher = this.vkTestRequestDispatcher;
                
                this._getData(url, requestParams, dispatcher).then(function(data){
                    publicPosts.resolve(data);
                });
            }
            
            var deferredResult = new DeferredList(defArray);
            
            return deferredResult;
            
        },
        
        showNPostsFromAllWalls: function(){
            this.clear()
            this.currentMode = 'New'
            var defArray = []
            var self = this
            for (var i in this.publics){
                var deferredWall = new Deferred();
                (function(def, i){
                    self.getGroupInfo(i).then( function(groupInfo){
                        
                        var grPostGetter = self.getWallPosts( groupInfo[0].gid )
                        grPostGetter.then(function(posts){
                            for(var j = 1; j<posts.length; j++){
                                posts[j].GROUP_NAME = i
                                self.publics[i].has ++
                                self.posts.push(posts[j])
                            }
                            console.log(self.posts)
                            def.resolve('ok')
                        })
                    })
                    defArray.push(def)
                })(deferredWall, i)
            }
            //console.log(defArray)
            var deferredResult = new DeferredList(defArray)
            deferredResult.then(function(){
                self.posts.sort(function(a, b){
                    return a.date < b.date
                })
                self.logPosts(self.posts)
                console.log("DONE", self.posts)
            })
        },
        
        showNextNPosts: function(){
            var publics = lang.clone(this.publics)
            var defArray = []
            var self = this
            var def = new Deferred();
            
            for (var i in this.publics){
                if(publics[i].has <= publics[i].used){
                    var deferredWall = new Deferred();
                    (function(def, i){
                        self.getGroupInfo(i).then( function(groupInfo){
                            self.currentOffset = self.publics[i].used
                            var grPostGetter = self.getWallPosts( groupInfo[0].gid )
                            grPostGetter.then(function(posts){
                                for(var j = 1; j<posts.length; j++){
                                    posts[j].GROUP_NAME = i
                                    self.publics[i].has ++
                                    self.posts.push(posts[j])
                                }
                                console.log(self.posts)
                                def.resolve('ok')
                            })
                        })
                        defArray.push(def)
                    })(deferredWall, i)
                }
            }
            
            var deferredResult = new DeferredList(defArray)
            deferredResult.then(function(){
                self.posts.sort(function(a, b){
                    return a.date < b.date
                })
                self.logPosts(self.posts)
                console.log("DONE", self.posts)
                self.isWaitingForData = false
                def.resolve()
            })
            
            return def
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
            for(var i = 1, k=0; ( k < ( ( this.currentMode == 'New' ) ? this.postsToShow : data.length ) ) && ( i < data.length ); i++, k++){
                console.log(i, k, data[i])
                var thePost = data[i], isNewPost = true 
                if(this.filterSpam){
                    var postMd5 = md5(thePost.text)
                    for(var z = 0; z< this.postsHash.length; z++){
                        console.log(this.postsHash[z], postMd5, this.postsHash[z] == postMd5)
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
                    var originLink = '<a id= "'+nodeId+'" href="http://vk.com/'+self.currentPublic+'?w=wall'+data[i].to_id+'_'+data[i].id+'">original</a>';
                    var userId = data[i].from_id 
                    var uinfoId = 'ulink-'+Math.random()
                    var date = new Date(data[i].date * 1000)
                    var dateString = locale.format(date, {datePattern: 'dd MMM yyyy', timePattern : 'HH:mm:ss'})
                    
                    var li = domConstruct.create('li',{
                       innerHTML : '<p><span>'+ dateString + ' :: </span><span id="'+uinfoId+'">'+''+'</span>'+originLink+'</p>' + data[i].text
                    }, 'posts','last');
                    
                    (function(uid, node){
                        if(uid > 0)
                            self.getUserInfo(uid).then(function(data){
                                var originAuthorLink =  '<a onclick="openNewWindow(event)" id= "'+nodeId+'" href="http://vk.com/id'+uid+'">'+ data[0].first_name +' '+ data[0].last_name+'</a> :: '
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
                }
                if(this.currentMode == "New") { 
                    data.splice(0, 1); i-- ;
                }
            }
            console.log(self.publics, self.posts)
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
                        if(self.currentMode != "New"){
                            self.currentOffset += self.postsPerRequest + 1;
                            // console.log('LOAD NEW DATA', self.isWaitingForData, flag);
                            self.isWaitingForData = true;
                            self['test'+self.currentMode+'Request']( self.currentMode == 'Search' ? self.currentSearchString : '').then(
                                function(){ 
                                    console.log(scrollPosition.x, scrollPosition.y, domGeometry.docScroll().x, domGeometry.docScroll().y) 
                                    //window.scrollTo(scrollPosition.x, scrollPosition.y) 
                                }
                            )
                        }else{
                            console.log('NEW MODE!')
                            self.isWaitingForData = true;
                            self.showNextNPosts().then(
                                function(){ 
                                    console.log(scrollPosition.x, scrollPosition.y, domGeometry.docScroll().x, domGeometry.docScroll().y) 
                                    //window.scrollTo(scrollPosition.x, scrollPosition.y) 
                                }
                            )
                        }
                    }
                }
            }
            
            window.onscroll =  onScroll
            
            
        },
        
        constructor: function(){
            //do test
            //just send GET-request to VK.COM
            var self = this
            
            var nav = query('.list-publics')[0]
            
            for(var i in this.publics){
                var link = 'http://vk.com/'+i
                
                domConstruct.create('a',{
                    href: '#wall/'+i,
                    //"data-href": i,
                    id: 'menu-' + i,
                    'class' :'nav list-group-item '+(this.publics[i].default ? self.selectedCssClass :""),
                    innerHTML : '<div><div><span>'+this.publics[i].title+'</span>'+
                        '<span><a onclick="openNewWindow(event)" href="'+link+'">'+i+'</a></span></div></div>'
                }, nav, 'last')
                if(this.publics[i].default)
                    this.currentPublic = i
            }
            
            this.registerLoadOnScroll();
            
            var navLinks = query('a.nav');
            
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
            
            var checkHash = function(h){
                if ( (h.substr(0,5) != 'wall/') && (h != 'all') )
                    hash('notfound')
            }
            topic.subscribe("/dojo/hashchange", checkHash);
            
            router.register("wall/:id", function (event) {
                console.log("Hash change", event.params.id);
                var publicName = event.params.id
                self.loadPublic(publicName)
            });
            
            router.register("all", function (event) {
                self.loadNewModePage()
            });
            
            router.register("notfound", function (event) {
                alert(':-(')
            });
            
            router.startup()
            if(!hash()) router.go('all')
            
            window.r = router
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
