var nova_initia_pref_sys_prefManager = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
//var nova_initia_user_menu_popup = window.parent.document.getElementById("menu_nova_initia_tools_menu_user_submenupopup");
var nova_initia_ww = Components.classes["@mozilla.org/embedcomp/window-watcher;1"].getService(Components.interfaces.nsIWindowWatcher);
var nova_initia_se = nova_initia_ww.getWindowEnumerator();

var myNova_initiaPref_Sys = new nova_initia_pref_sys();

function nova_initia_pref_sys()
{
	var notification_timeout = "";

	/*
	this.update_hotkeys = function()
	{
		var trapHotkey = "";
		var trapPref = document.getElementById('nova_initia_prefs_hotkey_trap_textbox');
		var barrelHotkey = "";
		var barrelPref = document.getElementById('nova_initia_prefs_hotkey_barrel_textbox');
		var signpostHotkey = "";
		var signpostPref = document.getElementById('nova_initia_prefs_hotkey_signpost_textbox');
		var doorwayHotkey = "";
		var doorwayPref = document.getElementById('nova_initia_prefs_hotkey_doorway_textbox');
		var spiderHotkey = "";
		var spiderPref = document.getElementById('nova_initia_prefs_hotkey_spider_textbox');
		var shieldHotkey = "";
		var shieldPref = document.getElementById('nova_initia_prefs_hotkey_shield_textbox');
		
		var tmpNova_initia_se = nova_initia_ww.getWindowEnumerator();
		while(tmpNova_initia_se.hasMoreElements())
		{
			var tmpSE = tmpNova_initia_se.getNext().QueryInterface(Components.interfaces.nsIDOMWindow);
			if(tmpSE.document.getElementById('nova_initia_tool_trap'))
			{
				trapHotkey = tmpSE.document.getElementById('nova_initia_tool_trap');
				trapHotkey.accessKey = trapPref.value;
				nova_initia_pref_sys_prefManager.setCharPref("extensions.nova-initia.hotkey_trap",trapPref.value);
			}
			if(tmpSE.document.getElementById('nova_initia_tool_barrel'))
			{
				barrelHotkey = tmpSE.document.getElementById('nova_initia_tool_barrel');
				barrelHotkey.accesskey = barrelPref.value;
				nova_initia_pref_sys_prefManager.setCharPref("extensions.nova-initia.hotkey_barrel",barrelPref.value);
			}
			if(tmpSE.document.getElementById('nova_initia_tool_signpost'))
			{
				signpostHotkey = tmpSE.document.getElementById('nova_initia_tool_signpost');
				signpostHotkey.accesskey = signpostPref.value;
				nova_initia_pref_sys_prefManager.setCharPref("extensions.nova-initia.hotkey_signpost",signpostPref.value);
			}
			if(tmpSE.document.getElementById('nova_initia_tool_doorway'))
			{
				doorwayHotkey = tmpSE.document.getElementById('nova_initia_tool_doorway');
				doorwayHotkey.accesskey = doorwayPref.value;
				nova_initia_pref_sys_prefManager.setCharPref("extensions.nova-initia.hotkey_doorway",doorwayPref.value);
			}
			if(tmpSE.document.getElementById('nova_initia_tool_spider'))
			{
				spiderHotkey = tmpSE.document.getElementById('nova_initia_tool_spider');
				spiderHotkey.accesskey = spiderPref.value;
				nova_initia_pref_sys_prefManager.setCharPref("extensions.nova-initia.hotkey_spider",spiderPref.value);
			}
			if(tmpSE.document.getElementById('nova_initia_tool_shield'))
			{
				shieldHotkey = tmpSE.document.getElementById('nova_initia_tool_shield');
				shieldHotkey.accesskey = shieldPref.value;
				nova_initia_pref_sys_prefManager.setCharPref("extensions.nova-initia.hotkey_shield",shieldPref.value);
			}
		}
	}

	this.load_hotkeys = function()
	{
		var trapPref = document.getElementById('nova_initia_prefs_hotkey_trap_textbox');
		trapPref.value = nova_initia_pref_sys_prefManager.getCharPref("extensions.nova-initia.hotkey_trap");
		
		var barrelPref = document.getElementById('nova_initia_prefs_hotkey_barrel_textbox');
		barrelPref.value = nova_initia_pref_sys_prefManager.getCharPref("extensions.nova-initia.hotkey_barrel");

		var signpostPref = document.getElementById('nova_initia_prefs_hotkey_signpost_textbox');
		signpostPref.value = nova_initia_pref_sys_prefManager.getCharPref("extensions.nova-initia.hotkey_signpost");

		var doorwayPref = document.getElementById('nova_initia_prefs_hotkey_doorway_textbox');
		doorwayPref.value = nova_initia_pref_sys_prefManager.getCharPref("extensions.nova-initia.hotkey_doorway");

		var spiderPref = document.getElementById('nova_initia_prefs_hotkey_spider_textbox');
		spiderPref.value = nova_initia_pref_sys_prefManager.getCharPref("extensions.nova-initia.hotkey_spider");

		var shieldPref = document.getElementById('nova_initia_prefs_hotkey_shield_textbox');
		shieldPref.value = nova_initia_pref_sys_prefManager.getCharPref("extensions.nova-initia.hotkey_shield");
	}
	*/

	this.set_user_info = function()
	{
		var thePane = document.getElementById("nova_initia_preferences_overlay_prefpane");
		var userImage = document.getElementById("nova_initia_prefs_user_image");
		var tagLine = document.getElementById("nova_initia_prefs_user_tagline");
		var usernameLabel = document.getElementById("nova_initia_prefs_user_username_label");
		var locationTextbox = document.getElementById("nova_initia_prefs_user_location_textbox");
		var emailTextbox = document.getElementById("nova_initia_prefs_user_email_textbox");
		var classMenulist = document.getElementById("nova_initia_prefs_user_class_menulist");
		thePane.image = nova_initia_pref_sys_prefManager.getCharPref("extensions.nova-initia.cur_ava_url");
		userImage.src = nova_initia_pref_sys_prefManager.getCharPref("extensions.nova-initia.cur_ava_url");
		tagLine.value = nova_initia_pref_sys_prefManager.getCharPref("extensions.nova-initia.cur_tagline");
		usernameLabel.value = nova_initia_pref_sys_prefManager.getCharPref("extensions.nova-initia.cur_username");
		locationTextbox.value = nova_initia_pref_sys_prefManager.getCharPref("extensions.nova-initia.cur_location");
		emailTextbox.value = nova_initia_pref_sys_prefManager.getCharPref("extensions.nova-initia.cur_email");
		switch(nova_initia_pref_sys_prefManager.getCharPref("extensions.nova-initia.cur_class"))
		{
			case "0":
				classMenulist.selectedIndex=0;
				break;
			case "1":
				classMenulist.selectedIndex=1;
				break;
			case "2":
				classMenulist.selectedIndex=2;
				break;
			case "3":
				classMenulist.selectedIndex=3;
				break;
			default:
				classMenulist.selectedIndex=0;
				break;
		}
	}
	
	this.update_profile = function()
	{
		//alert("update still to come");
		var taglineTextbox = document.getElementById("nova_initia_prefs_user_tagline");
		var locationTextbox = document.getElementById("nova_initia_prefs_user_location_textbox");
		var emailTextbox = document.getElementById("nova_initia_prefs_user_email_textbox");
		var classMenulist = document.getElementById("nova_initia_prefs_user_class_menulist");
		var curID = nova_initia_pref_sys_prefManager.getCharPref("extensions.nova-initia.cur_id");
		var tmpURL = "http://"+nova_initia_pref_sys_prefManager.getCharPref("extensions.nova-initia.url_prefix")+nova_initia_pref_sys_prefManager.getCharPref("extensions.nova-initia.server_url")+"/rf/remog/user/"+curID+".json";
		var theParams = "_METHOD=PUT&ID="+curID+"&user[AvatarUrl]="+myNova_initiaPref_Sys.urlencode(nova_initia_pref_sys_prefManager.getCharPref("extensions.nova-initia.cur_ava_url"));
		if(taglineTextbox.value!="")
			theParams += "&user[TagLine]="+myNova_initiaPref_Sys.urlencode(taglineTextbox.value);
		else
			theParams += "&user[TagLine]="+myNova_initiaPref_Sys.urlencode("No tag line set");
		if(locationTextbox.value!="")
			theParams += "&user[Location]="+myNova_initiaPref_Sys.urlencode(locationTextbox.value);
		else
			theParams += "&user[Location]="+myNova_initiaPref_Sys.urlencode("Private");
		if(emailTextbox.value!="")
			theParams += "&user[Email]="+myNova_initiaPref_Sys.urlencode(emailTextbox.value);
		else
			theParams += "&user[Email]="+myNova_initiaPref_Sys.urlencode("Private");
		theParams += "&user[Class]="+classMenulist.selectedIndex;
		//alert(theParams);
		myNova_initiaPref_Sys.send_request(tmpURL,"POST",theParams,true,myNova_initiaPref_Sys.update_profile_finished,false);
	}
	
	this.update_profile_finished = function(theRes)
	{
		if(theRes.status==200)
		{
			myNova_initiaPref_Sys.nova_initia_send_notification("Profile Updated!","PRIORITY_INFO_LOW");
		}
		else
		{
			myNova_initiaPref_Sys.nova_initia_send_notification("Profile Update Rejected!","PRIORITY_INFO_LOW");
		}
	}
	
	this.set_logins = function()
	{
		//alert("init pref system");
		var theListbox = document.getElementById("nova_initia_preferences_login_management_users_listbox");
		var count = new Object();
		var logins = nova_initia_pref_sys_prefManager.getChildList("extensions.nova-initia.saved_users",count);
		for(var i=0;i<count.value;i++)
		{
			theListbox.appendItem(nova_initia_pref_sys_prefManager.getCharPref(logins[i]),nova_initia_pref_sys_prefManager.getCharPref(logins[i]));
		}
		//alert(count.value);
		myNova_initiaPref_Sys.set_user_info();
		//myNova_initiaPref_Sys.load_hotkeys();
	}
	
	this.delete_saved_login = function()
	{
		var theListbox = document.getElementById("nova_initia_preferences_login_management_users_listbox");
		var theUser = theListbox.selectedItem;
		var theIndex = theListbox.selectedIndex;
		if(theUser.value)
		{
			var user_menu_popup = "";
			var user_menu_popup_item = "";
			while(nova_initia_se.hasMoreElements())
			{
				var tmpSE = nova_initia_se.getNext().QueryInterface(Components.interfaces.nsIDOMWindow);
				if(tmpSE.document.getElementById('menu_nova_initia_tools_menu_user_submenupopup'))
				{
					user_menu_popup = tmpSE.document.getElementById('menu_nova_initia_tools_menu_user_submenupopup');
				}
				if(tmpSE.document.getElementById('nova_initia_user_menu_'+theUser.value))
				{
					user_menu_popup_item = tmpSE.document.getElementById('nova_initia_user_menu_'+theUser.value);
				}
			}
			if(user_menu_popup&&user_menu_popup_item)
			{
				user_menu_popup.removeChild(user_menu_popup_item);
				nova_initia_pref_sys_prefManager.deleteBranch("extensions.nova-initia.saved_users."+theUser.value);
				nova_initia_pref_sys_prefManager.deleteBranch("extensions.nova-initia.saved_passes."+theUser.value);
				//alert(nova_initia_pref_sys_prefManager.getCharPref("extensions.nova-initia.saved_username")+" | "+theUser.value);
				if(nova_initia_pref_sys_prefManager.getCharPref("extensions.nova-initia.saved_username")==theUser.value)
				{
					nova_initia_pref_sys_prefManager.setCharPref("extensions.nova-initia.saved_username","");
					nova_initia_pref_sys_prefManager.setCharPref("extensions.nova-initia.saved_password_hash","");
					nova_initia_pref_sys_prefManager.setBoolPref("extensions.nova-initia.login_saved",false);
				}
				theListbox.removeItemAt(theIndex);
				theListbox.clearSelection();
			}
			else
			{
				myNova_initiaPref_Sys.nova_initia_send_notification("Failed to Delete Login!","PRIORITY_INFO_LOW");
			}
		}
	}
	
	this.nova_initia_send_notification = function(notif,style)
	{
 	 	window.opener.gBrowser.getNotificationBox().removeAllNotifications(true);
		window.opener.gBrowser.getNotificationBox().appendNotification(notif,"","",style,Array());
		if(notification_timeout)
			clearTimeout(notification_timeout);
		notification_timeout = setTimeout("window.opener.gBrowser.getNotificationBox().removeAllNotifications(false)",5000);
	}
	
	/*	send a XMLHttpRequest
		theURL (string) - the url to send the request to
		theMethod (string) - the request type (ex: "POST"|"GET"|"PUT"|...)
		theParams (string) - the parameters to send, variables etc... (set to null if none otherwise use URL format: var1=blah&var2=blah2)
		nonBlock (bool) - set to true to setup a non-blocking request (remember to set the callback function if this it true)
		callback (string) - the function to be called when the request is finally received (set to null if nonBlock is false)
		noHeader (bool) - set to true to avoid sending the LASTKEY header (only used before the key is received the first time, all other requests must have this set to false or the server will ask the user to login)
	*/
	this.send_request = function(theURL, theMethod, theParams, nonBlock, callback, noHeader, theGroupID)
	{
		var theReq = new XMLHttpRequest();
		if(nonBlock)
		{
			theReq.onreadystatechange=function()
			{
				if(theReq.readyState==4)
				{
					callback(theReq);
				}
			}
		}
		theReq.open(theMethod,theURL,nonBlock);
		theReq.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
		if(!noHeader)
			theReq.setRequestHeader("X-NOVA-INITIA-LASTKEY", nova_initia_pref_sys_prefManager.getCharPref("extensions.nova-initia.cur_hash"));
		if(theGroupID)
			theReq.setRequestHeader("X-NOVA-INITIA-GROUPID",theGroupID);
		if(theParams)
			theReq.send(theParams);
		else
			theReq.send(null);
		if(!nonBlock)
			return theReq;
	}
	
	this.urlencode = function(str) {
	    // URL-encodes string  
	    // 
	    // version: 910.813
	    // discuss at: http://phpjs.org/functions/urlencode
	    // +   original by: Philip Peterson
	    // +   improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
	    // +      input by: AJ
	    // +   improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
	    // +   improved by: Brett Zamir (http://brett-zamir.me)
	    // +   bugfixed by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
	    // +      input by: travc
	    // +      input by: Brett Zamir (http://brett-zamir.me)
	    // +   bugfixed by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
	    // +   improved by: Lars Fischer
	    // +      input by: Ratheous
	    // +      reimplemented by: Brett Zamir (http://brett-zamir.me)
	    // +   bugfixed by: Joris
	    // %          note 1: This reflects PHP 5.3/6.0+ behavior
	    // *     example 1: urlencode('Kevin van Zonneveld!');
	    // *     returns 1: 'Kevin+van+Zonneveld%21'
	    // *     example 2: urlencode('http://kevin.vanzonneveld.net/');
	    // *     returns 2: 'http%3A%2F%2Fkevin.vanzonneveld.net%2F'
	    // *     example 3: urlencode('http://www.google.nl/search?q=php.js&ie=utf-8&oe=utf-8&aq=t&rls=com.ubuntu:en-US:unofficial&client=firefox-a');
	    // *     returns 3: 'http%3A%2F%2Fwww.google.nl%2Fsearch%3Fq%3Dphp.js%26ie%3Dutf-8%26oe%3Dutf-8%26aq%3Dt%26rls%3Dcom.ubuntu%3Aen-US%3Aunofficial%26client%3Dfirefox-a'
	    var hexStr = function (dec) {
	        return '%' + (dec < 16 ? '0' : '') + dec.toString(16).toUpperCase();
	    };
	
	    var ret = '',
	            unreserved = /[\w.-]/; // A-Za-z0-9_.- // Tilde is not here for historical reasons; to preserve it, use rawurlencode instead
	    str = (str+'').toString();
	
	    for (var i = 0, dl = str.length; i < dl; i++) {
	        var ch = str.charAt(i);
	        if (unreserved.test(ch)) {
	            ret += ch;
	        }
	        else {
	            var code = str.charCodeAt(i);
	            if (0xD800 <= code && code <= 0xDBFF) { // High surrogate (could change last hex to 0xDB7F to treat high private surrogates as single characters); https://developer.mozilla.org/index.php?title=en/Core_JavaScript_1.5_Reference/Global_Objects/String/charCodeAt
	                ret += ((code - 0xD800) * 0x400) + (str.charCodeAt(i+1) - 0xDC00) + 0x10000;
	                i++; // skip the next one as we just retrieved it as a low surrogate
	            }
	            // We never come across a low surrogate because we skip them, unless invalid
	            // Reserved assumed to be in UTF-8, as in PHP
	            else if (code === 32) {
	                ret += '+'; // %20 in rawurlencode
	            }
	            else if (code < 128) { // 1 byte
	                ret += hexStr(code);
	            }
	            else if (code >= 128 && code < 2048) { // 2 bytes
	                ret += hexStr((code >> 6) | 0xC0);
	                ret += hexStr((code & 0x3F) | 0x80);
	            }
	            else if (code >= 2048) { // 3 bytes (code < 65536)
	                ret += hexStr((code >> 12) | 0xE0);
	                ret += hexStr(((code >> 6) & 0x3F) | 0x80);
	                ret += hexStr((code & 0x3F) | 0x80);
	            }
	        }
	    }
	    return ret;
	}

	this.urldecode = function(str) {
	    // Decodes URL-encoded string  
	    // 
	    // version: 909.322
	    // discuss at: http://phpjs.org/functions/urldecode
	    // +   original by: Philip Peterson
	    // +   improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
	    // +      input by: AJ
	    // +   improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
	    // +   improved by: Brett Zamir (http://brett-zamir.me)
	    // +      input by: travc
	    // +      input by: Brett Zamir (http://brett-zamir.me)
	    // +   bugfixed by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
	    // +   improved by: Lars Fischer
	    // +      input by: Ratheous
	    // +   improved by: Orlando
	    // %        note 1: info on what encoding functions to use from: http://xkr.us/articles/javascript/encode-compare/
	    // *     example 1: urldecode('Kevin+van+Zonneveld%21');
	    // *     returns 1: 'Kevin van Zonneveld!'
	    // *     example 2: urldecode('http%3A%2F%2Fkevin.vanzonneveld.net%2F');
	    // *     returns 2: 'http://kevin.vanzonneveld.net/'
	    // *     example 3: urldecode('http%3A%2F%2Fwww.google.nl%2Fsearch%3Fq%3Dphp.js%26ie%3Dutf-8%26oe%3Dutf-8%26aq%3Dt%26rls%3Dcom.ubuntu%3Aen-US%3Aunofficial%26client%3Dfirefox-a');
	    // *     returns 3: 'http://www.google.nl/search?q=php.js&ie=utf-8&oe=utf-8&aq=t&rls=com.ubuntu:en-US:unofficial&client=firefox-a'
	    
	    var hash_map = {}, ret = str.toString(), unicodeStr='', hexEscStr='';
	    
	    var replacer = function (search, replace, str) {
	        var tmp_arr = [];
	        tmp_arr = str.split(search);
	        return tmp_arr.join(replace);
	    };
	    
	    // The hash_map is identical to the one in urlencode.
	    hash_map["'"]   = '%27';
	    hash_map['(']   = '%28';
	    hash_map[')']   = '%29';
	    hash_map['*']   = '%2A';
	    hash_map['~']   = '%7E';
	    hash_map['!']   = '%21';
	    hash_map['%20'] = '+';
	    hash_map['\u00DC'] = '%DC';
	    hash_map['\u00FC'] = '%FC';
	    hash_map['\u00C4'] = '%D4';
	    hash_map['\u00E4'] = '%E4';
	    hash_map['\u00D6'] = '%D6';
	    hash_map['\u00F6'] = '%F6';
	    hash_map['\u00DF'] = '%DF';
	    hash_map['\u20AC'] = '%80';
	    hash_map['\u0081'] = '%81';
	    hash_map['\u201A'] = '%82';
	    hash_map['\u0192'] = '%83';
	    hash_map['\u201E'] = '%84';
	    hash_map['\u2026'] = '%85';
	    hash_map['\u2020'] = '%86';
	    hash_map['\u2021'] = '%87';
	    hash_map['\u02C6'] = '%88';
	    hash_map['\u2030'] = '%89';
	    hash_map['\u0160'] = '%8A';
	    hash_map['\u2039'] = '%8B';
	    hash_map['\u0152'] = '%8C';
	    hash_map['\u008D'] = '%8D';
	    hash_map['\u017D'] = '%8E';
	    hash_map['\u008F'] = '%8F';
	    hash_map['\u0090'] = '%90';
	    hash_map['\u2018'] = '%91';
	    hash_map['\u2019'] = '%92';
	    hash_map['\u201C'] = '%93';
	    hash_map['\u201D'] = '%94';
	    hash_map['\u2022'] = '%95';
	    hash_map['\u2013'] = '%96';
	    hash_map['\u2014'] = '%97';
	    hash_map['\u02DC'] = '%98';
	    hash_map['\u2122'] = '%99';
	    hash_map['\u0161'] = '%9A';
	    hash_map['\u203A'] = '%9B';
	    hash_map['\u0153'] = '%9C';
	    hash_map['\u009D'] = '%9D';
	    hash_map['\u017E'] = '%9E';
	    hash_map['\u0178'] = '%9F';
	    hash_map['\u00C6'] = '%C3%86';
	    hash_map['\u00D8'] = '%C3%98';
	    hash_map['\u00C5'] = '%C3%85';
	
	    for (unicodeStr in hash_map) {
	        hexEscStr = hash_map[unicodeStr]; // Switch order when decoding
	        ret = replacer(hexEscStr, unicodeStr, ret); // Custom replace. No regexing
	    }
	    
	    // End with decodeURIComponent, which most resembles PHP's encoding functions
	    ret = decodeURIComponent(ret);
	
	    return ret;
	}
}