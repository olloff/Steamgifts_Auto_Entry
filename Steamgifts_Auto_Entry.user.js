// ==UserScript==
// @name        Steamgifts Auto Entry
// @namespace   steamgifts_autoentry
// @description Automatically enters giveaways on steamgifts.com
// @include     /https?://www.steamgifts.com//
// @version     19.1
// @grant       none
// @require     http://code.jquery.com/jquery-2.1.4.min.js
// @require     http://code.jquery.com/ui/1.11.4/jquery-ui.min.js
// @require     https://rawgit.com/notifyjs/notifyjs/master/dist/notify.js
// @require     https://raw.githubusercontent.com/julien-maurel/jQuery-Storage-API/master/jquery.storageapi.min.js
// ==/UserScript==

this.$ = this.jQuery = jQuery.noConflict(true);

jQuery.fn.center = function () {
    this.css("position","fixed");
    this.css("top", Math.max(0, (($(window).height() - $(this).outerHeight()) / 2) +
                                                $(window).scrollTop()) + "px");
    this.css("left", Math.max(0, (($(window).width() - $(this).outerWidth()) / 2) +
                                                $(window).scrollLeft()) + "px");
    return this;
}

jQuery.fn.sidebar = function () {
    this.css("position","fixed");
    this.css("width", "27%");
    this.css("top", "40px");
    this.css("left", "5px");
    this.css("z-index", "999");
    return this;
}

function isEmpty(str) {
    return (!str || 0 === str.length);
}

var gamelist=[];
var minpoints=100;
var enterwishlist=false;
var entergroup=false;
var enterfeatured=false;
var checktimer;
var sitepattern=new RegExp('https?://.*steamgifts.com');
var siteurl=sitepattern.exec(document.URL.toString());
var pointsavailable=0;
var possibleentries=[];
var timeout=1200000;
var enabled=false;
var checkanygame=false;
var maxpointspergame=999;
var minwinchance=0;
var maxtries=1;
var config={};
config.minpoints=100;
config.enterwishlist=false;
config.entergroup=false;
config.enterfeatured=false;
config.timeout=600000;
config.maxpointspergame=999;
config.minwinchance=0;
config.maxtries=2;
config.preferfirstpages=3;

var e={};
e.points='SG AutoEntry: Not Enough Points ';

{
	var s=$.localStorage;
	if(s.isSet('games')) {
		gamelist=s.get('games');
	}

	for(var i=0; i<gamelist.length; i++) {
		gamelist[i].name=gamelist[i].name.trim();
		if(typeof(gamelist[i].maxentries)=="nothing" || $.isNumeric(gamelist[i].maxentries)==false || gamelist[i].maxentries==0) {
			gamelist[i].maxentries=-1;
		}
		if(typeof(gamelist[i].entergroup)=="nothing") {
			gamelist[i].entergroup=true;
		}
	}

	if(s.isSet('minpoints')) {
		minpoints=s.get('minpoints');
		if($.isNumeric(minpoints)==false) {
			minpoints=100;
		}
	}

  if(s.isSet('maxpointspergame')) {
		maxpointspergame=s.get('maxpointspergame');
		if($.isNumeric(maxpointspergame)==false) {
			maxpointspergame=0;
		}
	}

  if(s.isSet('minwinchance')) {
		minwinchance=s.get('minwinchance');
		if($.isNumeric(minwinchance)==false) {
			minwinchance=0;
		}
	}

	if(s.isSet('enterwishlist') && s.get('enterwishlist')!="undefined") {
		enterwishlist=s.get('enterwishlist');
	}

	if(s.isSet('entergroup') && s.get('entergroup')!="undefined") {
		entergroup=s.get('entergroup');
	}

	if(s.isSet('enterfeatured') && s.get('enterfeatured')!="undefined") {
		enterfeatured=s.get('enterfeatured');
	}

}

function log(text) {
	if(window.console && console.log) {
		console.log(text);
	}
}

function actionlog(entry,action='insert') {
  switch(action) {
    case 'insert':
      $('#actionlog').append('<p style="text-decoration:none;">'+entry+'</p></br>');
      break;
    case 'delete':
      $('#actionlog').append('<p style="text-decoration:line-through;">'+entry+'</p></br>');
      break;
  }
}

function clean(frameObj){
  // remove hidden iframe and readd each time to get around Firefox memory leak - doesn't fit it
  if(frameObj.length>0) {
    frameObj.unbind('load');
    frameObj.attr('src','about:blank');
    log("SG AutoEntry: Removing hidden iframe");
    frameObj.remove();
  }
}


function checkchanges(frameObj=$('#hiddeniframe').contents()) {
  //log("SG AutoEntry: checkchanges frameObj checkchanges "+frameObj.find('.nav__right-container').length);
  log("SG AutoEntry: checkchanges $('#hiddeniframe').contents().find('.nav__points').html() "+$('#hiddeniframe').contents().find('.nav__points').html());
  var container = frameObj.find('.nav__right-container');

  if(frameObj.find('.nav__right-container').length>0) {
    //var pointregex = new RegExp("Account(?:[^>]*?)>(\\d+)<","gm");
    //var pointarr = pointregex.exec(container.html());
    var error = container.find('a[href*="/?login"]').length>0?true:false;
    if (error) {
      log("SG AutoEntry: need login");
      return false;
    } else {
      var points = container.find('.nav__points').html();
      points==null?0:points;
      var wins = container.find('a[href*="/giveaways/won"]').find('.nav__notification').html();
      wins==null?0:wins;
      var messages = container.find('a[href*="/messages"]').find('.nav__notification').html();
      messages==null?0:messages;

      updatechanges(points,wins,messages);
      /*if(pointarr!=null && pointarr.length==2) {
        points=pointarr[1];
        updatechanges(points,wins,messages);
        return points;
      }*/
      return points;
    }
  }
  return false;
}

function updatechanges(points=0,wins=0,messages=0) {
	log('SG AutoEntry: points='+points);
  $('.nav__points').html(points);
  if (wins>0){
    $('a[href*="/giveaways/won"]').append('<div class="nav__notification">'+wins+'</div>');
  } else {
    $('a[href*="/giveaways/won"]').find('.nav__notification').remove();
  }
  if (messages>0){
    $('a[href*="/messages"]').append('<div class="nav__notification">'+messages+'</div>');
  } else {
    $('a[href*="/messages"]').find('.nav__notification').remove();
  }
  return true;
}


function execEntry(frameObj,entry,action='insert',tryN=1) {
	//frameObj.unbind('load');
  //frameObj=$('hiddeniframe').contents();
  //log("SG AutoEntry: frameObj.find('.sidebar__entry-insert') "+frameObj.find('.sidebar__entry-insert').css('display'));
  //log("SG AutoEntry: frameObj.find('.sidebar__entry-delete') "+frameObj.find('.sidebar__entry-insert').css('display'));
  log('SG AutoEntry: execEntry.state '+JSON.stringify($('hiddeniframe')));

  var state=function(){
    if(frameObj.find('.sidebar .sidebar__error').length!=0 && frameObj.find('.sidebar form').length<1) {
      return 'error';
    } else if (frameObj.find('.sidebar__entry-insert').css('display')=='block'){
      return 'insert';
    } else if (frameObj.find('.sidebar__entry-delete').css('display')=='block'){
      return 'delete';
    } else {
      return 'halt';
    }
  }
  log("SG AutoEntry: execEntry.state "+state());

	if (state()!='error') {
    if (action=='insert'){
      if (state()=='insert'){
        frameObj.find('.sidebar .sidebar__entry-insert').click();
        if (state()=='delete'){
          actionlog(entry,'insert');
          log('SG AutoEntry: Entered giveaway '+entry.name);
          return true;
        }
      }
    } else if (action=='delete'){
      if (state()=='delete') {
        frameObj.find('.sidebar .sidebar__entry-delete').click();
        if (state()=='insert'){
          actionlog(entry,'delete');
          log('SG AutoEntry: Removed giveaway '+entry.name);
          return true;
        }
      }
    }
	} else if (state()=='error' && frameObj.find('.sidebar__error').html().indexOf('Not Enough Points')>=0){
    checkchanges(frameObj);
    //log('SG AutoEntry:',err.points,frameObj.location.href);
    return true;
  } else if(tryN<config.maxtries){
    log('SG AutoEntry: Something went wrong, will try again in 10s');
    setTimeout(execEntry(frameObj,entry,action,tryN+=1),10000);
  } else {
    log('SG AutoEntry: Unable to enter giveaway '+frameObj.location.href);
    return false;
  }
}

function nextEntry(entry) {
  $('.footer__outer-wrap').append('<iframe id="hiddeniframe"></iframe>');
  var frame=$('#hiddeniframe');

  /*if(frame==null || frame.length==0) {
    $('.footer__outer-wrap').append('<iframe id="hiddeniframe"></iframe>');
    //frame=$('#hiddeniframe');
  }*/
  //frame.hide();
  frame.unbind('load');
  //frameObj.load();
  $('#hiddeniframe').prop('src',siteurl+entry.url);
  //frame.load();
  log("SG AutoEntry: nextEntry src "+frame.attr('src'));

  //log("SG AutoEntry: nextEntry frame.contents().find('.sidebar form') "+frame.contents().find('.sidebar form').css('display'));
  //log("SG AutoEntry: nextEntry frame.contents() "+frame.contents().find('.sidebar').css('display'));
  log("SG AutoEntry: nextEntry stringify "+siteurl+entry.url+" "+JSON.stringify(frame.contents()));

  //log("SG AutoEntry: nextEntry "+execEntry(frame.contents(),entry,'insert',1));


  if(execEntry($('#hiddeniframe').contents(),entry,'insert',1)==true){
    log("SG AutoEntry: nextEntry true");
    clean(frame);
    return true;
  }

  log("SG AutoEntry: nextEntry false");
  clean(frame);
  return false;
}

function update(entries){
  clean($('#hiddeniframe'));

  if(entries.length>0) {
    //entriesForced=Object.values(entries).filter(el => el.force==true);
    //entries = entries.filter( function(el){ return !entriesForced.includes(el); });
		for(var ei=0; ei<entries.length; ei++) {
      if(nextEntry(entries[ei])==true){
        entries.splice(ei,1);
      }
		}
	}
  checktimer=setTimeout(update,timeout);
  log('SG AutoEntry: Update done');
  return;
}

function bgPageLoad(url) {
	return function(resp) {

		entries=$(resp).find('.giveaway__row-outer-wrap');

		if(typeof(entries)!="undefined" && typeof(entries.length)!="undefined") {
			$(entries).each(function() {
				// skip class is-faded because we've already entered them
				if($(this).find('.giveaway__row-inner-wrap').hasClass('is-faded')==false) {
					var ok=true;
					var wantenter=true;
					var contrib=$(this).find('.contributor_only');
					if(contrib.length>0) {
						if($(contrib).hasClass('green')==false) {
							ok=false;
						}
					}
					var levelok=!($(this).find('.giveaway__column--contributor-level--negative').length>0);
          var levelok=!($(this).find('.giveaway__column--contributor-level--negative').length>0);
					if(levelok==false) {
						log('SG AutoEntry: Level not high enough');
						ok=false;
					}
					var isgroup=($(this).find('.giveaway__column--group').length>0);
					if(isgroup==true) {
						log('SG AutoEntry: Group giveaway');
					}
					var isfeatured=($(this).parents('.pinned-giveaways__outer-wrap').length>0);
					//var name=$(this).find('.title').find('a[href^="/giveaway/"]').text();
					var name=$(this).find('.giveaway__heading__name').text();
          var gameidx=gamelist.map(function(el) { return el.name; }).indexOf(name);

          if(gameidx<0 && levelok==true) {
						for(var gi=0; gi<gamelist.length && gameidx<0; gi++) {
							if(RegExp(gamelist[gi].name,"i").test(name)==true) {
								log('SG AutoEntry: Matched regex '+gamelist[gi].name+' for game '+name);
								gameidx=gi;
							}
						}
						if(gameidx<0) {
							ok=false;
						}
					}


					if(ok==true && isgroup==true && gamelist[gameidx].entergroup==false) {
						wantenter=false;
						log('SG AutoEntry: Skipping entry of ignored group giveaway for '+gamelist[gameidx].name);
					}
					if(ok==false && isfeatured==true && enterfeatured==false) {
						wantenter=false;
						log('SG AutoEntry: Skipping entry of featured giveaway for '+name);
					}
					var pointsregex=new RegExp("\\((\\d+)P\\)");
					var arr=pointsregex.exec($(this).find('.giveaway__heading').html());
					var entriesregex=new RegExp("(\\d+) entr");
					// remove , from string because it's used as a thousand separator
					var earr=entriesregex.exec($(this).find('.giveaway__links a').html().replace(',',''));
          var copiesregex=new RegExp("\\((\\d+) Cop(?:y|ies)\\)");
          var carr=copiesregex.exec($(this).find('.giveaway__heading').html().replace(',',''));

					if(ok==true && earr!=null && earr.length==2) {
						if(gamelist[gameidx].maxentries!="nothing" && gamelist[gameidx].maxentries>0 && parseInt(gamelist[gameidx].maxentries)<parseInt(earr[1])) {
							ok=false;
							log('SG AutoEntry: Too many entries for '+$(this).find('a[href^="/giveaway/"]').attr('href'));
						}
					}

          if(ok==true && arr!=null && arr.length==2) {
            if((pagenum!='wishlist' || pagenum!='group') && (maxpointspergame!="nothing" && maxpointspergame>0 && parseInt(arr[1])>maxpointspergame)) {
              ok=false;
              log('SG AutoEntry: Skipping entry because its cost is too high '+gamelist[gameidx].name+' ('+parseInt(arr[1])+'P)');
            }
          }

          if(ok==true && earr!=null && earr.length==2) {
            var winchance=(carr!=null && carr.length==2)?parseInt(carr[1]):1/parseInt(earr[1])*100;
            if((pagenum!='wishlist' || pagenum!='group') && (minwinchance!="nothing" && minwinchance>0 && winchance<minwinchance)) {
              ok=false;
              log('SG AutoEntry: Skipping entry because winchance is too low '+gamelist[gameidx].name+' '+winchance+'%');
            }
          }

					if(levelok==true && wantenter==true && (ok==true || pagenum=='wishlist' || pagenum=='group')) {
						var thisurl=$(this).find('a[href^="/giveaway/"]').attr('href');
						var haveurl=false;
						for(var ei=0; ei<possibleentries.length; ei++) {
							if(possibleentries[ei].url==thisurl) {
								haveurl=true;
							}
						}
						if(haveurl==false) {
							possibleentries.length+=1;
							possibleentries[possibleentries.length-1]={};
							possibleentries[possibleentries.length-1].url=thisurl;
							possibleentries[possibleentries.length-1].name=name;
							possibleentries[possibleentries.length-1].points=arr[1];
							possibleentries[possibleentries.length-1].force=(pagenum=='wishlist' || pagenum=='group');
							possibleentries[possibleentries.length-1].isgroup=isgroup;

              //entries=$.grep(Object.keys(possibleentries), function(entry) { return possibleentries[entry].points==20; });

							log('SG AutoEntry: Adding possible '+(pagenum=='wishlist' ? 'wishlist ' : (pagenum=='group' ? 'group ' : ''))+'entry '+possibleentries[possibleentries.length-1].url+'  points='+possibleentries[possibleentries.length-1].points+'  #'+possibleentries.length);
						}
					}
				}
			});
		}

		var pointregex=new RegExp("Account(?:[^>]*?)>(\\d+)<","gm");
		var pointarr=pointregex.exec(resp);
		if(pointarr!=null && pointarr.length==2) {
			pointsavailable=pointarr[1];
		}

		if(pagenum=='wishlist') {
			if(entergroup==true) {
				startpagerequest('group');
				return;
			}
			pagenum=0;
		}

		if(pagenum=='group') {
			pagenum=0;
		}

		if(pagenum<10) {
			startpagerequest(pagenum+1);
			return;
		}

		//log('SG AutoEntry: Points Available='+pointsavailable);
		update();

	}
}



function doentry(resp,tr=1) {

	var submitted=false;
	$('#hiddeniframe').unbind('load');

	if($('#hiddeniframe').contents().find('.sidebar .sidebar__error').length==0 && $('#hiddeniframe').contents().find('.sidebar form').length>0 && $('#hiddeniframe').contents().find('.sidebar form').html().indexOf('Enter Giveaway')>=0) {
		log('SG AutoEntry: Entering giveaway '+$('#hiddeniframe').attr('src'));

    if ($('#hiddeniframe').contents().find('.sidebar__entry-insert').css('display')=='block'){
      $('#hiddeniframe').contents().find('.sidebar .sidebar__entry-insert').click();
      if ($('#hiddeniframe').contents().find('.sidebar__entry-delete').css('display')=='block'){
        actionlog($('#hiddeniframe').attr('src'));
        submitted=true;
      }
    }

    if(submitted==false && tr<maxtries) {
      log('SG AutoEntry: Something wrong, will try again in 10s');
      setTimeout(doentry(resp,tr+=tr),10000);
    }
	}

  if($('#hiddeniframe').contents().find('.nav__right-container').length>0) {
    var pointregex=new RegExp("Account(?:[^>]*?)>(\\d+)<","gm");
    var pointarr=pointregex.exec($('#hiddeniframe').contents().find('.nav__right-container').html());
    if(pointarr!=null && pointarr.length==2) {
      pointsavailable=pointarr[1];
    }
  }

  checkchanges($('#hiddeniframe').contents());

	if(submitted==true) {
		// 10 second delay to give .click() time to submit form
		setTimeout(startnextentry,10000);
	} else {
		log('SG AutoEntry: Unable to enter giveaway '+$('#hiddeniframe').attr('src')+' pointsavailable='+pointsavailable);
		startnextentry();
	}
}

function startnextentry() {

	if(possibleentries.length>0) {
		for(var ei=0; ei<possibleentries.length; ei++) {
			if((possibleentries[ei].force==true) && (pointsavailable-possibleentries[ei].points)>=minpoints) {

				// remove hidden iframe and readd each time to get around Firefox memory leak - doesn't fit it
				if($('#hiddeniframe').length>0) {
					$('#hiddeniframe').unbind('load');
					$('#hiddeniframe').attr('src','about:blank');
					log("Removing hidden iframe");
					$('#hiddeniframe').remove();
				}

				if($('#hiddeniframe').length==0) {
					$('.footer__outer-wrap').append('<iframe id="hiddeniframe"></iframe>');
				}
        checkchanges($('#hiddeniframe').contents());
				$('#hiddeniframe').hide();
				$('#hiddeniframe').load(doentry);
				$('#hiddeniframe').attr('src',siteurl+possibleentries[ei].url);

				pointsavailable-=possibleentries[ei].points;
				possibleentries.splice(ei,1);
				return;
			}
		}
		for(var ti=0; ti<gamelist.length; ti++) {
			for(var ei=0; ei<possibleentries.length; ei++) {
				var rematch=new RegExp(gamelist[ti].name,"i").test(possibleentries[ei].name);
				if((gamelist[ti].name==possibleentries[ei].name || rematch==true) && (pointsavailable-possibleentries[ei].points)>=minpoints) {

					// remove hidden iframe and readd each time to get around Firefox memory leak - doesn't fix it
					if($('#hiddeniframe').length>0) {
						$('#hiddeniframe').unbind('load');
						$('#hiddeniframe').attr('src','about:blank');
						log("Removing hidden iframe");
						$('#hiddeniframe').remove();
					}

					if($('#hiddeniframe').length==0) {
						$('.footer__outer-wrap').append('<iframe id="hiddeniframe"></iframe>');
					}
          checkchanges($('#hiddeniframe').contents());
					$('#hiddeniframe').hide();
					$('#hiddeniframe').load(doentry);
					$('#hiddeniframe').attr('src',siteurl+possibleentries[ei].url);

					pointsavailable-=possibleentries[ei].points;
					possibleentries.splice(ei,1);
					return;
				}
			}
		}
	}
	// done with this update
	// start the timer again for the next series of updates
	checktimer=setTimeout(startupdate,timeout);

	log('SG AutoEntry: Update done');

}

function startpagerequest(pagenum) {
	log('SG AutoEntry: Starting request for page '+pagenum.toString());
	var pageurl;
	if(pagenum=='wishlist' || pagenum=='group') {
		pageurl=siteurl+'/giveaways/search?type='+pagenum;
	} else {
		pageurl=siteurl+'/giveaways/search?page='+pagenum.toString()+'&status=open';
	}
	jQuery.ajax({method: "GET",
	url: pageurl,
	success: backgroundpageload(pagenum),
	error: loadfailure(pagenum)
	});
}

function backgroundpageload(pagenum) {

	return function(resp) {

		entries=$(resp).find('.giveaway__row-outer-wrap');

    checkchanges($('#hiddeniframe').contents());

		if(typeof(entries)!="undefined" && typeof(entries.length)!="undefined") {
			$(entries).each(function() {
				// skip class is-faded because we've already entered them
				if($(this).find('.giveaway__row-inner-wrap').hasClass('is-faded')==false) {
					var ok=true;
					var wantenter=true;
					var contrib=$(this).find('.contributor_only');
					if(contrib.length>0) {
						if($(contrib).hasClass('green')==false) {
							ok=false;
						}
					}
					var levelok=!($(this).find('.giveaway__column--contributor-level--negative').length>0);
          var levelok=!($(this).find('.giveaway__column--contributor-level--negative').length>0);
					if(levelok==false) {
						log('SG AutoEntry: Level not high enough');
						ok=false;
					}
					var isgroup=($(this).find('.giveaway__column--group').length>0);
					if(isgroup==true) {
						log('SG AutoEntry: Group giveaway');
					}
					var isfeatured=($(this).parents('.pinned-giveaways__outer-wrap').length>0);
					//var name=$(this).find('.title').find('a[href^="/giveaway/"]').text();
					var name=$(this).find('.giveaway__heading__name').text();
          var gameidx=gamelist.map(function(el) { return el.name; }).indexOf(name);

          if(gameidx<0 && levelok==true) {
						for(var gi=0; gi<gamelist.length && gameidx<0; gi++) {
							if(RegExp(gamelist[gi].name,"i").test(name)==true) {
								log('SG AutoEntry: Matched regex '+gamelist[gi].name+' for game '+name);
								gameidx=gi;
							}
						}
						if(gameidx<0) {
							ok=false;
						}
					}


					if(ok==true && isgroup==true && gamelist[gameidx].entergroup==false) {
						wantenter=false;
						log('SG AutoEntry: Skipping entry of ignored group giveaway for '+gamelist[gameidx].name);
					}
					if(ok==false && isfeatured==true && enterfeatured==false) {
						wantenter=false;
						log('SG AutoEntry: Skipping entry of featured giveaway for '+name);
					}
					var pointsregex=new RegExp("\\((\\d+)P\\)");
					var arr=pointsregex.exec($(this).find('.giveaway__heading').html());
					var entriesregex=new RegExp("(\\d+) entr");
					// remove , from string because it's used as a thousand separator
					var earr=entriesregex.exec($(this).find('.giveaway__links a').html().replace(',',''));
          var copiesregex=new RegExp("\\((\\d+) Cop(?:y|ies)\\)");
          var carr=copiesregex.exec($(this).find('.giveaway__heading').html().replace(',',''));

					if(ok==true && earr!=null && earr.length==2) {
						if(gamelist[gameidx].maxentries!="nothing" && gamelist[gameidx].maxentries>0 && parseInt(gamelist[gameidx].maxentries)<parseInt(earr[1])) {
							ok=false;
							log('SG AutoEntry: Too many entries for '+$(this).find('a[href^="/giveaway/"]').attr('href'));
						}
					}

          if(ok==true && arr!=null && arr.length==2) {
            if((pagenum!='wishlist' || pagenum!='group') && (maxpointspergame!="nothing" && maxpointspergame>0 && parseInt(arr[1])>maxpointspergame)) {
              ok=false;
              log('SG AutoEntry: Skipping entry because its cost is too high '+gamelist[gameidx].name+' ('+parseInt(arr[1])+'P)');
            }
          }

          if(ok==true && earr!=null && earr.length==2) {
            var winchance=(carr!=null && carr.length==2)?parseInt(carr[1]):1/parseInt(earr[1])*100;
            if((pagenum!='wishlist' || pagenum!='group') && (minwinchance!="nothing" && minwinchance>0 && winchance<minwinchance)) {
              ok=false;
              log('SG AutoEntry: Skipping entry because winchance is too low '+gamelist[gameidx].name+' '+winchance+'%');
            }
          }

					if(levelok==true && wantenter==true && (ok==true || pagenum=='wishlist' || pagenum=='group')) {
						var thisurl=$(this).find('a[href^="/giveaway/"]').attr('href');
						var haveurl=false;
						for(var ei=0; ei<possibleentries.length; ei++) {
							if(possibleentries[ei].url==thisurl) {
								haveurl=true;
							}
						}
						if(haveurl==false) {
							possibleentries.length+=1;
							possibleentries[possibleentries.length-1]={};
							possibleentries[possibleentries.length-1].url=thisurl;
							possibleentries[possibleentries.length-1].name=name;
							possibleentries[possibleentries.length-1].points=arr[1];
							possibleentries[possibleentries.length-1].force=(pagenum=='wishlist' || pagenum=='group');
							possibleentries[possibleentries.length-1].isgroup=isgroup;

              //entries=$.grep(Object.keys(possibleentries), function(entry) { return possibleentries[entry].points==20; });

							log('SG AutoEntry: Adding possible '+(pagenum=='wishlist' ? 'wishlist ' : (pagenum=='group' ? 'group ' : ''))+'entry '+possibleentries[possibleentries.length-1].url+'  points='+possibleentries[possibleentries.length-1].points+'  #'+possibleentries.length);
						}
					}
				}
			});
		}

		var pointregex=new RegExp("Account(?:[^>]*?)>(\\d+)<","gm");
		var pointarr=pointregex.exec(resp);
		if(pointarr!=null && pointarr.length==2) {
			pointsavailable=pointarr[1];
		}

		if(pagenum=='wishlist') {
			if(entergroup==true) {
				startpagerequest('group');
				return;
			}
			pagenum=0;
		}

		if(pagenum=='group') {
			pagenum=0;
		}

		if(pagenum<10) {
			startpagerequest(pagenum+1);
			return;
		}

		//log('SG AutoEntry: Points Available='+pointsavailable);
		startnextentry();
    //update(possibleentries);

	}
}

function loadfailure(pagenum) {
	return function(resp) {

		if(pagenum=='wishlist') {
			if(entergroup==true) {
				startpagerequest('group');
				return;
			}
			pagenum=0;
		}

		if(pagenum=='group') {
			pagenum=0;
		}

		if(pagenum<10) {
			startpagerequest(pagenum+1);
			return;
		}
		// done with this update
		// start the timer again for the next series of updates
		checktimer=setTimeout(startupdate,timeout);
	}
}

function startupdate() {
	pointsavailable=0;
	possibleentries=[];
	if(enterwishlist==true) {
		startpagerequest('wishlist');
	} else if(entergroup==true) {
		startpagerequest('group');
	} else {
		startpagerequest(1);
	}
}

function startautoentry(event) {
	if(typeof(checktimeout)!="undefined") {
		clearTimeout(checktimeout);
	}
	checktimer=setTimeout(startupdate,2000);
}

function stopautoentry(event) {
	clearTimeout(checktimer);
}

function getgameli(game) {
	var li=$('<li style="cursor:grab;"></li>');
	var span=$('<span class="gamename" style="display:inline-block;width:280px;text-overflow:ellipsis;margin-right:10px;"></span>');
	li.append(span);
	span.text(game.name);
	span=$('<span class="maxentries" style="display:inline-block;width:20px;margin-right:10px;"></span>');
	li.append(span);
	span.text(game.maxentries>0?game.maxentries:'∞');
	span=$('<span class="entergroup" style="display:inline-block;width:20px;margin-right:10px;"></span>');
	li.append(span);
	span.text((game.entergroup==true?'☑':'☐'));

	var removelink=$('<a style="cursor:pointer;">✕</a>');
	removelink.click(function() { $(this).parent().remove(); });
	li.append(removelink);
	return li;
}

function ifexist(context,name){
  if($(context).find('.gamename').text()==name){
    return true;
  }
}

function createsettingsdiv() {
	var outerdiv=$('<div id="autoentryouterdiv" style="position:absolute;width:380px;display:none;color:#6d7c87;font-size:11px;font-weight:bold;padding:5px 10px;"></div>');
  outerdiv.append('<div id="autoentrysettingsdiv"\
                  style="height:450px;background-color:#ffffff;border:1px solid;border-radius:4px;padding:2px;"></div>');
	outerdiv.find('#autoentrysettingsdiv').append('<h2 style="text-align:center;color:#4f565a;">Auto Entry Settings</h2>');
	outerdiv.find('#autoentrysettingsdiv').append('<h3 style="color:#4f565a;">Games</h3>\
                                                <p style="text-align:center;font-style:italic;">Reorder the list to have your most wanted games at the top</p>');
	outerdiv.find('#autoentrysettingsdiv').append('<div id="gamelist" style="height:310px;overflow-y:scroll;"></div>');
	outerdiv.find('#gamelist').append('<span style="display:inline-block;width:280px;text-overflow:ellipsis;margin-right:10px;color:#4f565a;">Game</span>');
	outerdiv.find('#gamelist').append('<span style="display:inline-block;width:20px;text-overflow:ellipsis;margin-right:10px;color:#4f565a;">Max</span>');
	outerdiv.find('#gamelist').append('<span style="display:inline-block;width:20px;text-overflow:ellipsis;margin-right:10px;color:#4f565a;">Group</span>');

  outerdiv.append('<div id="actionlog" style="height:300px;background-color:#ffffff;border:1px solid;border-radius:4px;padding:2px;display:none;"></div>');
  outerdiv.find('#actionlog').append('<h2 style="text-align:center;color:#4f565a;">Auto Entry Log</h2>');

	var ul=$('<ul id="autoentrygameul"></ul>');
	outerdiv.find('#gamelist').append(ul);

	for(var i=0; i<gamelist.length; i++) {
		ul.append(getgameli(gamelist[i]));
	}
	ul.sortable();
	ul.disableSelection();
	var addgamediv=$('<div id="addgame"><input type="text" id="addgamename" style="width:280px;margin-right:6px;padding:0px;" title="The full name of the game as it appears on steamgifts.com, or a regular expression to match the name against"><input type="text" id="addgamemaxentries" value="" style="width:20px;margin-right:6px;padding:0px;" title="Giveaways for this game will be entered as long as the number of existing entries is equal to or fewer than this.  Use -1 to always enter giveaways regardless of the number of entries."><input type="checkbox" id="addgameentergroup" style="width:20px;margin-right:18px;padding:0px;" checked="checked" title="Enter Group Giveaways for this game."></div>');

	var addgamelink=$('<a style="cursor:pointer;">+</a>');
	addgamelink.click(function() {
		var game={};
		game.name=$('#addgamename').val().trim();
		game.maxentries=$('#addgamemaxentries').val();
		game.entergroup=$('#addgameentergroup').prop("checked");

		if(game.name=='') {
			alert('You must enter a game name');
			return;
		}

		if($.isNumeric(game.maxentries)==false && isEmpty(game.maxentries)==false) {
			alert('Maximum entries must be a number or empty string');
			return;
		}

		var exists=false;
		var existingli=null;
    $('#gamelist ul li').each(function() {
      if(ifexist(this,game.name)) {
        exists=true;
        existingli=$(this);
      }
    });

		if(exists==true) {
			$(existingli).find('.maxentries').text(game.maxentries);
			$(existingli).find('.entergroup').text(game.entergroup==true ? true : false);
			alert('This game was already in the list and was replaced with your new settings');
		}
		else {
			$('#gamelist').find('ul').append(getgameli(game));
		}
		$('#addgamename').val('');
		$('#addgamemaxentries').val('');
		$('#addgameentergroup').prop('checked',false);
	});
	addgamediv.find('#autoentrysettingsdiv').append(addgamelink);
	outerdiv.find('#autoentrysettingsdiv').append(addgamediv);

	outerdiv.find('#autoentrysettingsdiv').append('<span style="padding-left:0px;">Reserved <input type="text" value="0" id="autoentryminpoints" pattern="\\d+" style="width:30px; padding:0px;" title="Giveaways will only be entered as long as your points available will remain at or above this number.  This allows you to have a spare pool of points to manually enter giveaways.">P</span><span style="padding-left:18px; padding-right:18px;">|</span>');
	outerdiv.find('#autoentrysettingsdiv').append('<span>Max cost <input type="text" value="0" id="maxpointspergame" pattern="\\d+" style="width:30px; padding:0px;" title="">P</span><span style="padding-left:18px; padding-right:18px;">|</span>');
	outerdiv.find('#autoentrysettingsdiv').append('<span style="padding-right:0px;">Winchance <input type="text" value="0" id="minwinchance" pattern="\\d+" style="width:30px; padding:0px;" title="">%</span>');
	outerdiv.find('#autoentrysettingsdiv').append('<br />');
	outerdiv.find('#autoentrysettingsdiv').append('<input type="checkbox" name="autoentryenterwishlist" id="autoentryenterwishlist" style="width:15px;vertical-align:top;">Enter any wishlist giveaways<br />');
	outerdiv.find('#autoentrysettingsdiv').append('<input type="checkbox" name="autoentryentergroup" id="autoentryentergroup" style="width:15px;vertical-align:top;">Enter group giveaways<br />');
	outerdiv.find('#autoentrysettingsdiv').append('<input type="checkbox" name="autoentryenterfeatured" id="autoentryenterfeatured" style="width:15px;vertical-align:top;" title="There are special giveaways that show up at the top of most pages on the site">Enter featured giveaways</br />');
	var center=$('<center></center>');
	outerdiv.find('#autoentrysettingsdiv').append(center);

  var logbutton=$('<span style="margin:0px 3px 0px 3px;"><button>Log</button></span>');
  center.append(logbutton);
  logbutton.click(function() {
		if ($('#actionlog').css('display')=='none'){
      $('#actionlog').css('display','block');
      $('#actionlog').slideDown();
      //$('#actionlog').slideUp();
    } else {
      $('#actionlog').slideUp();
      //$('#actionlog').css('display','none');
    }
  });

	var savebutton=$('<span style="margin:0px 3px 0px 3px;"><button>Save</button></span>');
	center.append(savebutton);
	savebutton.click(function() {
		$('#autoentryouterdiv').slideUp();
		var storage=$.localStorage;

		gamelist=[];
		$('#gamelist ul li').each(function() {
			gamelist.push({
							name:$(this).find('.gamename').text(),
							maxentries:(isEmpty($(this).find('.maxentries').text())?-1:$(this).find('.maxentries').text()),
							entergroup:($(this).find('.entergroup').text()=='Yes' ? true : false)
						});
		});

		storage.set('games',gamelist);
		if($.isNumeric($('#autoentryminpoints').val())==true) {
			minpoints=$('#autoentryminpoints').val();
			storage.set('minpoints',minpoints);
		}
    if($.isNumeric($('#maxpointspergame').val())==true) {
			maxpointspergame=$('#maxpointspergame').val();
			storage.set('maxpointspergame',maxpointspergame);
		}
    if($.isNumeric($('#minwinchance').val())==true) {
			minwinchance=$('#minwinchance').val();
			storage.set('minwinchance',minwinchance);
		}
		enterwishlist=$('#autoentryenterwishlist').prop("checked");
		storage.set('enterwishlist',enterwishlist);
		entergroup=$('#autoentryentergroup').prop("checked");
		storage.set('entergroup',entergroup);
		enterfeatured=$('#autoentryenterfeatured').prop("checked");
		storage.set('enterfeatured',enterfeatured);
	});

	var closebutton=$('<span style="margin:0px 3px 0px 3px;"><button>Close</button></span>');
	center.append(closebutton);
	closebutton.click(function() {
		$('#autoentryouterdiv').slideUp();
	});

	return outerdiv;
}

function createhelpdiv() {
  var outerdiv=$('<div id="autoentryouterdiv" style="position:absolute;"></div>');
	outerdiv.append('<div id="autoentryhelpdiv" style="position:absolute;width:740px;height:600px;background-color:#ffffff;display:none;border:1px solid;border-radius:4px;color:#6d7c87;font-size:11px;font-weight:bold;padding:5px 10px;overflow-y:scroll;"></div>');
	outerdiv.find('#autoentryhelpdiv').append('<h2 style="text-align:center;">Help</h2>');
	outerdiv.find('#autoentryhelpdiv').append('<br />');
	var innerdiv=$('<div style="line-height:1.3em;">');
	innerdiv.append('How to use the Auto Entry feature<br /><br />');
	innerdiv.append('You must be logged into steamgifts.com to use the Auto Entry feature.  All setup must be done on the Settings page under the Auto Entry menu<br /><br />');
	innerdiv.append('First add the games you want to automatically enter.  To do this you need to enter either the name of the game as it appears on steamgifts.com or a regular expression, the maximum number of entries a giveaway can have before the auto entry will skip over it, and if you want to enter group giveaways for the game.  The maximum entries is only checked when entering giveaways.  Once you are entered in a giveaway it will not remove the entry if the number of entries goes over the maximum at a later time.  You can enter -1 here to always enter giveaways for that game.<br /><br />');
	innerdiv.append('As you add games they will show up in the list.  You can drag and drop games to rearrange them.  Games at the top of the list will be entered first and therefore use up points first, so keep your most wanted games at the top of the list.<br /><br />');
	innerdiv.append('If you select enter any wishlist giveaways the games on your wishlist will be entered first, before all other entries if points are available.  This is for ANY game in your wishlist, not just those games you\'ve added to the auto entry list.  Likewise if you select enter group giveaways, the giveaways for groups you are a member of will be entered second, unless you have excluded the game from group giveaways in your auto entry list.  Only after these entries are made will entries for the games in your auto entry list be considered.<br /><br />');
	innerdiv.append('You may also choose to enter any featured giveaways that show up at the top of some pages on the site.  If you don\'t select this option, games that are featured may still be entered if they are matched in your game list, otherwise they will be skipped.<br /><br />');
	innerdiv.append('You must also enter the minimum number of points that the auto entry system will leave for you.  The auto entry system will not enter a giveaway if your points available would go below this number.  This will give you a pool of unused points so you can manually enter giveaways that you want.<br /><br />');
	innerdiv.append('After you have made any changes in the Settings page, you need to click the Save button to save those changes.<br /><br />');
	innerdiv.append('Enable the auto entry system by clicking the Disabled link under the Auto Entry menu.  When the auto entry system is running the link will change to Enabled.  Clicking it when Enabled will disable it.<br /><br />');
	innerdiv.append('When the auto entry system is enabled it will attempt to enter giveaways for games in your list every 10 minutes.  It will check for giveaways on the first 10 pages of games as listed on steamgifts.com.<br /><br />');
	innerdiv.append('Only enable the auto entry system in a single browser tab.  Once the system is enabled you should leave that browser tab alone and use another tab if you want to browse steamgifts.com.<br /><br />');
	innerdiv.append('Bitcoin Donations Appreciated : 1SGiftfrNtDfThSykhB8yDZYTJPHF59hH');
	outerdiv.find('#autoentryhelpdiv').append(innerdiv);
	var closebutton=$('<center><button>Close</button></center>');
	outerdiv.find('#autoentryhelpdiv').append(closebutton);
	closebutton.click(function() {
		$('#autoentryhelpdiv').slideUp();
	});

	return outerdiv;
}

function createbackuprestorediv() {
  var outerdiv=$('<div id="autoentryouterdiv" style="position:absolute;"></div>');
	outerdiv.append('<div id="autoentrybackuprestorediv" style="position:absolute;width:500px;height:380px;background-color:#ffffff;display:none;border:1px solid;border-radius:4px;color:#6d7c87;font-size:11px;font-weight:bold;padding:5px 10px;"></div>');
	outerdiv.find('#autoentrybackuprestorediv').append('The settings for Auto Entry are saved in your browser\'s local storage.  This might get cleared periodically by the browser or addons, or when you manually clear your browser cache.  You can manually save and restore your settings below should the need arise.<br /><br />');
	outerdiv.find('#autoentrybackuprestorediv').append('Backup Settings - <i>Copy this text and save it.  You can use this text to restore your Auto Entry settings later should they become lost or to transfer them to another computer.</i>');
	outerdiv.find('#autoentrybackuprestorediv').append('<textarea id="autoentrybackupjson" readonly style="height:100px;max-height:100px;"></textarea>');
	outerdiv.find('#autoentrybackuprestorediv').append('<br /><br />');
	outerdiv.find('#autoentrybackuprestorediv').append('Restore Settings - <i>Paste settings that you\'ve previously saved to restore them.  This will overwrite any settings you currently have.</i>');
	outerdiv.find('#autoentrybackuprestorediv').append('<textarea id="autoentryrestorejson" style="height:100px;max-height:100px;"></textarea>');
	var restorebutton=$('<center><button>Restore</button></center>');
	outerdiv.find('#autoentrybackuprestorediv').append(restorebutton);
	restorebutton.click(function() {
		if($('#autoentryrestorejson').val()=='') {
			alert('You must paste your settings first');
		}
		var settingsobj={};
		try {
			settingsobj=JSON.parse($('#autoentryrestorejson').val());
		} catch(e) {
			alert('Invalid settings to restore.  '+e.message);
			return false;
		}
		if(settingsobj==null || typeof(settingsobj)=="undefined") {
			alert('Invalid settings to restore');
			return false;
		}

		if(typeof(settingsobj.version)=="undefined" || typeof(settingsobj.gamelist)=="undefined" || typeof(settingsobj.minpoints)=="undefined") {
			alert('The settings you are trying to restore are invalid');
			return false;
		} else if(settingsobj.version==2 && (typeof(settingsobj.enterwishlist)=="undefined" || typeof(settingsobj.entergroup)=="undefined")) {
			alert('The settings you are trying to restore are invalid');
			return false;
		}

		if(settingsobj.version>=1) {
			gamelist=settingsobj.gamelist;
			minpoints=settingsobj.minpoints;
		}
		if(settingsobj.version>=2) {
			enterwishlist=settingsobj.enterwishlist;
			entergroup=settingsobj.entergroup;
		}
		if(settingsobj.version>=3) {
			enterfeatured=settingsobj.enterfeatured;
		}
    if(settingsobj.version>=4) {
			maxpointspergame=settingsobj.maxpointspergame;
			minwinchance=settingsobj.minwinchance;
		}

		$('#autoentryrestorejson').val('');
		alert('Settings restored in memory.  Save the settings to permanently store them.');
	});
	outerdiv.find('#autoentrybackuprestorediv').append('<br />');
	var closebutton=$('<center><button>Close</button></center>');
	outerdiv.find('#autoentrybackuprestorediv').append(closebutton);
	closebutton.click(function() {
		$('#autoentrybackuprestorediv').slideUp();
	});

	return outerdiv
}

$(document).ready(function() {
  var gawentry=$('.giveaway__heading__name');
  var addtolistbutton=gawentry.parent().find('.giveaway__icon').parent().append('\
  <a id="addtolistbuttoncontainer">\
    <i class="giveaway__icon fa fa-plus"></i>\
  </a>');
  //addtolistbutton.find('#addtolistbuttoncontainer').click(function() {alert('123')});

    /*onclick=\"$("#gamelist").find("ul").append(getgameli({name:"",maxentries:"",entergroup:""}));\"*/

	if($('.nav__left-container').length>0) {
		$('body').append(createsettingsdiv());
		$('body').append(createhelpdiv());
		$('body').append(createbackuprestorediv());

		// change to icon-green when enabled and icon-red when disabled
		// fa-toggle-off - fa-toggle-on


      var cont=$('nav .nav__left-container').append('\
    		<div id="autoentrybuttoncontainer" class="nav__button-container">\
    			<div class="nav__relative-dropdown is-hidden">\
    				<div class="nav__absolute-dropdown">\
    					<a class="nav__row" id="autoentryenabled" style="cursor:pointer;">\
    						<i class="icon-red fa fa-fw fa-toggle-off"></i>\
    						<div class="nav__row__summary">\
    							<p class="nav__row__summary__name">Disabled</p>\
    							<p class="nav__row__summary__description">Auto Entry currently disabled</p>\
    						</div>\
    					</a>\
    					<a class="nav__row" id="autoentrysettings" style="cursor:pointer;">\
    						<i class="icon-grey fa fa-fw fa-pencil-square-o"></i>\
    						<div class="nav__row__summary">\
    							<p class="nav__row__summary__name">Settings</p>\
    							<p class="nav__row__summary__description">Auto Entry settings</p>\
    						</div>\
    					</a>\
    					<a class="nav__row" id="autoentrybackuprestore" style="cursor:pointer;">\
    						<i class="icon-grey fa fa-fw fa-save"></i>\
    						<div class="nav__row_summary">\
    							<p class="nav__row__summary__name">Backup/Restore</p>\
    							<p class="nav__row__summary__description">Manually backup or restore settings</p>\
    						</div>\
    					</a>\
    					<a class="nav__row" id="autoentryhelp" style="cursor:pointer;">\
    						<i class="icon-grey fa fa-fw fa-question-circle"></i>\
    						<div class="nav__row_summary">\
    							<p class="nav__row__summary__name">Help</p>\
    							<p class="nav__row__summary__description">Auto Entry help</p>\
    						</div>\
    					</a>\
    				</div>\
    			</div>\
    			<span class="nav__button nav__button--is-dropdown" id="autoentrymainbutton">Auto Entry <i class="icon-red fa fa-fw fa-minus"></i></span>\
    			<div class="nav__button nav__button--is-dropdown-arrow">\
    				<i class="fa fa-angle-down"></i>\
    			</div>\
    		</div>');



		// needed for Tampermonkey - greasemonkey loads at interactive
		if(document.readyState=='complete')
		{
			cont.find('#autoentrybuttoncontainer .nav__button--is-dropdown-arrow').click(function(e){
				var t=$(this).hasClass("is-selected");
				$("nav .nav__button").removeClass("is-selected");
				$("nav .nav__relative-dropdown").addClass("is-hidden");
				if(!t) {
					$(this).addClass("is-selected").siblings(".nav__relative-dropdown").removeClass("is-hidden");
				}
				e.stopPropagation();
				}
			);
		}

		$('#autoentrymenu').click(function() {
			$(this).parent().siblings().removeClass('open');
			$(this).parent().siblings().children('.relative-dropdown').children('.absolute-dropdown').hide();
			$(this).parent().addClass('open');
			$(this).siblings('.relative-dropdown').children('.absolute-dropdown').show();
			return false;
		});
		$('#autoentryenabled, #autoentrymainbutton').click(function() {
			if(enabled==false) {
				$("#autoentryenabled i").removeClass("icon-red");
				$("#autoentryenabled i").addClass("icon-green");
				$("#autoentryenabled i").removeClass("fa-toggle-off");
				$("#autoentryenabled i").addClass("fa-toggle-on");
				$('#autoentryenabled .nav__row__summary__name').text('Enabled');
				$('#autoentryenabled .nav__row__summary__description').text('Auto Entry currently enabled');
				$('#autoentrymainbutton i').removeClass("icon-red");
				$('#autoentrymainbutton i').addClass("icon-green");
				$('#autoentrymainbutton i').removeClass("fa-minus");
				$('#autoentrymainbutton i').addClass("fa-check");
				startautoentry();
				enabled=true;
			}
			else {
				$("#autoentryenabled i").removeClass("icon-green");
				$("#autoentryenabled i").addClass("icon-red");
				$("#autoentryenabled i").removeClass("fa-toggle-on");
				$("#autoentryenabled i").addClass("fa-toggle-off");
				$('#autoentryenabled .nav__row__summary__name').text('Disabled');
				$('#autoentryenabled .nav__row__summary__description').text('Auto Entry currently disabled');
				$('#autoentrymainbutton i').removeClass("icon-green");
				$('#autoentrymainbutton i').addClass("icon-red");
				$('#autoentrymainbutton i').removeClass("fa-check");
				$('#autoentrymainbutton i').addClass("fa-minus");
				stopautoentry();
				enabled=false;
			}
			return false;
		});
		$('#autoentrysettings').click(function() {
			$("nav .nav__button").removeClass("is-selected");
			$("nav .nav__relative-dropdown").addClass("is-hidden");
			$('#autoentryouterdiv').sidebar();
			$('#autoentryouterdiv').slideDown();

			var ul=$('#autoentrygameul');
			ul.empty();
			for(var i=0; i<gamelist.length; i++) {
				ul.append(getgameli(gamelist[i]));
			}
			ul.sortable();
			ul.disableSelection();
			$('#autoentryminpoints').val(minpoints);
      $('#maxpointspergame').val(maxpointspergame);
      $('#minwinchance').val(minwinchance);
			$('#autoentryenterwishlist').prop("checked",enterwishlist);
			$('#autoentryentergroup').prop("checked",entergroup);
			$('#autoentryenterfeatured').prop("checked",enterfeatured);
			return false;
		});
		$('#autoentrybackuprestore').click(function() {
			$("nav .nav__button").removeClass("is-selected");
			$("nav .nav__relative-dropdown").addClass("is-hidden");
			$('#autoentrybackuprestorediv').sidebar();
			$('#autoentrybackuprestorediv').slideDown();
			var savedsettings={};
			savedsettings.version=4;
			savedsettings.gamelist=gamelist;
			savedsettings.minpoints=minpoints;
      savedsettings.maxpointspergame=maxpointspergame;
      savedsettings.minwinchance=minwinchance;
			savedsettings.enterwishlist=enterwishlist;
			savedsettings.entergroup=entergroup;
			savedsettings.enterfeatured=enterfeatured;
			$('#autoentrybackupjson').val(JSON.stringify(savedsettings));
			return false;
		});
		$('#autoentryhelp').click(function() {
			$("nav .nav__button").removeClass("is-selected");
			$("nav .nav__relative-dropdown").addClass("is-hidden");
			$('#autoentryhelpdiv').sidebar();
			$('#autoentryhelpdiv').slideDown();
			return false;
		});
	};

});
