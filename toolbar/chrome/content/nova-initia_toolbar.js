

(function(ni){

    ni.ios = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService);
	ni.cookieUri = ni.ios.newURI("http://nova-initia.com/", null, null);
    ni.cookieSvc = Components.classes["@mozilla.org/cookieService;1"].getService(Components.interfaces.nsICookieService);
	ni.cookieManager = Components.classes["@mozilla.org/cookiemanager;1"].getService(Components.interfaces.nsICookieManager);

	ni.prefManager = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
	ni.debug_set = ni.prefManager.getBoolPref("extensions.nova-initia.debug");
	ni.show_login_bar = ni.prefManager.getBoolPref("extensions.nova-initia.login_toolbar_visible_at_startup");
	ni.button_placement = ni.prefManager.getBoolPref("extensions.nova-initia.stash_barrel_button_placement_bottom");
	try {
		ni.extensionManager = Components.classes["@mozilla.org/extensions/manager;1"].getService(Components.interfaces.nsIExtensionManager);
	} catch(e) {
		Components.utils.import("resource://gre/modules/AddonManager.jsm");
	}
	
	ni.loadLibraries = function(context){
		var loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
                                        .getService(Components.interfaces.mozIJSSubScriptLoader);
		
		//KeyCode
		loader.loadSubScript("resource://lib/keycode.js",context);
		ni.KeyCode = KeyCode;
				
		//JQuery
		loader.loadSubScript("resource://lib/jquery-1.5.1.min.js",context);
		var jQuery = window.jQuery.noConflict(true);
		context.jQuery = jQuery;
		context.jQuery.support.opacity = true;

		//JQuery Zen Coding Plugin
		loader.loadSubScript("resource://lib/zen-0.1a.js",context.jQuery);

		//BigInt
		loader.loadSubScript("resource://lib/bigint.js",context);
		ni.bigInt = bigInt;
	}


	
	ni.loadLibraries(ni);
	if(ni.debug_set)
		alert('Debug turned on, be ready for alerts!');

	/* Called by page load listener used to send XUL elements to the toolbar class since the class can't reach them */
	ni.initialize_toolbar = function()
	{
		if(ni.debug_set)
	 		alert('ni.initialize_toolbar: '+this+' '+this.id);
		//loadToolbar(loginToolbar,mainToolbar,barrelPanel,barrelPanelLabel,barrelPanelDescription,barrelPanelImage,barrelPanelButton,doorwayPanel,doorwayPanelLabel,doorwayPanelImage,doorwayPanelHintLabel0,doorwayPanelHintLabel1,doorwayPanelHintLabel2,doorwayPanelHiddenLabel,doorwayPanelButton,doorwayPanelNextButton,doorwayPanelPrevButton,doorwayPanelChainButton,doorwayPanelProfileButton,doorwayPanelDismissButton,doorwayCount,trapPanel,trapPanelLabel,trapPanelDescription,trapPanelImage,spiderPanel,spiderPanelLabel,spiderPanelDescription,spiderPanelImage,logoutMenuitem,loginMenuitem,toolbarThrobber,loginbarThrobber,toolbuttonElements,userMenu,userMenuPopup,userMenuSeparator,trapToolbarButton,barrelToolbarButton,spiderToolbarButton,shieldPanel,shieldPanelLabel,shieldPanelDescription,shieldToolbarButton,doorwayToolbarButton,signpostToolbarButton,stashSg,stashSgImage,stashTraps,stashTrapsImage,stashBarrels,stashBarrelsImage,stashSpiders,stashSpidersImage,stashShields,stashShieldsImage,stashDoorways,stashDoorwaysImage,stashSignposts,stashSignpostsImage,stashMessage,stashLabel,stashPanel,stashButton,openSg,openTraps,openBarrels,openSpiders,openShields,openDoorways,openSignposts,openMessage,openPanel,openLabel,openButton,doorwayPopupPanel,doorwayPopupPanelURL,doorwayPopupPanelHint,doorwayPopupPanelComment,doorwayPopupPanelURLImage,doorwayPopupPanelAddCheckbox,endDoorwayPanel,endDoorwayPanelLabel,endDoorwayPanelComment,endDoorwayPanelButton,sgButton,tourPanel,tourPanelTitle,tourPanelComments,tourPanelBack,tourPanelComplete,tourPanelCompleteLabel,tourPanelA,tourPanelB,tourPanelC,tourPanelD,tourPanelALabel,tourPanelBLabel,tourPanelCLabel,tourPanelDLabel,signpostPanel,signpostPanelTitle,signpostPanelUser,signpostPanelImage,signpostPanelGotoStartButton,tourStartPanel,tourStartPanelTitle,tourStartPanelComment,tourStartPanelStartTourButton,signpostPopup,signpostPopupTitle,signpostPopupComment)
		//if(!ni.button_placement)
		//{
			//alert("init1: "+parent.document.getElementById('nova_initia_tool_sg'));
			//parent.document.getElementById('nova_initia_tool_barrel').removeAttribute("popup");
		 	//parent.document.getElementById('nova_initia_tool_barrel').setAttribute("popup","nova_initia_tool_barrel_panel_popup_top");
			ni.Toolbar.loadToolbar(parent.document.getElementById('nova_initia_login_toolbar'),parent.document.getElementById('nova_initia_tools_toolbar'),parent.document.getElementById("nova_initia_barrel_panel"),parent.document.getElementById("nova_initia_barrel_panel_label"),parent.document.getElementById("nova_initia_barrel_panel_title_0"),parent.document.getElementById("nova_initia_barrel_panel_title_1"),parent.document.getElementById("nova_initia_barrel_panel_title_2"),parent.document.getElementById("nova_initia_barrel_panel_image"),parent.document.getElementById("nova_initia_barrel_panel_button"),parent.document.getElementById("nova_initia_barrel_panel_profile_button"),parent.document.getElementById("nova_initia_doorway_panel"),parent.document.getElementById("nova_initia_doorway_panel_label"),parent.document.getElementById("nova_initia_doorway_panel_image"),parent.document.getElementById("nova_initia_doorway_panel_hint_label_0"),parent.document.getElementById("nova_initia_doorway_panel_hint_label_1"),parent.document.getElementById("nova_initia_doorway_panel_hint_label_2"),parent.document.getElementById("nova_initia_doorway_panel_hidden_label"),parent.document.getElementById("nova_initia_doorway_panel_button"),parent.document.getElementById("nova_initia_doorway_panel_next_button"),parent.document.getElementById("nova_initia_doorway_panel_prev_button"),parent.document.getElementById("nova_initia_doorway_panel_chain_button"),parent.document.getElementById("nova_initia_doorway_panel_profile_button"),parent.document.getElementById("nova_initia_doorway_panel_dismiss_button"),parent.document.getElementById("nova_initia_doorway_panel_count"),parent.document.getElementById("nova_initia_trap_panel"),parent.document.getElementById("nova_initia_trap_panel_label"),parent.document.getElementById("nova_initia_trap_panel_description"),parent.document.getElementById("nova_initia_trap_panel_image"),parent.document.getElementById("nova_initia_spider_panel"),parent.document.getElementById("nova_initia_spider_panel_label"),parent.document.getElementById("nova_initia_spider_panel_description"),parent.document.getElementById("nova_initia_spider_panel_image"),parent.document.getElementById("nova_initia_tools_menuitem_logout"),parent.document.getElementById("nova_initia_tools_menuitem_login"),parent.document.getElementById("nova_initia_throbber"),parent.document.getElementById("nova_initia_login_toolbar_throbber"),parent.document.getElementsByClassName('nova_initia_tools_toolbarbutton'),parent.document.getElementById('nova_initia_tools_menu_user_submenu'),parent.document.getElementById('menu_nova_initia_tools_menu_user_submenupopup'),parent.document.getElementById('nova_initia_user_menu_separator'),parent.document.getElementById('nova_initia_tool_trap'),parent.document.getElementById('nova_initia_tool_barrel'),parent.document.getElementById('nova_initia_tool_spider'),parent.document.getElementById('nova_initia_shield_panel'),parent.document.getElementById('nova_initia_shield_panel_label'),parent.document.getElementById('nova_initia_shield_panel_description'),parent.document.getElementById('nova_initia_shield_panel_image'),parent.document.getElementById('nova_initia_tool_shield'),parent.document.getElementById('nova_initia_tool_doorway'),parent.document.getElementById('nova_initia_tool_signpost'),parent.document.getElementById('nova_initia_tool_barrel_panel_popup_sg_top'),parent.document.getElementById('nova_initia_tool_barrel_panel_popup_sg_image_top'),parent.document.getElementById('nova_initia_tool_barrel_panel_popup_traps_top'),parent.document.getElementById('nova_initia_tool_barrel_panel_popup_traps_image_top'),parent.document.getElementById('nova_initia_tool_barrel_panel_popup_barrels_top'),parent.document.getElementById('nova_initia_tool_barrel_panel_popup_barrels_image_top'),parent.document.getElementById('nova_initia_tool_barrel_panel_popup_spiders_top'),parent.document.getElementById('nova_initia_tool_barrel_panel_popup_spiders_image_top'),parent.document.getElementById('nova_initia_tool_barrel_panel_popup_shields_top'),parent.document.getElementById('nova_initia_tool_barrel_panel_popup_shields_image_top'),parent.document.getElementById('nova_initia_tool_barrel_panel_popup_doorways_top'),parent.document.getElementById('nova_initia_tool_barrel_panel_popup_doorways_image_top'),parent.document.getElementById('nova_initia_tool_barrel_panel_popup_signposts_top'),parent.document.getElementById('nova_initia_tool_barrel_panel_popup_signposts_image_top'),parent.document.getElementById('nova_initia_tool_barrel_panel_popup_message_top'),parent.document.getElementById('nova_initia_tool_barrel_panel_popup_label'),parent.document.getElementById('nova_initia_tool_barrel_panel_popup_top'),parent.document.getElementById('nova_initia_tool_barrel_panel_popup_stash_button_top'),parent.document.getElementById('nova_initia_tool_barrel_loot_panel_popup_sg'),parent.document.getElementById('nova_initia_tool_barrel_loot_panel_popup_traps'),parent.document.getElementById('nova_initia_tool_barrel_loot_panel_popup_barrels'),parent.document.getElementById('nova_initia_tool_barrel_loot_panel_popup_spiders'),parent.document.getElementById('nova_initia_tool_barrel_loot_panel_popup_shields'),parent.document.getElementById('nova_initia_tool_barrel_loot_panel_popup_doorways'),parent.document.getElementById('nova_initia_tool_barrel_loot_panel_popup_signposts'),parent.document.getElementById('nova_initia_tool_barrel_loot_panel_popup_message'),parent.document.getElementById('nova_initia_tool_barrel_loot_panel_popup'),parent.document.getElementById('nova_initia_tool_barrel_loot_panel_popup_label'),parent.document.getElementById('nova_initia_tool_barrel_loot_panel_popup_thanks_button'),parent.document.getElementById('nova_initia_tool_doorway_panel_popup'),parent.document.getElementById('nova_initia_tool_doorway_panel_popup_URL'),parent.document.getElementById('nova_initia_tool_doorway_panel_popup_hint'),parent.document.getElementById('nova_initia_tool_doorway_panel_popup_comment'),parent.document.getElementById('nova_initia_tool_doorway_panel_popup_URL_image'),parent.document.getElementById('nova_initia_tool_doorway_panel_popup_add_to_chain'),parent.document.getElementById('nova_initia_tool_doorway_panel_popup_nsfw'),parent.document.getElementById('nova_initia_doorway_panel_end'),parent.document.getElementById('nova_initia_doorway_panel_end_label'),parent.document.getElementById('nova_initia_doorway_panel_end_comment_textbox'),parent.document.getElementById('nova_initia_doorway_panel_end_button'),parent.document.getElementById('nova_initia_tool_sg'),parent.document.getElementById('nova_initia_tour_panel'),parent.document.getElementById('nova_initia_tour_panel_title_label'),parent.document.getElementById('nova_initia_tour_panel_comment_textbox'),parent.document.getElementById('nova_initia_tour_panel_back_button'),parent.document.getElementById('nova_initia_tour_panel_complete_button'),parent.document.getElementById('nova_initia_tour_panel_complete_label'),parent.document.getElementById('nova_initia_tour_panel_A_button'),parent.document.getElementById('nova_initia_tour_panel_B_button'),parent.document.getElementById('nova_initia_tour_panel_C_button'),parent.document.getElementById('nova_initia_tour_panel_D_button'),parent.document.getElementById('nova_initia_signpost_panel'),parent.document.getElementById('nova_initia_signpost_panel_title_label'),parent.document.getElementById('nova_initia_signpost_panel_user_label'),parent.document.getElementById('nova_initia_signpost_panel_image'),parent.document.getElementById('nova_initia_signpost_panel_goto_start_button'),parent.document.getElementById('nova_initia_tour_start_panel'),parent.document.getElementById('nova_initia_tour_start_panel_title_label'),parent.document.getElementById('nova_initia_tour_start_panel_comment_textbox'),parent.document.getElementById('nova_initia_tour_start_panel_start_tour_button'),parent.document.getElementById('nova_initia_tool_signpost_panel_popup'),parent.document.getElementById('nova_initia_tool_signpost_panel_popup_title'),parent.document.getElementById('nova_initia_tool_signpost_panel_popup_comment'),parent.document.getElementById('nova_initia_tool_signpost_panel_popup_nsfw'),parent.document.getElementById("nova_initia_fail_panel"),parent.document.getElementById("nova_initia_fail_panel_label"),parent.document.getElementById("nova_initia_fail_panel_description"),parent.document.getElementById("nova_initia_fail_panel_image"),parent.document.getElementById("nova_initia_random_panel"),parent.document.getElementById("nova_initia_random_panel_label"),parent.document.getElementById("nova_initia_random_panel_description"),parent.document.getElementById("nova_initia_random_panel_image"));
		//}
		//else
		//{
			//alert("init2: "+parent.document.getElementById('nova_initia_tool_sg'));
			//parent.document.getElementById('nova_initia_tool_barrel').removeAttribute("popup");
			//parent.document.getElementById('nova_initia_tool_barrel').setAttribute("popup","nova_initia_tool_barrel_panel_popup");
			//ni.Toolbar.loadToolbar(parent.document.getElementById('nova_initia_login_toolbar'),parent.document.getElementById('nova_initia_tools_toolbar'),parent.document.getElementById("nova_initia_barrel_panel"),parent.document.getElementById("nova_initia_barrel_panel_label"),parent.document.getElementById("nova_initia_barrel_panel_description"),parent.document.getElementById("nova_initia_barrel_panel_image"),parent.document.getElementById("nova_initia_barrel_panel_button"),parent.document.getElementById("nova_initia_doorway_panel"),parent.document.getElementById("nova_initia_doorway_panel_label"),parent.document.getElementById("nova_initia_doorway_panel_image"),parent.document.getElementById("nova_initia_doorway_panel_hint_label_0"),parent.document.getElementById("nova_initia_doorway_panel_hint_label_1"),parent.document.getElementById("nova_initia_doorway_panel_hint_label_2"),parent.document.getElementById("nova_initia_doorway_panel_hidden_label"),parent.document.getElementById("nova_initia_doorway_panel_button"),parent.document.getElementById("nova_initia_doorway_panel_next_button"),parent.document.getElementById("nova_initia_doorway_panel_prev_button"),parent.document.getElementById("nova_initia_doorway_panel_chain_button"),parent.document.getElementById("nova_initia_doorway_panel_profile_button"),parent.document.getElementById("nova_initia_doorway_panel_dismiss_button"),parent.document.getElementById("nova_initia_doorway_panel_count"),parent.document.getElementById("nova_initia_trap_panel"),parent.document.getElementById("nova_initia_trap_panel_label"),parent.document.getElementById("nova_initia_trap_panel_description"),parent.document.getElementById("nova_initia_trap_panel_image"),parent.document.getElementById("nova_initia_spider_panel"),parent.document.getElementById("nova_initia_spider_panel_label"),parent.document.getElementById("nova_initia_spider_panel_description"),parent.document.getElementById("nova_initia_spider_panel_image"),parent.document.getElementById("nova_initia_tools_menuitem_logout"),parent.document.getElementById("nova_initia_tools_menuitem_login"),parent.document.getElementById("nova_initia_throbber"),parent.document.getElementById("nova_initia_login_toolbar_throbber"),parent.document.getElementsByClassName('nova_initia_tools_toolbarbutton'),parent.document.getElementById('nova_initia_tools_menu_user_submenu'),parent.document.getElementById('menu_nova_initia_tools_menu_user_submenupopup'),parent.document.getElementById('nova_initia_user_menu_separator'),parent.document.getElementById('nova_initia_tool_trap'),parent.document.getElementById('nova_initia_tool_barrel'),parent.document.getElementById('nova_initia_tool_spider'),parent.document.getElementById('nova_initia_shield_panel'),parent.document.getElementById('nova_initia_shield_panel_label'),parent.document.getElementById('nova_initia_shield_panel_description'),parent.document.getElementById('nova_initia_shield_panel_image'),parent.document.getElementById('nova_initia_tool_shield'),parent.document.getElementById('nova_initia_tool_doorway'),parent.document.getElementById('nova_initia_tool_signpost'),parent.document.getElementById('nova_initia_tool_barrel_panel_popup_sg'),parent.document.getElementById('nova_initia_tool_barrel_panel_popup_sg_image'),parent.document.getElementById('nova_initia_tool_barrel_panel_popup_traps'),parent.document.getElementById('nova_initia_tool_barrel_panel_popup_traps_image'),parent.document.getElementById('nova_initia_tool_barrel_panel_popup_barrels'),parent.document.getElementById('nova_initia_tool_barrel_panel_popup_barrels_image'),parent.document.getElementById('nova_initia_tool_barrel_panel_popup_spiders'),parent.document.getElementById('nova_initia_tool_barrel_panel_popup_spiders_image'),parent.document.getElementById('nova_initia_tool_barrel_panel_popup_shields'),parent.document.getElementById('nova_initia_tool_barrel_panel_popup_shields_image'),parent.document.getElementById('nova_initia_tool_barrel_panel_popup_doorways'),parent.document.getElementById('nova_initia_tool_barrel_panel_popup_doorways_image'),parent.document.getElementById('nova_initia_tool_barrel_panel_popup_signposts'),parent.document.getElementById('nova_initia_tool_barrel_panel_popup_signposts_image'),parent.document.getElementById('nova_initia_tool_barrel_panel_popup_message'),parent.document.getElementById('nova_initia_tool_barrel_panel_popup_label'),parent.document.getElementById('nova_initia_tool_barrel_panel_popup'),parent.document.getElementById('nova_initia_tool_barrel_panel_popup_stash_button'),parent.document.getElementById('nova_initia_tool_barrel_loot_panel_popup_sg'),parent.document.getElementById('nova_initia_tool_barrel_loot_panel_popup_traps'),parent.document.getElementById('nova_initia_tool_barrel_loot_panel_popup_barrels'),parent.document.getElementById('nova_initia_tool_barrel_loot_panel_popup_spiders'),parent.document.getElementById('nova_initia_tool_barrel_loot_panel_popup_shields'),parent.document.getElementById('nova_initia_tool_barrel_loot_panel_popup_doorways'),parent.document.getElementById('nova_initia_tool_barrel_loot_panel_popup_signposts'),parent.document.getElementById('nova_initia_tool_barrel_loot_panel_popup_message'),parent.document.getElementById('nova_initia_tool_barrel_loot_panel_popup'),parent.document.getElementById('nova_initia_tool_barrel_loot_panel_popup_label'),parent.document.getElementById('nova_initia_tool_barrel_loot_panel_popup_thanks_button'),parent.document.getElementById('nova_initia_tool_doorway_panel_popup'),parent.document.getElementById('nova_initia_tool_doorway_panel_popup_URL'),parent.document.getElementById('nova_initia_tool_doorway_panel_popup_hint'),parent.document.getElementById('nova_initia_tool_doorway_panel_popup_comment'),parent.document.getElementById('nova_initia_tool_doorway_panel_popup_URL_image'),parent.document.getElementById('nova_initia_tool_doorway_panel_popup_add_to_chain'),parent.document.getElementById('nova_initia_doorway_panel_end'),parent.document.getElementById('nova_initia_doorway_panel_end_label'),parent.document.getElementById('nova_initia_doorway_panel_end_comment_textbox'),parent.document.getElementById('nova_initia_doorway_panel_end_button'),parent.document.getElementById('nova_initia_tool_sg'),parent.document.getElementById('nova_initia_tour_panel'),parent.document.getElementById('nova_initia_tour_panel_title_label'),parent.document.getElementById('nova_initia_tour_panel_comment_textbox'),parent.document.getElementById('nova_initia_tour_panel_back_button'),parent.document.getElementById('nova_initia_tour_panel_complete_button'),parent.document.getElementById('nova_initia_tour_panel_complete_label'),parent.document.getElementById('nova_initia_tour_panel_A_button'),parent.document.getElementById('nova_initia_tour_panel_B_button'),parent.document.getElementById('nova_initia_tour_panel_C_button'),parent.document.getElementById('nova_initia_tour_panel_D_button'),parent.document.getElementById('nova_initia_tour_panel_A_label'),parent.document.getElementById('nova_initia_tour_panel_B_label'),parent.document.getElementById('nova_initia_tour_panel_C_label'),parent.document.getElementById('nova_initia_tour_panel_D_label'),parent.document.getElementById('nova_initia_signpost_panel'),parent.document.getElementById('nova_initia_signpost_panel_title_label'),parent.document.getElementById('nova_initia_signpost_panel_image'),parent.document.getElementById('nova_initia_signpost_panel_user_label'),parent.document.getElementById('nova_initia_signpost_panel_goto_start_button'),parent.document.getElementById('nova_initia_tour_start_panel'),parent.document.getElementById('nova_initia_tour_start_panel_title_label'),parent.document.getElementById('nova_initia_tour_start_panel_comment_textbox'),parent.document.getElementById('nova_initia_tour_start_panel_start_tour_button'),parent.document.getElementById('nova_initia_tool_signpost_panel_popup'),parent.document.getElementById('nova_initia_tool_signpost_panel_popup_title'),parent.document.getElementById('nova_initia_tool_signpost_panel_popup_comment'),parent.document.getElementById("nova_initia_fail_panel"),parent.document.getElementById("nova_initia_fail_panel_label"),parent.document.getElementById("nova_initia_fail_panel_description"),parent.document.getElementById("nova_initia_fail_panel_image"));
		//}
	}

	ni.Toolbar = new function createToolbar()
	{
	 	if(ni.debug_set)
	 	{
		 	alert('nova_initia_toolbar: '+this);
		}
		// Array to hold all of the trackable URL starters. Anything else will be rejected for tracking (ie: about:config, https:, etc...)
		var acceptable_URL_starters = new Array("http:");
		var user_cache = new ni.JSOC();
		var location_cache = new ni.JSOC();
		var doorway_cache = new ni.JSOC();
		var signpost_cache = new ni.JSOC();
		var signpost_panel = "";
		var signpost_panel_title_label = "";
		var signpost_panel_user_label = "";
		var signpost_panel_image = "";
		var signpost_panel_goto_button = "";
	 	var signpost_panel_open = false;
	 	var signpost_panel_popup = "";
	 	var signpost_panel_popup_title = "";
	 	var signpost_panel_popup_comment = "";
	 	var signpost_tool_id = "";
	 	var signpost_tool_cost = "";
	 	var signpost_tool_amount = "";
	 	var signpost_toolbar_button = "";
		var barrel_panel = "";
		var barrel_panel_label = "";
		var barrel_panel_title_0 = "";
		var barrel_panel_title_1 = "";
		var barrel_panel_title_2 = "";
		var barrel_panel_button = "";
		var barrel_panel_profile_button = "";
		var barrel_panel_image = "";
	 	var barrel_panel_open = false;
	 	var barrel_tool_id = "";
	 	var barrel_tool_cost = "";
	 	var barrel_tool_amount = "";
	 	var barrel_toolbar_button = "";
	 	var last_barrel_ID = "";
	 	var doorway_end_panel = "";
	 	var doorway_end_panel_label = "";
	 	var doorway_end_panel_comment = "";
	 	var doorway_end_panel_button = "";
	 	var doorway_end_panel_open = false;
		var doorway_panel = "";
		var doorway_panel_button = "";
		var doorway_panel_count = "";
		var doorway_panel_next_button = "";
		var doorway_panel_prev_button = "";
		var doorway_panel_chain_button = "";
		var doorway_panel_dismiss_button = "";
		var doorway_panel_hint_label_0 = "";
		var doorway_panel_hint_label_1 = "";
		var doorway_panel_hint_label_2 = "";
		var doorway_panel_hidden_label = "";
		var doorway_panel_label = "";
		var doorway_panel_image = "";
	 	var doorway_panel_open = false;
	 	var doorway_popup_panel = "";
	 	var doorway_popup_panel_URL = "";
	 	var doorway_popup_panel_hint = "";
	 	var doorway_popup_panel_comment = "";
	 	var doorway_popup_panel_add_to_checkbox = "";
	 	var doorway_popup_panel_URL_image = "";
		var doorway_popup_panel_nsfw_checkbox = "";
	 	var doorway_carousel_array = new Array();
	 	var doorway_tool_id = "";
	 	var doorway_tool_cost = "";
	 	var doorway_tool_amount = "";
	 	var doorway_toolbar_button = "";
		var fail_panel = "";
		var fail_panel_label = "";
		var fail_panel_description = "";
		var fail_panel_open = false;
		var fail_tool_id = "";
		var random_panel = "";
		var random_panel_label = "";
		var random_panel_description = "";
		var random_panel_open = false;
		var random_event_id = "";
		var trap_panel = "";
		var trap_panel_label = "";
		var trap_panel_description = "";
		var trap_panel_image = "";
	 	var trap_panel_open = false;
	 	var trap_tool_id = "";
	 	var trap_tool_cost = "";
	 	var trap_tool_amount = "";
	 	var trap_toolbar_button = "";
	 	var spider_panel = "";
	 	var spider_panel_label = "";
	 	var spider_panel_description = "";
		var spider_panel_image = "";
	 	var spider_panel_open = false;
	 	var spider_tool_id = "";
	 	var spider_tool_cost = "";
	 	var spider_tool_amount = "";
		var spider_toolbar_button = "";
	 	var shield_tool_id = "";
	 	var shield_tool_cost = "";
	 	var shield_toolbar_button = "";
	 	var shield_hits_left = 0;
	 	var shield_tool_amount = "";
		var shield_panel = "";
		var shield_panel_label = "";
		var shield_panel_description = "";
		var shield_panel_image = "";
	 	var shield_panel_open = false;
	 	var sg_tool_amount = "";
	 	var sg_toolbar_button = "";
	 	var open_barrel_sg_label = "";
	 	var open_barrel_traps_label = "";
	 	var open_barrel_barrels_label = "";
	 	var open_barrel_spiders_label = "";
	 	var open_barrel_shields_label = "";
	 	var open_barrel_doorways_label = "";
	 	var open_barrel_signposts_label = "";
	 	var open_barrel_message_label = "";
	 	var open_barrel_panel = "";
	 	var open_barrel_panel_open = false;
	 	var open_barrel_label = "";
	 	var open_barrel_button = "";
	 	var stash_barrel_sg_textbox = "";
	 	var stash_barrel_sg_image = "";
	 	var stash_barrel_traps_textbox = "";
	 	var stash_barrel_traps_image = "";
	 	var stash_barrel_traps_image_filler = "";
	 	var stash_barrel_barrels_textbox = "";
	 	var stash_barrel_barrels_image = "";
	 	var stash_barrel_barrels_image_filler = "";
	 	var stash_barrel_spiders_textbox = "";
	 	var stash_barrel_spiders_image = "";
	 	var stash_barrel_spiders_image_filler = "";
	 	var stash_barrel_shields_textbox = "";
	 	var stash_barrel_shields_image = "";
	 	var stash_barrel_shields_image_filler = "";
	 	var stash_barrel_doorways_textbox = "";
	 	var stash_barrel_doorways_image = "";
	 	var stash_barrel_doorways_image_filler = "";
	 	var stash_barrel_signposts_textbox = "";
	 	var stash_barrel_signposts_image = "";
	 	var stash_barrel_signposts_image_filler = "";
	 	var stash_barrel_message_textbox = "";
	 	var stash_barrel_panel = "";
	 	var stash_barrel_button = "";
	 	var tour_panel = "";
		var tour_panel_title_label = "";
		var tour_panel_comment_textbox = "";
		var tour_panel_back_button = "";
		var tour_panel_complete_button = "";
		var tour_panel_complete_label = "";
		var tour_panel_A_button = "";
		var tour_panel_B_button = "";
		var tour_panel_C_button = "";
		var tour_panel_D_button = "";
		var tour_panel_A_label = "";
		var tour_panel_B_label = "";
		var tour_panel_C_label = "";
		var tour_panel_D_label = "";
		var tour_panel_open = false;
		var tour_start_panel = "";
		var tour_start_panel_title_label = "";
		var tour_start_panel_comment_textbox = "";
		var tour_start_panel_start_button = "";
		var tour_start_panel_open = false;
	 	var at_tour_start = false;
		var in_a_tour = false;
		var cur_tour_info = "";
		var tour_path_info = new Array();
		var last_tour_ID = "";
	 	var last_doorwayID = "";
	 	var last_doorway_user = "";
	 	var user_menu = "";
	 	var user_menu_popup = "";
	 	var user_menu_separator = "";
	 	var user_array = new Array();
	 	var user_JSON = "";
		var temporary_tool_user = "";
	 	var login_toolbar = "";
	 	var toolbar = "";
	 	var toolbar_throbber = "";
	 	var loginbar_throbber = "";
	 	var toolbutton_elements = new Array();
	 	var logout_menuitem = "";
	 	var login_menuitem = "";
	 	var logged_in = false;
	 	var user_name = "";
		var current_key = "";
		var notification_timeout = "";
		var login_saved = ni.prefManager.getBoolPref("extensions.nova-initia.login_saved");
		var server_url = ni.prefManager.getCharPref("extensions.nova-initia.server_url");
		var url_prefix = ni.prefManager.getCharPref("extensions.nova-initia.url_prefix");
		var cur_url_hash = "";
		var cur_domain_hash = "";
		var cur_url = "";
		var prev_url = "";
		var cur_page_num=0;
		var cur_signpost_ID = "";
		var cur_tour_group_ID = "";
		var prev_signpost_ID = "";
		var at_a_page = false;
		var took_doorway = false;
		var tool_array = new Array();
		var class_giver_ID = "1";
		var class_guardian_ID = "2";
		var class_guide_ID = "3";
		var trapTimeout = 0;
		var barrelTimeout = 0;
		var spiderTimeout = 0;
		var shieldTimeout = 0;
		var doorwayTimeout = 0;
		var signpostTimeout = 0;
		var failTimeout = 0;
		var randomTimeout = 0;
		var locationTimeout = 0;
		
		this.AutoSyncEnabled = false;
		
		/* initialize the toolbar by setting all necessary variables */
		this.loadToolbar = function(loginToolbar,mainToolbar,barrelPanel,barrelPanelLabel,barrelPanelTitle0,barrelPanelTitle1,barrelPanelTitle2,barrelPanelImage,barrelPanelButton,barrelPanelProfileButton,doorwayPanel,doorwayPanelLabel,doorwayPanelImage,doorwayPanelHintLabel0,doorwayPanelHintLabel1,doorwayPanelHintLabel2,doorwayPanelHiddenLabel,doorwayPanelButton,doorwayPanelNextButton,doorwayPanelPrevButton,doorwayPanelChainButton,doorwayPanelProfileButton,doorwayPanelDismissButton,doorwayCount,trapPanel,trapPanelLabel,trapPanelDescription,trapPanelImage,spiderPanel,spiderPanelLabel,spiderPanelDescription,spiderPanelImage,logoutMenuitem,loginMenuitem,toolbarThrobber,loginbarThrobber,toolbuttonElements,userMenu,userMenuPopup,userMenuSeparator,trapToolbarButton,barrelToolbarButton,spiderToolbarButton,shieldPanel,shieldPanelLabel,shieldPanelDescription,shieldPanelImage,shieldToolbarButton,doorwayToolbarButton,signpostToolbarButton,stashSg,stashSgImage,stashTraps,stashTrapsImage,stashBarrels,stashBarrelsImage,stashSpiders,stashSpidersImage,stashShields,stashShieldsImage,stashDoorways,stashDoorwaysImage,stashSignposts,stashSignpostsImage,stashMessage,stashLabel,stashPanel,stashButton,openSg,openTraps,openBarrels,openSpiders,openShields,openDoorways,openSignposts,openMessage,openPanel,openLabel,openButton,doorwayPopupPanel,doorwayPopupPanelURL,doorwayPopupPanelHint,doorwayPopupPanelComment,doorwayPopupPanelURLImage,doorwayPopupPanelAddCheckbox,doorwayPopupPanelNSFWCheckbox,endDoorwayPanel,endDoorwayPanelLabel,endDoorwayPanelComment,endDoorwayPanelButton,sgButton,tourPanel,tourPanelTitle,tourPanelComments,tourPanelBack,tourPanelComplete,tourPanelCompleteLabel,tourPanelA,tourPanelB,tourPanelC,tourPanelD,signpostPanel,signpostPanelTitle,signpostPanelUser,signpostPanelImage,signpostPanelGotoStartButton,tourStartPanel,tourStartPanelTitle,tourStartPanelComment,tourStartPanelStartTourButton,signpostPopup,signpostPopupTitle,signpostPopupComment,signpostNSFWCheckbox,failPanel,failPanelLabel,failPanelDescription,failPanelImage,randomPanel,randomPanelLabel,randomPanelDescription,randomPanelImage)
		{
			//alert("init button: "+signpostToolbarButton);
			//ni.prefManager.deleteBranch("extensions.nova-initia.saved_users");
			//ni.prefManager.deleteBranch("extensions.nova-initia.saved_passes");
			toolbutton_elements = toolbuttonElements;
			this.set_toolbutton_orient(ni.prefManager.getBoolPref("extensions.nova-initia.toolbar_text_orientation_vertical"));
			if(ni.debug_set)
				alert('loadToolBar: '+this);
			login_toolbar = loginToolbar;
			toolbar = mainToolbar;
			signpost_panel = signpostPanel;
			signpost_panel_title_label = signpostPanelTitle;
			signpost_panel_user_label = signpostPanelUser;
			signpost_panel_image = signpostPanelImage;
			//signpost_panel_start_button = signpostPanelGotoStartButton;
			signpost_panel_goto_button = signpostPanelGotoStartButton;
			signpost_panel_popup = signpostPopup;
			signpost_panel_popup_title = signpostPopupTitle;
			signpost_panel_popup_comment = signpostPopupComment;
			signpost_panel_popup_nsfw = signpostNSFWCheckbox;
			signpost_toolbar_button = signpostToolbarButton;
			tour_start_panel = tourStartPanel;
			tour_start_panel_title_label = tourStartPanelTitle;
			tour_start_panel_comment_textbox = tourStartPanelComment;
			tour_start_panel_start_button = tourStartPanelStartTourButton;
			barrel_panel = barrelPanel;
			barrel_panel_label = barrelPanelLabel;
			barrel_panel_title_0 = barrelPanelTitle0;
			barrel_panel_title_1 = barrelPanelTitle1;
			barrel_panel_title_2 = barrelPanelTitle2;
			barrel_panel_image = barrelPanelImage;
			barrel_panel_button = barrelPanelButton;
			barrel_panel_profile_button = barrelPanelProfileButton;
			barrel_toolbar_button = barrelToolbarButton;
			doorway_end_panel = endDoorwayPanel;
			doorway_end_panel_label = endDoorwayPanelLabel;
			doorway_end_panel_comment = endDoorwayPanelComment;
			doorway_end_panel_button = endDoorwayPanelButton;
			doorway_panel = doorwayPanel;
			doorway_panel_button = doorwayPanelButton;
			doorway_panel_next_button = doorwayPanelNextButton;
			doorway_panel_prev_button = doorwayPanelPrevButton;
			doorway_panel_chain_button = doorwayPanelChainButton;
			doorway_panel_profile_button = doorwayPanelProfileButton;
			doorway_panel_dismiss_button = doorwayPanelDismissButton;
			doorway_panel_count = doorwayCount;
			doorway_panel_hint_label_0 = doorwayPanelHintLabel0;
			doorway_panel_hint_label_1 = doorwayPanelHintLabel1;
			doorway_panel_hint_label_2 = doorwayPanelHintLabel2;
			doorway_panel_hidden_label = doorwayPanelHiddenLabel;
			doorway_panel_label = doorwayPanelLabel;
			doorway_panel_image = doorwayPanelImage;
			doorway_popup_panel = doorwayPopupPanel;
			doorway_popup_panel_URL = doorwayPopupPanelURL;
			doorway_popup_panel_hint = doorwayPopupPanelHint;
			doorway_popup_panel_comment = doorwayPopupPanelComment;
			doorway_popup_panel_add_to_checkbox = doorwayPopupPanelAddCheckbox;
			doorway_popup_panel_nsfw_checkbox = doorwayPopupPanelNSFWCheckbox;
			doorway_popup_panel_URL_image = doorwayPopupPanelURLImage;
			doorway_toolbar_button = doorwayToolbarButton;
			fail_panel = failPanel;
			fail_panel_label = failPanelLabel;
			fail_panel_description = failPanelDescription;
			fail_panel_image = failPanelImage;
			random_panel = randomPanel;
			random_panel_label = randomPanelLabel;
			random_panel_description = randomPanelDescription;
			random_panel_image = randomPanelImage;
			trap_panel = trapPanel;
			trap_panel_label = trapPanelLabel;
			trap_panel_description = trapPanelDescription;
			trap_panel_image = trapPanelImage;
			trap_toolbar_button = trapToolbarButton;
			spider_panel = spiderPanel;
			spider_panel_label = spiderPanelLabel;
			spider_panel_description = spiderPanelDescription;
			spider_panel_image = spiderPanelImage;
			spider_toolbar_button = spiderToolbarButton;
			shield_panel = shieldPanel;
			shield_panel_label = shieldPanelLabel;
			shield_panel_description = shieldPanelDescription;
			shield_panel_image = shieldPanelImage;
			shield_toolbar_button = shieldToolbarButton;
			open_barrel_sg_label = openSg;
			open_barrel_traps_label = openTraps;
			open_barrel_barrels_label = openBarrels;
			open_barrel_spiders_label = openSpiders;
			open_barrel_shields_label = openShields;
			open_barrel_doorways_label = openDoorways;
			open_barrel_signposts_label = openSignposts;
			open_barrel_message_label = openMessage;
			open_barrel_panel = openPanel;
			open_barrel_label = openLabel;
			open_barrel_button = openButton;
			stash_barrel_sg_textbox = stashSg;
			stash_barrel_sg_image = stashSgImage;
			stash_barrel_traps_textbox = stashTraps;
			stash_barrel_traps_image = stashTrapsImage;
			//stash_barrel_traps_image_filler = stashTrapsImageFiller;
			stash_barrel_barrels_textbox = stashBarrels;
			stash_barrel_barrels_image = stashBarrelsImage;
			//stash_barrel_barrels_image_filler = stashBarrelsImageFiller;
			stash_barrel_spiders_textbox = stashSpiders;
			stash_barrel_spiders_image = stashSpidersImage;
			//stash_barrel_spiders_image_filler = stashSpidersImageFiller;
			stash_barrel_shields_textbox = stashShields;
			stash_barrel_shields_image = stashShieldsImage;
			//stash_barrel_shields_image_filler = stashShieldsImageFiller;
			stash_barrel_doorways_textbox = stashDoorways;
			stash_barrel_doorways_image = stashDoorwaysImage;
			//stash_barrel_doorways_image_filler = stashDoorwaysImageFiller;
			stash_barrel_signposts_textbox = stashSignposts;
			stash_barrel_signposts_image = stashSignpostsImage;
			//stash_barrel_signposts_image_filler = stashSignpostsImageFiller;
			stash_barrel_message_textbox = stashMessage;
			stash_barrel_label_textbox = stashLabel;
			stash_barrel_panel = stashPanel;
			stash_barrel_button = stashButton;
			tour_panel = tourPanel;
			tour_panel_title_label = tourPanelTitle;
			tour_panel_comment_textbox = tourPanelComments;
			tour_panel_back_button = tourPanelBack;
			tour_panel_complete_button = tourPanelComplete;
			tour_panel_complete_label = tourPanelCompleteLabel;
			tour_panel_A_button = tourPanelA;
			tour_panel_B_button = tourPanelB;
			tour_panel_C_button = tourPanelC;
			tour_panel_D_button = tourPanelD;
			sg_toolbar_button = sgButton;
			logout_menuitem = logoutMenuitem;
			login_menuitem = loginMenuitem;
			toolbar_throbber = toolbarThrobber;
			if(toolbar_throbber)
				toolbar_throbber.hidden=true;
			loginbar_throbber = loginbarThrobber;
			if(ni.show_login_bar)
			{
				login_toolbar.hidden=false;
				login_toolbar.collapsed=false;
			}
			toolbar.hidden=true;
			toolbar.collapsed=true;
			user_menu = userMenu;
			user_menu_popup = userMenuPopup;
			user_menu_separator = userMenuSeparator;
			ni.Toolbar.setup_user_menu();	
			ni.prefManager.setCharPref("extensions.nova-initia.cur_username","");
			ni.prefManager.setCharPref("extensions.nova-initia.cur_ava_url","");
			ni.prefManager.setCharPref("extensions.nova-initia.cur_tagline","");
			ni.prefManager.setCharPref("extensions.nova-initia.cur_email","");
			ni.prefManager.setCharPref("extensions.nova-initia.cur_location","");
			ni.prefManager.setCharPref("extensions.nova-initia.cur_class","");
			ni.prefManager.setCharPref("extensions.nova-initia.cur_id","");
			ni.prefManager.setCharPref("extensions.nova-initia.cur_hash","");
			try {
				//Add buttons when updates come along
				var nitoolbar = document.getElementById("nova_initia_tools_toolbar");
				var curSet = nitoolbar.currentSet;
				//This will need to come out of a future version.
				var set = "nova_initia_tool_trap,nova_initia_tool_barrel,nova_initia_tool_signpost,nova_initia_tool_doorway,nova_initia_tool_spider,nova_initia_tool_shield,nova_initia_events,nova_initia_mail,nova_initia_profile,nova_intia_logout,spring,nova_initia_throbber,spring,nova_initia_tool_sg";
				nitoolbar.setAttribute("currentset", set);
				nitoolbar.currentSet = set;
				document.persist("nova_initia_tools_toolbar", "currentset");
				try {
					BrowserToolboxCustomizeDone(true);
				}
				catch (e) { }
			}
			catch(e) { }
			
			
			try {
				curSet = nitoolbar.currentSet;
				if(curSet.indexOf("nova_intia_logout") == -1)
				{
					set = curSet.replace(/nova_initia_profile/, "nova_initia_profile,nova_initia_logout");
					nitoolbar.setAttribute("currentset", set);
					nitoolbar.currentSet = set;
					document.persist("nova_initia_tools_toolbar", "currentset");
					try {
						BrowserToolboxCustomizeDone(true);
					}
					catch (e) { }
				}
			}
			catch(e){ }
		};
	
		this.capture_key = function(e)
		{
			var theKeyObj = ni.KeyCode.translate_event(e);
			var theFullKey = ni.KeyCode.hot_key(theKeyObj);
			var theKey = ni.KeyCode.orig_key(theKeyObj);
			var modCtrl = ni.prefManager.getBoolPref("extensions.nova-initia.hotkey_modifier_ctrl");
			var modAlt = ni.prefManager.getBoolPref("extensions.nova-initia.hotkey_modifier_alt");
			var modShift = ni.prefManager.getBoolPref("extensions.nova-initia.hotkey_modifier_shift");
			var evt = document.createEvent("KeyboardEvent");
			evt.initKeyEvent("keypress", false, true, null, false, false, false, false, 13, 0);
			
			var modCtrlMatch = false;
			if(modCtrl)
			{
				if(theKeyObj.ctrl)
				{
					modCtrlMatch = true;
				}
			}
			else
			{
				if(!theKeyObj.ctrl)
				{
					modCtrlMatch = true;
				}
			}
			
			var modAltMatch = false;
			if(modAlt)
			{
				if(theKeyObj.alt)
				{
					modAltMatch = true;
				}
			}
			else
			{
				if(!theKeyObj.alt)
				{
					modAltMatch = true;
				}
			}
			
			var modShiftMatch = false;
			if(modShift)
			{
				if(theKeyObj.shift)
				{
					modShiftMatch = true;
				}
			}
			else
			{
				if(!theKeyObj.shift)
				{
					modShiftMatch = true;
				}
			}
			
			if(modCtrlMatch&&modAltMatch&&modShiftMatch)
			{
				if(theKey==ni.prefManager.getCharPref("extensions.nova-initia.hotkey_trap").toUpperCase())
					trap_toolbar_button.click();
				if(theKey==ni.prefManager.getCharPref("extensions.nova-initia.hotkey_barrel").toUpperCase())
					barrel_toolbar_button.click();
				if(theKey==ni.prefManager.getCharPref("extensions.nova-initia.hotkey_signpost").toUpperCase())
					signpost_toolbar_button.click();
				if(theKey==ni.prefManager.getCharPref("extensions.nova-initia.hotkey_doorway").toUpperCase())
					doorway_toolbar_button.click();
				if(theKey==ni.prefManager.getCharPref("extensions.nova-initia.hotkey_spider").toUpperCase())
					spider_toolbar_button.click();
				if(theKey==ni.prefManager.getCharPref("extensions.nova-initia.hotkey_shield").toUpperCase())
					shield_toolbar_button.click();
			}

			/*
			trap_toolbar_button.accessKey = ni.prefManager.getCharPref("extensions.nova-initia.hotkey_trap");
			barrel_toolbar_button.accessKey = ni.prefManager.getCharPref("extensions.nova-initia.hotkey_barrel");
			signpost_toolbar_button.accessKey = ni.prefManager.getCharPref("extensions.nova-initia.hotkey_signpost");
			doorway_toolbar_button.accessKey = ni.prefManager.getCharPref("extensions.nova-initia.hotkey_doorway");
			spider_toolbar_button.accessKey = ni.prefManager.getCharPref("extensions.nova-initia.hotkey_spider");
			shield_toolbar_button.accessKey = ni.prefManager.getCharPref("extensions.nova-initia.hotkey_shield");
			*/
		};
			
		/* Get all the saved users and call setup_user_menuitem on them */
		this.setup_user_menu = function()
		{
		 	var tmpObj = new Object();
			var children = ni.prefManager.getChildList("extensions.nova-initia.saved_users",tmpObj);
			user_array = new Array();
			for(var j=0;j<tmpObj.value;j++)
			{
				this.setup_user_menuitem(ni.prefManager.getCharPref(children[j]));
			}
		};
		
		/* Inserts the saved user XUL into the switch user menu of the nova initia tool menu */
		this.setup_user_menuitem = function(theUser)
		{
			if(ni.debug_set)
			 	alert('adding '+theUser+' to users menu');
		 	if(!this.inArray(user_array,theUser))
		 	{
		 	 	if(ni.debug_set)
			 		alert("not added yet");
			 	var userItem = document.createElement("menuitem");
			 	userItem.setAttribute("id","nova_initia_user_menu_"+theUser);
			 	userItem.setAttribute("label",theUser);
			 	userItem.setAttribute("insertbefore","nova_initia_user_menu_separator");
			 	userItem.setAttribute("oncommand","NovaInitia.Toolbar.process_login(this,false,'"+theUser+"',true)");
				user_menu_popup.insertBefore(userItem,user_menu_separator);
				user_array[user_array.length]=theUser;
			}
		};
		
		this.remove_user_menuitem = function(theUser)
		{
			var userItem = document.getElementById("nova_initia_user_menu_"+theUser);
			user_menu_popup.removeChild(userItem);
		};
		
		/* returns trus if theItem is in theArray, false otherwise */
		this.inArray = function(theArray,theItem)
		{
			for(var i=0;i<theArray.length;i++)
			{
				if(theArray[i] == theItem)
					return true;
			}
			return false;
		};
		
		/* set the orientation of the text to the toolbutton icon images */
		this.set_toolbutton_orient = function(theOrient)
		{
			//alert("theOrient: "+theOrient);
		 	//if(theOrient=="horizontal"||theOrient=="vertical")
		 	//{
				var i=0;
				while(toolbutton_elements[i])
				{
					if(theOrient)
						toolbutton_elements[i].orient="vertical";
					else
						toolbutton_elements[i].orient="horizontal";
					i++;
					if(!toolbutton_elements[i])
						break;
				}
			//}
		};
		
		/* Grab all tool information from server and set all corresponding internal vars */
		this.initialize_tools = function(theRes)
		{
		 	if(ni.debug_set)
			{
		 		alert("initialize tools");
			 	alert("status: "+theRes.status);
				alert("responseText: "+theRes.responseText);
			}
			//alert("responseText: "+theRes.responseText);
			if(theRes.status==200)
			{
				var tmp_tool_res = ni.JSON.parse(theRes.responseText);
				var i=0;
				while(tmp_tool_res.toolSet[i])
				{
				 	if(ni.debug_set)
						alert("processing tool: "+tmp_tool_res.toolSet[i].NAME);
					switch(tmp_tool_res.toolSet[i].NAME)
					{
						case 'Trap':
							trap_tool_id = tmp_tool_res.toolSet[i].ID;
							trap_tool_cost = tmp_tool_res.toolSet[i].COST;
							var tmp_array = [trap_panel,trap_panel_label];
							tool_array[Number(trap_tool_id)] = tmp_array;
							break;
						case 'Barrel':
							barrel_tool_id = tmp_tool_res.toolSet[i].ID;
							barrel_tool_cost = tmp_tool_res.toolSet[i].COST;
							var tmp_array = [barrel_panel,barrel_panel_label];
							tool_array[Number(barrel_tool_id)] = tmp_array;
							break;
						case 'Spider':
							spider_tool_id = tmp_tool_res.toolSet[i].ID;
							spider_tool_cost = tmp_tool_res.toolSet[i].COST;
							tool_array[spider_tool_id] = [spider_panel,spider_panel_label];
							break;
						case 'Shield':
							shield_tool_id = tmp_tool_res.toolSet[i].ID;
							shield_tool_cost = tmp_tool_res.toolSet[i].COST;
							tool_array[shield_tool_id] = [shield_panel,shield_panel_label];
							break;
						case 'Doorway':
							doorway_tool_id = tmp_tool_res.toolSet[i].ID;
							doorway_tool_cost = tmp_tool_res.toolSet[i].COST;
							var tmp_array = [doorway_panel,doorway_panel_label];
							tool_array[Number(doorway_tool_id)] = tmp_array;
							break;
						case 'Signpost':
							signpost_tool_id = tmp_tool_res.toolSet[i].ID;
							signpost_tool_cost = tmp_tool_res.toolSet[i].COST;
							var tmp_array = [signpost_panel,signpost_panel_user_label];
							tool_array[Number(signpost_tool_id)] = tmp_array;
							break;
					}
					i++;
				}
				NovaInitia.Toolbar.sync_user();
			}
			else
				alert("Server Error, please contact suppport (Code: -200)");
		};
		
		/********** - Panel Display Functions - **********/
		
		/* open an event panel */
		this.set_panel_open = function(thePanel)
		{
			ni.jQuery(thePanel).attr("open","true");
			switch(thePanel.id)
			{
				case 'nova_initia_doorway_panel_end':
					doorway_end_panel_open=true;
					ni.panels_open=true;
					break;
				case 'nova_initia_trap_panel':
					trap_panel_open=true;
					ni.panels_open=true;
					break;
				case 'nova_initia_signpost_panel':
					signpost_panel_open=true;
					ni.panels_open=true;
					break;
				case 'nova_initia_doorway_panel':
					doorway_panel_open=true;
					ni.panels_open=true;
					break;
				case 'nova_initia_barrel_panel':
					barrel_panel_open=true;
					ni.panels_open=true;
					break;
				case 'nova_initia_tool_barrel_loot_panel_popup':
					open_barrel_panel_open=true;
					ni.panels_open=true;
					break;
				case 'nova_initia_spider_panel':
					spider_panel_open=true;
					ni.panels_open=true;
					break;
				case 'nova_initia_tour_start_panel':
					tour_start_panel_open=true;
					ni.panels_open=true;
					break;
				case 'nova_initia_tour_panel':
					tour_panel_open=true;
					ni.panels_open=true;
					break;
				case 'nova_initia_shield_panel':
					shield_panel_open=true;
					ni.panels_open=true;
					break;
				case 'nova_initia_fail_panel':
					fail_panel_open=true;
					ni.panels_open=true;
					break;
				case 'nova_initia_random_panel':
					random_panel_open=true;
					ni.panels_open=true;
					break;
			}
		};
		
		/* find all open event panels and return the eobjects in an array */
		this.get_open_panels = function()
		{
		 	if(ni.panels_open)
		 	{
				var openPanels = ni.jQuery(".nova_initia_panel_class[open='true']").get();
				/*
				var i=0;
				
				if(doorway_end_panel_open)
					openPanels.push(doorway_end_panel);
				if(trap_panel_open)
					openPanels.push(trap_panel);
				if(barrel_panel_open)
					openPanels.push(barrel_panel);
				if(open_barrel_panel_open)
					openPanels.push(open_barrel_panel);
				if(doorway_panel_open)
					openPanels.push(doorway_panel);
				if(signpost_panel_open)
					openPanels.push(signpost_panel);
				if(spider_panel_open)
					openPanels.push(spider_panel);
				if(shield_panel_open)
					openPanels.push(shield_panel);
				if(tour_panel_open)
					openPanels.push(tour_panel);
				if(tour_start_panel_open)
					openPanels.push(tour_start_panel);
				if(fail_panel_open)
					openPanels.push(fail_panel);
				*/
				
				if(openPanels.length>0)
					return openPanels;
				else
					return false;
			}
			return false;
		};
	
		/* Calculate and display the event panels */
		this.show_panel = function(thePanels)
		{
			var lastPanel = this.getAnchor();
			var openPanels = this.get_open_panels();
			
		 	//this.dismiss_all_panels();
			var setX = gBrowser.boxObject.screenX;
			var setY = gBrowser.boxObject.screenY;
			//var setY = window.screenY + (window.content.outerHeight-window.content.innerHeight);
			//var setX = window.screenX + (window.content.outerWidth-window.content.innerWidth);
		 	if(ni.debug_set)
		 		alert("is array: "+this.isArray(thePanels));
		 	if(this.isArray(thePanels))
		 	{
				var i = 0;
				var tmpHeight = 0;
				
				while(thePanels[i])
				{
					this.set_panel_open(thePanels[i]);
					var tmpSetY = setY+(i*52);
					var tmpSetY = setY+(tmpHeight);
					thePanels[i].openPopup(lastPanel,"after_end",0,0,false,false);
					//lastPanel = thePanels[i];
					//thePanels[i].openPopupAtScreen(setX,tmpSetY,false);
					this.toggleTextAndButtons(thePanels[i]);
					ni.panels_open=true;
					switch(thePanels[i].id)
					{
						case 'nova_initia_doorway_panel_end':
							tmpHeight+=175;
							break;
						case 'nova_initia_shield_panel':
							tmpHeight+=202;
							break;
						case 'nova_initia_fail_panel':
							tmpHeight+=202;
							break;
						case 'nova_initia_random_panel':
							tmpHeight+=202;
							break;
						case 'nova_initia_trap_panel':
							tmpHeight+=202;
							break;
						case 'nova_initia_signpost_panel':
							tmpHeight+=202;
							break;
						case 'nova_initia_doorway_panel':
							tmpHeight+=216;
							break;
						case 'nova_initia_barrel_panel':
							tmpHeight+=202;
							break;
						case 'nova_initia_tool_barrel_loot_panel_popup':
							tmpHeight+=255;
							break;
						case 'nova_initia_spider_panel':
							tmpHeight+=202;
							break;
						case 'nova_initia_tour_panel':
							tmpHeight+=202;
							break;
						case 'nova_initia_tour_start_panel':
							tmpHeight+=202;
							break;
					}
					i++;	
				}
			}
			else
			{
			 	this.set_panel_open(thePanels);
				thePanels.openPopup(lastPanel,"after_end",0,0,false,false);
				//thePanels.openPopupAtScreen(setX,setY,false);
				this.toggleTextAndButtons(thePanels);
				ni.panels_open=true;

			}
		};
		
		this.getAnchor = function()
		{
			var anchor = null;
			var panelSet = ni.jQuery("#mainPopupSet>.nova_initia_panel_class[open=true]");
			var attachTo = null;
			panelSet.each(function(){
				if(anchor == null || anchor.boxObject.Y + anchor.boxObject.height < this.boxObject.Y + this.boxObject.height)
					anchor = this;
			});
			
			attachTo = ni.jQuery('#navigator-toolbox').get(0);
			
			if(anchor!=null){
			
				attachTo = anchor;
			}
			
			return attachTo;
		};
		
		/* dismiss all open event panels */
		this.dismiss_all_panels = function()
		{
			var thePanels = this.get_open_panels();
			if(thePanels)
			{
				var i=0
				while(thePanels[i])
				{
					this.dismiss_panel(thePanels[i].id);
					i++;
				}
			}
		};
		
		/* Sets the about panel information and opens the panel */
		this.show_about_panel = function(theBrowserObj,thePanel,theVersionLabel)
		{
			var currentVer;
			if(typeof(AddonManager) != "undefined")
			{
				AddonManager.getAddonByID("nova-initia@nova-initia.com",function(aAddon) {
					currentVer = aAddon.version;
					theVersionLabel.value="Version: "+currentVer;
					thePanel.openPopup(theBrowserObj,'before_start',0,0,false,false);
				});
			} else {
				currentVer = ni.extensionManager.getItemForID("nova-initia@nova-initia.com").version;
				theVersionLabel.value="Version: "+currentVer;
				thePanel.openPopup(theBrowserObj,'before_start',0,0,false,false);			}
		};
		
		/* dismiss an event panel and reposition the others */
		this.dismiss_panel = function(thePanel,doorwayArrayPos,sendToServer)
		{
			thePanelId = thePanel.indexOf("#")>-1 ? thePanel : "#"+thePanel;
			var disabledButtons = parent.document.querySelector(thePanelId+"_buttons>button");
			if(disabledButtons)
				disabledButtons.removeAttribute("noshow");
		 	if(ni.debug_set)
		 		alert("Dismissing panel: "+thePanel);
			ni.jQuery(thePanelId).attr("open","false");
			switch(thePanel)
			{
			 	case 'nova_initia_doorway_panel_end':
			 		doorway_end_panel_open=false;
			 		doorway_end_panel.hidePopup();
					if(!this.get_open_panels())
						ni.panels_open=false;
					break;
				case 'nova_initia_trap_panel':
					trap_panel_open=false;
					trap_panel.hidePopup();
					if(!this.get_open_panels())
						ni.panels_open=false;
					break;
				case 'nova_initia_signpost_panel':
					if(last_tour_ID&&sendToServer)
					{
					 	var trackURL = "http://"+url_prefix+server_url+"/rf/remog/group/"+last_tour_ID+"/dismiss.json";
					 	last_tour_ID = "";
						this.send_request(trackURL,"PUT",null,true,this.process_dismiss_panel,false,null);
					}

					signpost_panel_open=false;
					signpost_panel.hidePopup();
					if(!this.get_open_panels())
						ni.panels_open=false;
					break;
				case 'nova_initia_doorway_panel':
					if(undefined===doorwayArrayPos)
					{
						doorway_panel_open=false;
						doorway_panel.hidePopup();
					}
					else
					{
						//alert("doorway pos"+doorwayArrayPos);
						var theID = doorway_carousel_array[doorwayArrayPos][0];
					 	var trackURL = "http://"+url_prefix+server_url+"/rf/remog/doorway/"+theID+"/dismiss.json";
						this.send_request(trackURL,"PUT",null,true,this.process_dismiss_panel,false);
						if(doorwayArrayPos==0)
						{
							//alert(doorway_carousel_array.length);
							if(doorway_carousel_array.length>1)
							{
								doorway_carousel_array = doorway_carousel_array.slice(1);
								this.setup_doorways(0);
								//this.doorway_carousel_load_more();
							}
							else
							{
								doorway_panel_open=false;
								doorway_panel.hidePopup();
							}
						}
						else
						{
							if(doorway_carousel_array[doorwayArrayPos+1])
							{
								var tmpArr = doorway_carousel_array.slice(doorwayArrayPos+1);
								doorway_carousel_array = doorway_carousel_array.slice(0,doorwayArrayPos);
								doorway_carousel_array = doorway_carousel_array.concat(tmpArr);
							}
							else
								doorway_carousel_array = doorway_carousel_array.slice(0,doorwayArrayPos);
							this.setup_doorways(doorwayArrayPos-1);
							//this.doorway_carousel_load_more();
						}
					}
					if(!this.get_open_panels())
						ni.panels_open=false;
					break;
				case 'nova_initia_barrel_panel':
					if(last_barrel_ID&&sendToServer)
					{
					 	var trackURL = "http://"+url_prefix+server_url+"/rf/remog/gift/"+last_barrel_ID+"/dismiss.json";
					 	last_barrel_ID = "";
						this.send_request(trackURL,"PUT",null,true,this.process_dismiss_panel,false,null);
					}
					barrel_panel_open=false;
					barrel_panel.hidePopup();
					if(!this.get_open_panels())
						ni.panels_open=false;
					break;
				case 'nova_initia_spider_panel':
					spider_panel_open=false;
					spider_panel.hidePopup();
					if(!this.get_open_panels())
						ni.panels_open=false;
					break;
				case 'nova_initia_tour_panel':
					tour_panel_open=false;
					tour_panel.hidePopup();
					if(!this.get_open_panels())
						ni.panels_open=false;
					break;
				case 'nova_initia_tour_start_panel':
					tour_start_panel_open=false;
					tour_start_panel.hidePopup();
					if(!this.get_open_panels())
						ni.panels_open=false;
					break;
				case 'nova_initia_tool_barrel_loot_panel_popup':
					open_barrel_panel_open=false;
					open_barrel_panel.hidePopup();
					if(!this.get_open_panels())
						ni.panels_open=false;
					break;
				case 'nova_initia_fail_panel':
					fail_panel_open=false;
					fail_panel.hidePopup();
					if(!this.get_open_panels())
						ni.panels_open=false;
					break;
				case 'nova_initia_random_panel':
					random_panel_open=false;
					random_panel.hidePopup();
					if(!this.get_open_panels())
						ni.panels_open=false;
					break;
			}
			
		};
		
		this.process_dismiss_panel = function(theRes)
		{
			// JSON decode
			if(theRes.status==200)
			{
				var tmpDismissResponse = ni.JSON.parse(theRes.responseText);
				if(ni.debug_set)
				{
				 	alert("dismiss_panel status: "+theRes.status);
					alert("dismiss_panel responseText: "+theRes.responseText);
					if(tmpDismissResponse.error)
						this.send_notification("Failed to Dismiss: "+tmpDismissResponse.error+"!","PRIORITY_INFO_LOW");
					if(tmpDismissResponse.result)
					{
						this.send_notification("Successfully Dismissed!","PRIORITY_INFO_LOW");
					}
				}
			}
			else
				this.send_notification("Dismiss received bad server response!","PRIORITY_INFO_LOW");
		};
		
		/* gets called by the window resize event listener or other panel functions that need to reposition the panels */
		this.window_resized = function()
		{
			var openPanels = NovaInitia.Toolbar.get_open_panels();
			if(openPanels) {
				ni.jQuery(openPanels).each(function(){this.hidePopup();});
				NovaInitia.Toolbar.show_panel(openPanels);
			}
		};
		
		this.new_message = function(recipient) {
			ni.jQuery('#nova_initia_mail_receiver')[0].value = ni.jQuery(recipient)[0].value;
			ni.jQuery('#nova_initia_mail_panel_popup')[0].openPopup(NovaInitia.Toolbar.getAnchor(),'after_end',0,0,null,null);
		};
	
		this.openTab = function(theURL,register)
		{
			ni.tBrowser=top.document.getElementById("content");
			if(register)
				ni.tab=ni.tBrowser.addTab("http://www."+server_url+"/register.php");
			else
				ni.tab=ni.tBrowser.addTab(theURL);
			ni.tBrowser.selectedTab=ni.tab;
		};
		
		/* redirects the current tab to a new URL, sets up necessary info if the redirection if from 'stepping through' a doorway */
		this.redirect_to = function(theURL,theDoorwayID,theUser,theTourID,theGroupID)
		{
			NovaInitia.Toolbar.showThrobber();
			//var mainWindow = window.QueryInterface(Components.interfaces.nsIInterfaceRequestor).getInterface(Components.interfaces.nsIWebNavigation).QueryInterface(Components.interfaces.nsIDocShellTreeItem).rootTreeItem.QueryInterface(Components.interfaces.nsIInterfaceRequestor).getInterface(Components.interfaces.nsIDOMWindow);
			//mainWindow.gBrowser.loadURI(theURL);
			if(theDoorwayID)
			{
			 	var doorway_cached = doorway_cache.get(theDoorwayID);
			 	var tmp_doorway = null;
				
				function doorway_loaded(tmp_doorway)
				{
					if(tmp_doorway)
					{
						var tmpDoorwayInfo = ni.JSON.parse(tmp_doorway);
						if(tmpDoorwayInfo.doorway.Url)
						{
							took_doorway = true;
							last_doorwayID = theDoorwayID;
							last_doorway_user = theUser;
							openUILink(ni.urldecode(tmpDoorwayInfo.doorway.Url));
						}
					}
				}
				
			 	/*if(doorway_cached)
			 	{
					//doorway was cached doorway_cached[theDoorwayID] is the JSON
					tmp_doorway = doorway_cached[theDoorwayID];
					doorway_loaded(tmp_doorway);
				}
				else
				{*/	
					function doorway_request_finished(doorwayReq)
					{
						if(ni.debug_set)
							alert(doorwayReq.status+" | "+doorwayReq.responseText);
						if(doorwayReq.status==200)
						{
							tmp_doorway = doorwayReq.responseText;
							doorway_cache.add(theDoorwayID,doorwayReq.responseText);
						}
						else
							this.send_notification("Bad response looking up doorway information","PRIORITY_CRITICAL_HIGH");
						
						doorway_loaded(tmp_doorway);
	
						NovaInitia.Toolbar.hideThrobber();
					}
					
					NovaInitia.Toolbar.send_request("http://"+url_prefix+server_url+"/rf/remog/doorway/"+theDoorwayID+".json","GET",null,true,doorway_request_finished,false,null);
				//}
			}
			else if(theTourID)
			{
				if(at_tour_start)
				{
					tour_path_info = new Array(new Array(0,cur_url));
				}
				at_tour_start=false;
				in_a_tour=true;
				prev_signpost_ID = cur_signpost_ID;
				cur_signpost_ID = theTourID;
				if(theURL)
				{
					//cur_tour_info = new Array(theTourID,theURL);
					if(theGroupID)
						cur_tour_group_ID = theGroupID;
					tour_path_info.push(new Array(cur_signpost_ID,theURL));
					openUILink(ni.urldecode(theURL));
				}
				else
				{
				 	var signpost_cached = signpost_cache.get(theTourID);
				 	var tmp_signpost = null;
					function signpost_loaded(tmp_signpost)
					{
						if(tmp_signpost)
						{
							var tmpSignpostInfo = ni.JSON.parse(tmp_signpost);
							//cur_tour_info = new Array(theTourID,ni.urldecode(tmpSignpostInfo.signpost.Url));
							cur_tour_group_ID = tmpSignpostInfo.signpost.GroupID;
							tour_path_info.push(new Array(cur_signpost_ID,tmpSignpostInfo.signpost.Url));
							openUILink(ni.urldecode(tmpSignpostInfo.signpost.Url));
						}
						
						NovaInitia.Toolbar.hideThrobber();
					}
	
				 	if(signpost_cached)
				 	{
						//doorway was cached doorway_cached[theDoorwayID] is the JSON
						tmp_signpost = signpost_cached[theTourID];
						signpost_loaded(tmp_signpost);
					}
					else
					{
						var tmpURL = "http://"+url_prefix+server_url+"/rf/remog/signpost/"+theTourID+".json?LASTKEY="+current_key;
	
						function signpost_request_finished(signpostReq)
						{
							if(ni.debug_set)
								alert("signpost req: "+signpostReq.status+" | "+signpostReq.responseText);
							if(signpostReq.status==200)
							{
								tmp_signpost = signpostReq.responseText;
								signpost_cache.add(theTourID,signpostReq.responseText);
							}
							else
								this.send_notification("Bad response looking up signpost information","PRIORITY_CRITICAL_HIGH");
								
							signpost_loaded(tmp_signpost)
						}
						
						NovaInitia.Toolbar.send_request(tmpURL,"GET",null,true,signpost_request_finished,false,null);
					}
				}
				
			}
			else
			{
				openUILink(theURL);
				NovaInitia.Toolbar.hideThrobber();
			}
		};
		
		/* Sets all of the user info from the JSON response
		*/
		this.set_user_info = function()
		{
		 	user_name = user_JSON.user.UserName;
		 	ni.prefManager.setCharPref("extensions.nova-initia.cur_username",user_name);
		 	ni.prefManager.setCharPref("extensions.nova-initia.cur_ava_url",user_JSON.user.AvatarUrl);
		 	ni.prefManager.setCharPref("extensions.nova-initia.cur_tagline",user_JSON.user.TagLine);
		 	ni.prefManager.setCharPref("extensions.nova-initia.cur_email",user_JSON.user.Email);
		 	ni.prefManager.setCharPref("extensions.nova-initia.cur_location",user_JSON.user.Location);
		 	ni.prefManager.setCharPref("extensions.nova-initia.cur_class",user_JSON.user.Class);
		 	ni.prefManager.setCharPref("extensions.nova-initia.cur_id",user_JSON.user.ID);
		 	ni.prefManager.setCharPref("extensions.nova-initia.cur_hash",user_JSON.user.LastKey);
			NovaInitia.Toolbar.set_user_shield(user_JSON.user.isShielded);
			sg_tool_amount = user_JSON.user['Sg'];
			if(ni.debug_set)
				alert(trap_tool_id+"|"+barrel_tool_id+"|"+spider_tool_id+"|"+shield_tool_id+"|"+doorway_tool_id+"|"+signpost_tool_id);
		 	var tool0name = "Tool"+trap_tool_id;
		 	trap_tool_amount = user_JSON.user[tool0name];
		 	if(trap_tool_amount=="")
		 		trap_tool_amount = 0;
		 	var tool1name = "Tool"+barrel_tool_id;
		 	barrel_tool_amount = user_JSON.user[tool1name];
		 	if(barrel_tool_amount=="")
		 		barrel_tool_amount = 0;
		 	var tool2name = "Tool"+spider_tool_id;
		 	spider_tool_amount = user_JSON.user[tool2name];
			if(spider_tool_amount=="")
		 		spider_tool_amount = 0;
		 	var tool3name = "Tool"+shield_tool_id;
		 	shield_tool_amount = user_JSON.user[tool3name];
		 	if(shield_tool_amount=="")
		 		shield_tool_amount = 0;
		 	var tool4name = "Tool"+doorway_tool_id;
		 	doorway_tool_amount = user_JSON.user[tool4name];
		 	if(doorway_tool_amount=="")
		 		doorway_tool_amount = 0;
		 	var tool5name = "Tool"+signpost_tool_id;
		 	//alert("signpost tool amount"+user_JSON.user[tool5name]);
		 	signpost_tool_amount = user_JSON.user[tool5name];
		 	if(signpost_tool_amount=="")
		 		signpost_tool_amount = 0;
				
		 	NovaInitia.Toolbar.set_user_tool_amounts();
		};
		
		this.server_sync = function()
		{
		/*
			NovaInitia.DNode({
				call_sync : function(msg){ NovaInitia.Toolbar.sync_user();}
			}).connect("www.nova-initia.com:8080", function (remote) {
				remote.SyncUser();
			});
		*/
		};
		
		/* Sets the toolbutton labels with the current amounts */
		this.set_user_tool_amounts = function()
		{
			if(trap_toolbar_button)
				trap_toolbar_button.label = trap_tool_amount;
			if(barrel_toolbar_button)
				barrel_toolbar_button.label = barrel_tool_amount;
			if(spider_toolbar_button)
				spider_toolbar_button.label = spider_tool_amount;
			if(shield_toolbar_button)
			{
				shield_toolbar_button.label = shield_tool_amount;
				//alert(shield_tool_amount);
			}
			if(doorway_toolbar_button)
				doorway_toolbar_button.label = doorway_tool_amount;
			if(signpost_toolbar_button)
				signpost_toolbar_button.label = signpost_tool_amount;
			if(sg_toolbar_button)
			{
			 	//alert("set Sg to: "+sg_tool_amount);
				sg_toolbar_button.label = sg_tool_amount;
			}
		};
		
		/* Set the user's shield status
		*  theHits is the number of hits left in the current shield
		*/
		this.set_user_shield = function(theHits)
		{
	 		var tmpShield = parseInt(theHits,10);
	 	 	if(tmpShield!=0)
	 	 	{
	 	 		shield_hits_left = tmpShield;
	 	 		if(ni.debug_set)
		 	 		alert(shield_hits_left);
	 	 		if(shield_toolbar_button)
	 	 		{
	 	 	 		shield_toolbar_button.image = "chrome://nova-initia_toolbar/skin/images/icons/shield.ico";
	 	 	 	}
			}
			else
			{
				shield_hits_left = 0;
			 	if(shield_toolbar_button)
			 	{
	 	 	 		shield_toolbar_button.image = "chrome://nova-initia_toolbar/skin/images/icons/no-shield.ico";
		 	 	}
			}
		};
		
		/* processes a shield hit */
		this.shield_hit = function(sendNotifications,destroyShield)
		{
			if(shield_hits_left>0)
			{
				if(destroyShield)
				{
					shield_hits_left=0;
					if(shield_toolbar_button)
			 	 		shield_toolbar_button.image = "chrome://nova-initia_toolbar/skin/images/icons/no-shield.ico";
			 	 	if(sendNotifications)
					{
						shield_panel_image.src = "chrome://nova-initia_toolbar/skin/images/overlays/shield_destroyed.jpg";
					 	NovaInitia.Toolbar.show_panel(trap_panel);
						shieldTimeout = this.autoClose(shieldTimeout,"nova_initia_trap_panel", 3000);
					}
						
				}
				else
				{
					shield_hits_left--;
					if(ni.debug_set)
						alert("shield left: "+shield_hits_left);
					if(shield_hits_left==0)
					{
						trap_panel_image.src = "chrome://nova-initia_toolbar/skin/images/overlays/shield_destroyed.jpg";
						if(shield_toolbar_button)
				 	 		shield_toolbar_button.image = "chrome://nova-initia_toolbar/skin/images/icons/no-shield.ico";
				 	 	//if(sendNotifications)
						 //	this.send_notification("Shield Used Up!","PRIORITY_INFO_LOW");
						NovaInitia.Toolbar.show_panel(trap_panel);
						trapTimeout = this.autoClose(trapTimeout,"nova_initia_trap_panel", 3000);
					}
					else
					{
						trap_panel_image.src = "chrome://nova-initia_toolbar/skin/images/overlays/shield_triggered.jpg";
						/*if(sendNotifications)
							this.send_notification("Shield Used!","PRIORITY_INFO_LOW");
						*/
					}
				}
			}
			else
			{
				if(ni.debug_set)	
					alert("Trap Sprung Without A Shield!");
				if(shield_toolbar_button)
		 	 		shield_toolbar_button.image = "chrome://nova-initia_toolbar/skin/images/icons/no-shield.ico";
		 	 	//if(sendNotifications)
				 	//this.send_notification("Trap Sprung Without A Shield!","PRIORITY_INFO_LOW");
				trap_panel_image.src = "chrome://nova-initia_toolbar/skin/images/overlays/trap_triggered.png";
			}
		};
		
		/* called when barrel or doorway toolbar button is pressed
		*  disables the Stash/Open button if user is currently at an invalid page
		*/
		this.try_popup = function(theButton,thePanel)
		{
			if(at_a_page == true)
			{
				theButton.disabled=false;
				thePanel.focus();
			}
			else
			{
				theButton.disabled=true;
			}
			if(thePanel.id=="nova_initia_tool_doorway_panel_popup")
			{
				if(last_doorwayID)
				{
					var doorway_cached = doorway_cache.get(last_doorwayID);
				 	if(doorway_cached)
				 	{
						var tmp_doorway = doorway_cached[last_doorwayID];
						var tmpDoorwayInfo = ni.JSON.parse(tmp_doorway);
						if(tmpDoorwayInfo.doorway.NextID)
						{
							if(tmpDoorwayInfo.doorway.NextID=="0")
							{
								doorway_popup_panel_add_to_checkbox.disabled=false;
								doorway_popup_panel_add_to_checkbox.checked=false;
							}
						}
					}
				}
				else
				{
					doorway_popup_panel_add_to_checkbox.disabled=true;
					doorway_popup_panel_add_to_checkbox.checked=false;
				}
			}
			if(thePanel.id=="nova_initia_tool_barrel_panel_popup_top"||thePanel.id=="nova_initia_tool_barrel_panel_popup")
			{
				if(user_JSON.user.Class!=class_giver_ID)
				{
					stash_barrel_sg_textbox.value="0";
					stash_barrel_sg_textbox.disabled=true;
					stash_barrel_label_textbox.disabled=true;
				}
				else
				{
					stash_barrel_sg_textbox.disabled=false;
					if(user_JSON.user.LevelClass1>4)
					{
						stash_barrel_label_textbox.disabled=false;
					} else {
						stash_barrel_label_textbox.disabled=true;
					}
				}
			}
		};
		
		/* Validate that barrel contents are within bounds (not all 0 and no more than current inventory allows) and send request to stash */
		this.stash_barrel = function()
		{
		 	var proceed = true;
			
			stash_barrel_sg_image.hidden=true;
			stash_barrel_traps_image.hidden=true;
			stash_barrel_barrels_image.hidden=true;
			stash_barrel_spiders_image.hidden=true;
			stash_barrel_shields_image.hidden=true;
			stash_barrel_doorways_image.hidden=true;
			stash_barrel_signposts_image.hidden=true;
			
			var limit = user_JSON.user.Class==class_giver_ID ? 100 : 10;
			if (((Number(stash_barrel_sg_textbox.value)/10)
				+Number(stash_barrel_traps_textbox.value)
				+Number(stash_barrel_barrels_textbox.value)
				+Number(stash_barrel_spiders_textbox.value)
				+Number(stash_barrel_shields_textbox.value)
				+Number(stash_barrel_doorways_textbox.value)
				+Number(stash_barrel_signposts_textbox.value)) > limit)
			{				
				stash_barrel_sg_image.hidden=false;
				stash_barrel_traps_image.hidden=false;
				stash_barrel_barrels_image.hidden=false;
				stash_barrel_spiders_image.hidden=false;
				stash_barrel_shields_image.hidden=false;
				stash_barrel_doorways_image.hidden=false;
				stash_barrel_signposts_image.hidden=false;
			}
			if(Number(stash_barrel_sg_textbox.value)>sg_tool_amount)
			{
				proceed = false;
				if(ni.debug_set)
					alert("Not enough sg");
				stash_barrel_sg_image.hidden=false;
			}

			if(Number(stash_barrel_traps_textbox.value)>trap_tool_amount)
			{
				proceed = false;
				if(ni.debug_set)
					alert("Not enough Traps");
				stash_barrel_traps_image.hidden=false;
			}

			if((Number(stash_barrel_barrels_textbox.value)+1)>barrel_tool_amount)
			{
				proceed = false;
				if(ni.debug_set)
					alert("Not enough Barrels");
				stash_barrel_barrels_image.hidden=false;
			}

			if(Number(stash_barrel_spiders_textbox.value)>spider_tool_amount)
			{
				proceed = false;
				if(ni.debug_set)
					alert("Not enough Spiders");
				stash_barrel_spiders_image.hidden=false;
			}

			if(Number(stash_barrel_shields_textbox.value)>shield_tool_amount)
			{
				proceed = false;
				if(ni.debug_set)
					alert("Not enough Shields");
				stash_barrel_shields_image.hidden=false;
			}

			if(Number(stash_barrel_doorways_textbox.value)>doorway_tool_amount)
			{
				proceed = false;
				if(ni.debug_set)
					alert("Not enough Doorways");
				stash_barrel_doorways_image.hidden=false;
			}

			if(Number(stash_barrel_signposts_textbox.value)>signpost_tool_amount)
			{
				proceed = false;
				if(ni.debug_set)
					alert("Not enough Signposts");
				stash_barrel_signposts_image.hidden=false;
			}

			if(Number(stash_barrel_traps_textbox.value)==0&&Number(stash_barrel_barrels_textbox.value)==0&&Number(stash_barrel_spiders_textbox.value)==0&&Number(stash_barrel_shields_textbox.value)==0&&Number(stash_barrel_doorways_textbox.value)==0&&Number(stash_barrel_signposts_textbox.value)==0&&Number(stash_barrel_sg_textbox.value)==0)
			{
				stash_barrel_panel.hidePopup();
				proceed=false;
				this.send_notification("Cannot Stash Empty Barrels","PRIORITY_INFO_HIGH");
			}
			if(proceed)
			{
				var theParams = {
									"Comment" : ni.urlencode(stash_barrel_message_textbox.value),
									"Tool0" : stash_barrel_traps_textbox.value,
									"Tool1" : stash_barrel_barrels_textbox.value,
									"Tool2" : stash_barrel_spiders_textbox.value,
									"Tool3" : stash_barrel_shields_textbox.value,
									"Tool4" : stash_barrel_doorways_textbox.value,
									"Tool5"	: stash_barrel_signposts_textbox.value,
									"Sg" : stash_barrel_sg_textbox.value
								};
				
				NovaInitia.Toolbar.send_request("http://"+url_prefix+server_url+"/rf/remog/page/"+cur_url_hash+"/"+cur_domain_hash+"/"+barrel_tool_id+".json","POST",JSON.stringify(theParams),true,NovaInitia.Toolbar.process_barrel_stash,false,null);
				if(ni.debug_set)
				{
					alert("http://"+url_prefix+server_url+"/rf/remog/page/"+cur_url_hash+"/"+cur_domain_hash+"/"+barrel_tool_id+".json");
				 	alert(theParams);
				}
			}
		};
		
		/* Check the status of the barrel stash reply */
		this.process_barrel_stash = function(theRes)
		{
		 	if(ni.debug_set)
			{
		 		alert("Process Barrel Stash");
			 	alert("status: "+theRes.status);
				alert("responseText: "+theRes.responseText);
			}
			if(theRes.status==201 || theRes.status==200)
			{
				NovaInitia.Toolbar.check_tool_set(theRes,barrel_tool_id);
				var tmpBarrelInfo = ni.JSON.parse(theRes.responseText);
				if(tmpBarrelInfo.error)
					this.send_notification("Barrel Stash received a bad response!","PRIORITY_INFO_HIGH");
			} else { 
				this.send_notification("Barrel Stash received a bad response!","PRIORITY_INFO_HIGH");
			}
		};
		
		/* Setup and send request to open a barrel with barrelID */
		this.open_barrel = function(barrelID,theUser)
		{
			temporary_tool_user = theUser;
			if(ni.debug_set)
			{
				alert("open: "+barrelID);
				alert("http://"+url_prefix+server_url+"/rf/remog/gift/"+barrelID+".json");
			}
			NovaInitia.Toolbar.send_request("http://"+url_prefix+server_url+"/rf/remog/gift/"+barrelID+".json","GET",null,true,NovaInitia.Toolbar.process_barrel_open,false,null);
		};
		
		/* Process the reply from the barrel open request */
		this.process_barrel_open = function(theRes)
		{
			
		 	if(ni.debug_set)
			{
		 		alert("Process Barrel Open");
			 	alert("status: "+theRes.status);
				alert("responseText: "+theRes.responseText);
			}
			if(theRes.status==200)
			{
				var tmp_barrel_open_res = ni.JSON.parse(theRes.responseText);
				if(tmp_barrel_open_res.error)
				{
					this.send_notification("Error: "+tmp_barrel_open_res.error,"PRIORITY_INFO_HIGH");
				}
				else if(tmp_barrel_open_res.gift)
				{
					if(tmp_barrel_open_res.gift.ID)
					{
						if(ni.debug_set)
			 			 	alert("message: "+tmp_barrel_open_res.gift.Comment+" | Traps: "+tmp_barrel_open_res.gift.Tool0+" | Barrels: "+tmp_barrel_open_res.gift.Tool1+" | Spiders: "+tmp_barrel_open_res.gift.Tool2+" | Shields: "+tmp_barrel_open_res.gift.Tool3+" | Doorways: "+tmp_barrel_open_res.gift.Tool4+" | Signposts: "+tmp_barrel_open_res.gift.Tool5);
					 	open_barrel_label.value = "Loot Retrieved from "+temporary_tool_user+"'s Barrel:";
						open_barrel_sg_label.value = tmp_barrel_open_res.gift.Sg;
						open_barrel_traps_label.value = tmp_barrel_open_res.gift.Tool0;
						open_barrel_barrels_label.value = tmp_barrel_open_res.gift.Tool1;
						open_barrel_spiders_label.value = tmp_barrel_open_res.gift.Tool2;
						open_barrel_shields_label.value = tmp_barrel_open_res.gift.Tool3;
						open_barrel_doorways_label.value = tmp_barrel_open_res.gift.Tool4;
						open_barrel_signposts_label.value = tmp_barrel_open_res.gift.Tool5;
						open_barrel_message_label.value = tmp_barrel_open_res.gift.Comment;
						//open_barrel_panel.openPopup(barrel_toolbar_button,"after_start",0,0,false,false);
						//open panel
						NovaInitia.Toolbar.show_panel(open_barrel_panel);
					 	sg_tool_amount = Number(sg_tool_amount) + Number(tmp_barrel_open_res.gift.Sg);
					 	trap_tool_amount = Number(trap_tool_amount) + Number(tmp_barrel_open_res.gift.Tool0);
					 	barrel_tool_amount = Number(barrel_tool_amount) + Number(tmp_barrel_open_res.gift.Tool1);
					 	spider_tool_amount = Number(spider_tool_amount) + Number(tmp_barrel_open_res.gift.Tool2);
					 	shield_tool_amount = Number(shield_tool_amount) + Number(tmp_barrel_open_res.gift.Tool3);
					 	doorway_tool_amount = Number(doorway_tool_amount) + Number(tmp_barrel_open_res.gift.Tool4);
					 	signpost_tool_amount = Number(signpost_tool_amount) + Number(tmp_barrel_open_res.gift.Tool5);
					 	NovaInitia.Toolbar.set_user_tool_amounts();
		 			 	//this.send_notification("You Opened "+temporary_tool_user+"'s Barrel","PRIORITY_INFO_LOW");
		 			 	NovaInitia.Toolbar.dismiss_panel('nova_initia_barrel_panel');
			 		}
				}
			}
			else
			{
				this.send_notification("Barrel Open received a bad response!","PRIORITY_INFO_HIGH");
			}
		};
	
		/* opens doorway panel, gathers required info, sends request to server */
		this.open_doorway = function()
		{
			/*
			 	doorway_popup_panel = doorwayPopupPanel;
			 	doorway_popup_panel_URL = doorwayPopupPanelURL;
			 	doorway_popup_panel_hint = doorwayPopupPanelHint;
			 	doorway_popup_panel_comment = doorwayPopupPanelComment;
			 	doorway_popup_panel_URL_image = doorwayPopupPanelURLImage;
			 	doorway_popup_panel_add_to_checkbox = doorwayPopupPanelAddCheckbox;
				doorway_popup_panel_nsfw_checkbox = doorwayPopupPanelNSFWCheckbox;
			*/
			//alert(doorway_popup_panel_add_to_checkbox.checked);
			var proceed=true;
			var theGroupID = "";
			var theParentID = "";
			var doorway_cached = null;
		 	var tmp_doorway = null;
			if(last_doorwayID)
			{
				doorway_cached = doorway_cache.get(last_doorwayID);
			 	if(doorway_cached)
			 	{
					tmp_doorway = doorway_cached[last_doorwayID];
					//alert(tmp_doorway);
					var tmpDoorwayInfo = ni.JSON.parse(tmp_doorway);
					if(tmpDoorwayInfo.doorway.GroupID)
						theGroupID = tmpDoorwayInfo.doorway.GroupID;
				}
			}
			if(doorway_popup_panel_URL.value=="")
			{
				doorway_popup_panel_URL_image.hidden=false;
				proceed=false;
			}
			else
			{
				doorway_popup_panel_URL_image.hidden=true;
			}
			if(proceed)
			{
				var theParams = "Url="+ni.urlencode(doorway_popup_panel_URL.value)+"&Hint="+ni.urlencode(doorway_popup_panel_hint.value)+"&Comment="+ni.urlencode(doorway_popup_panel_comment.value)+"&Home="+ni.urlencode(cur_url)+"&NSFW="+doorway_popup_panel_nsfw_checkbox.checked;
				if(doorway_popup_panel_add_to_checkbox.checked)
				{
					if(theGroupID)
						theParams = theParams+"&GroupID="+theGroupID;
					NovaInitia.Toolbar.send_request("http://"+url_prefix+server_url+"/rf/remog/page/"+cur_url_hash+"/"+cur_domain_hash+"/"+doorway_tool_id+".json","POST",theParams,true,NovaInitia.Toolbar.process_doorway_open,false,theGroupID);
				}
				else
					NovaInitia.Toolbar.send_request("http://"+url_prefix+server_url+"/rf/remog/page/"+cur_url_hash+"/"+cur_domain_hash+"/"+doorway_tool_id+".json","POST",theParams,true,NovaInitia.Toolbar.process_doorway_open,false,null);
				NovaInitia.Toolbar.dismiss_panel('nova_initia_doorway_panel');
				if(ni.debug_set)
				{
					alert("http://"+url_prefix+server_url+"/rf/remog/page/"+cur_url_hash+"/"+cur_domain_hash+"/"+doorway_tool_id+".json");
				 	alert(theParams);
				}
			}
		};
		
		/* processes the response of the doorway open request */
		this.process_doorway_open = function(theRes)
		{
		 	if(ni.debug_set)
			{
		 		alert("Process Doorway Open");
			 	alert("status: "+theRes.status);
				alert("responseText: "+theRes.responseText);
			}
			if(theRes.status==201 || theRes.status==200)
			{
				NovaInitia.Toolbar.check_tool_set(theRes,doorway_tool_id);
			}
			else
			{
				this.send_notification("Doorway Open received a bad response!","PRIORITY_INFO_HIGH");
			}
		};
		
		/* returns the # of doorways in the carousel */
		this.num_of_doorways = function()
		{
			/*var i=0;
			while(doorway_carousel_array[i])
				i++;
			*/
			return doorway_carousel_array.length;
		};
		
		/* sets up the doorway carousel */
		this.setup_doorways = function(thePos)
		{
			if(doorway_carousel_array[thePos])
			{
			 	//doorway_carousel_array[thePos][0] is the ID of the doorway
			 	//doorway_carousel_array[thePos][1] is the user who left the doorway
			 	//doorway_carousel_array[thePos][2] is the hint
			 	if(thePos>0)
			 		doorway_panel_prev_button.disabled=false;
			 	else
			 		doorway_panel_prev_button.disabled=true;
			 	if(doorway_carousel_array[thePos+1])
			 	{
			 		doorway_panel_next_button.disabled=false;
			 		doorway_panel_next_button.label="Next";
		 			doorway_panel_next_button.removeAttribute("oncommand");
					doorway_panel_next_button.setAttribute("oncommand","NovaInitia.Toolbar.doorway_carousel_next()");
			 	}
			 	else
			 	{
			 		//if(NovaInitia.Toolbar.num_of_doorways()>10)
			 		//{
			 			doorway_panel_next_button.removeAttribute("oncommand");
						doorway_panel_next_button.setAttribute("oncommand","NovaInitia.Toolbar.doorway_carousel_load_more()");
				 		doorway_panel_next_button.label="Get More";
				 		//if(NovaInitia.Toolbar.num_of_doorways()%10!=0)
				 			//doorway_panel_next_button.disabled=true;
				 	//}
			 	}
			 	doorway_panel_count.value = Number(thePos+1)+" of "+NovaInitia.Toolbar.num_of_doorways();
				doorway_panel_label.value = doorway_carousel_array[thePos][1];
				doorway_panel_hidden_label.value = doorway_carousel_array[thePos][0];
				//alert(doorway_carousel_array[thePos][0]);
				doorway_panel_hint_label_0.value = doorway_carousel_array[thePos][2].Hint.substring(0,38);
				doorway_panel_hint_label_1.value = doorway_carousel_array[thePos][2].Hint.substring(38,76);
				doorway_panel_hint_label_2.value = doorway_carousel_array[thePos][2].Hint.substring(76,114);
				doorway_panel_profile_button.label = "<< "+doorway_carousel_array[thePos][1]+"'s Profile";
				doorway_panel_profile_button.removeAttribute("oncommand");
				doorway_panel_profile_button.setAttribute("oncommand","gBrowser.selectedTab = gBrowser.addTab('http://www.nova-initia.com/remog/user/"+doorway_carousel_array[thePos][1]+"');");
				if(doorway_carousel_array[thePos][2].GroupID&&doorway_carousel_array[thePos][2].GroupID!=doorway_carousel_array[thePos][0])
				{
					doorway_panel_chain_button.removeAttribute("oncommand");
					doorway_panel_chain_button.setAttribute("oncommand","alert('To the Beginning of the chain we go (eventually)!')");
					//doorway_panel_chain_button.setAttribute("oncommand","NovaInitia.Toolbar.redirect_to('',"+doorway_carousel_array[thePos][0]+",'"+doorway_carousel_array[thePos][1]+"')");
					doorway_panel_chain_button.hidden=false;
				}
				else
					doorway_panel_chain_button.hidden=true;
				doorway_panel_button.removeAttribute("oncommand");
				doorway_panel_button.setAttribute("oncommand","NovaInitia.Toolbar.redirect_to('',"+doorway_carousel_array[thePos][0]+",'"+doorway_carousel_array[thePos][1]+"')");
				doorway_panel_dismiss_button.removeAttribute("oncommand");
				doorway_panel_dismiss_button.setAttribute("oncommand","NovaInitia.Toolbar.dismiss_panel('nova_initia_doorway_panel',"+thePos+")");
				NovaInitia.Toolbar.show_panel(doorway_panel);
				//NovaInitia.Toolbar.window_resized();
			}
		};
		
		/* called when load more button in doorway carousel is pressed, sends request to load more to the server */
		this.doorway_carousel_load_more = function()
		{
			cur_page_num++;
			NovaInitia.Toolbar.showThrobber();
		 	//var end = "."+url_prefix+server_url+"/rf/remog/doorway/list/1.json";
		 	//var end = "."+url_prefix+server_url+"/rf/remog/doorway/list/"+cur_page_num+".json";
		 	//var len = cur_domain_hash.length;
		 	//var domainStr = cur_domain_hash.substring(0,len-1)+".x"+cur_domain_hash.substring(len-1);
		 	var trackURL = "http://"+url_prefix+server_url+"/rf/remog/doorway/"+cur_url_hash+"/"+cur_domain_hash+"/list/"+cur_page_num+".json";
		 	//var trackURL = "http://x"+cur_url_hash+".x"+domainStr+end;
		 	//alert(trackURL);
		 	///remog/doorway/$URLHASH/$DOMAINHASH/list/$page
			NovaInitia.Toolbar.send_request(trackURL,"GET",null,true,NovaInitia.Toolbar.process_doorway_carousel_load_more,false,null);
			// send request for more
		};
		
		/* load the results of the load_more request into the doorway carousel */
		this.process_doorway_carousel_load_more = function(theRes)
		{
			// set next button label back to next
			// JSON decode
			if(ni.debug_set)
			{
			 	alert("carousel load more status: "+theRes.status);
				alert("carousel load more responseText: "+theRes.responseText);
			}
			var doorwayRes = ni.JSON.parse(theRes.responseText);
			var i=0;
			if(doorwayRes.doorSet)
			{
				while(doorwayRes.doorSet[i])
				{
					//alert(doorwayRes.doorSet[i].toolData.Hint);
					//alert("calling get_username for doorway");
					var theUsername = NovaInitia.Toolbar.get_username(doorwayRes.doorSet[i].USERID);
					var theHint = {"Hint":doorwayRes.doorSet[i].toolData.Hint};
					doorway_carousel_array.push(new Array(/*ID of doorway*/doorwayRes.doorSet[i].ID,/*User who left*/theUsername,/*hint*/theHint));
					i++;
				}
			}
			NovaInitia.Toolbar.hideThrobber();
			NovaInitia.Toolbar.doorway_carousel_next();
		};
		
		/* Gets the previous doorway in the doorway carousel */
		this.doorway_carousel_prev = function()
		{
			var i=0;
			while(doorway_carousel_array[i])
			{
				if(doorway_carousel_array[i][0]==doorway_panel_hidden_label.value)
				{
					if(i!=0)
					{
						NovaInitia.Toolbar.setup_doorways(i-1);
						break;
					}
					else
						doorway_panel_prev_button.disabled=true;
				}
				i++;
			}
		};
		
		/* Gets the next doorway in the doorway carousel */
		this.doorway_carousel_next = function()
		{
			var i=0;
			while(doorway_carousel_array[i])
			{
				if(doorway_carousel_array[i][0]==doorway_panel_hidden_label.value)
				{
					if(doorway_carousel_array[i+1])
					{
						NovaInitia.Toolbar.setup_doorways(i+1);
						//if(!doorway_carousel_array[i+2])
							//doorway_panel_next_button.disabled=true;
						break;
					}
					else
					{
						doorway_panel_next_button.disabled=true;
					}
				}
				i++;
			}
		};
		/* called when a user 'steps through' a doorway and opens the rate panel */
		this.stepped_through_doorway = function()
		{
			var doorway_cached = doorway_cache.get(last_doorwayID);
			var tmpDoorwayInfo = ni.JSON.parse(doorway_cached[last_doorwayID]);
			//alert(ni.dump(tmpDoorwayInfo.doorway));
			if(tmpDoorwayInfo.doorway)
			{
				/* doorway_end_panel = endDoorwayPanel;
		 		*  doorway_end_panel_label = endDoorwayPanelLabel;
		 		*  doorway_end_panel_comment = endDoorwayPanelComment;
		 		*  doorway_end_panel_button = endDoorwayPanelButton;
		 		*/
				doorway_end_panel_label.value = "You Stepped Through "+last_doorway_user+"'s Doorway!";
				doorway_end_panel_comment.value = tmpDoorwayInfo.doorway.Comment;
				doorway_end_panel_button.disabled=false;
				doorway_end_panel_button.removeAttribute("oncommand");
				doorway_end_panel_button.setAttribute("oncommand","NovaInitia.Toolbar.send_rating('"+last_doorwayID+"'); NovaInitia.Toolbar.dismiss_panel('nova_initia_doorway_panel_end');");
				NovaInitia.Toolbar.show_panel(doorway_end_panel);
				NovaInitia.Toolbar.window_resized();
				//doorway_end_panel.openPopupAtScreen(0,0,false);
				//show panel
			}
		};
		
		this.send_rating = function(theID)
		{
			doorway_end_panel_button.disabled=true;
		 	var trackURL = "http://"+url_prefix+server_url+"/rf/remog/doorway/"+theID+"/rate/1.json";
			NovaInitia.Toolbar.send_request(trackURL,"PUT",null,true,NovaInitia.Toolbar.process_send_rate,false,null);
		};
		
		this.process_send_rate = function(theRes)
		{
			// JSON decode
			if(theRes.status==200)
			{
				var tmpRateResponse = ni.JSON.parse(theRes.responseText);
				if(ni.debug_set)
				{
				 	alert("send_rate status: "+theRes.status);
					alert("send_rate responseText: "+theRes.responseText);
				}
				if(tmpRateResponse.error)
					this.send_notification("Rating Was NOT Received: "+tmpRateResponse.error+"!","PRIORITY_INFO_LOW");
				if(tmpRateResponse.rating)
				{
					//this.send_notification("Rating Received, Thanks!","PRIORITY_INFO_LOW");
				}
			}
			else
				this.send_notification("Rating Was NOT Received: Bad server response!"+tmpRateResponse.error+"!","PRIORITY_INFO_LOW");
		};
		
		/* returns whether or not a user just took a doorway and sets took_doorway var to false */
		this.just_took_doorway = function()
		{
			var returnThis = took_doorway;
			if(took_doorway)
				took_doorway = false;
			return returnThis;
		};
		
		/* set the last_doorwayID var to the ID of the last doorway taken */
		this.set_last_doorwayID = function(toThis)
		{
			last_doorwayID = toThis;
		};
		
		this.place_signpost = function()
		{
			if(signpost_tool_amount>0)
			{
				if(at_a_page)
				{
					var theParams = "Url="+ni.urlencode(cur_url);
					if(signpost_panel_popup_title)
					{
					 	if(signpost_panel_popup_title.value!="")
							theParams = theParams+"&Title="+ni.urlencode(signpost_panel_popup_title.value);
					}
					if(signpost_panel_popup_comment)
					{
					 	if(signpost_panel_popup_comment.value!="")
							theParams = theParams+"&Comment="+ni.urlencode(signpost_panel_popup_comment.value);
					}
					theParams = theParams+"&NSFW="+signpost_panel_popup_nsfw.checked;
					//alert("http://"+url_prefix+server_url+"/rf/remog/page/"+cur_url_hash+"/"+cur_domain_hash+"/"+signpost_tool_id+".json"+" Params: "+theParams);
					NovaInitia.Toolbar.send_request("http://"+url_prefix+server_url+"/rf/remog/page/"+cur_url_hash+"/"+cur_domain_hash+"/"+signpost_tool_id+".json","POST",theParams,true,NovaInitia.Toolbar.process_signpost_place,false,null);
					signpost_panel_popup.hidePopup();
				}
				else
					this.send_notification("Not At A Valid Page!","PRIORITY_INFO_LOW");
			}
			else
				this.send_notification("Out of Signposts!","PRIORITY_INFO_LOW");
		};
		
		/* process the response after trying to place a signpost */
		this.process_signpost_place = function(theRes)
		{
		 	if(ni.debug_set)
			{
		 		alert("Process Signpost Place");
			 	alert("status: "+theRes.status);
				alert("responseText: "+theRes.responseText);
			}
			if(theRes.status==201 || theRes.status==200)
			{
				signpost_panel_popup_title.value="";
				signpost_panel_popup_comment.value="";
				NovaInitia.Toolbar.check_tool_set(theRes,signpost_tool_id);
			}
			else
			{
				this.send_notification("Signpost received a bad response!","PRIORITY_INFO_HIGH");
			}
		};
		
		
		this.process_signpost_request = function(theRes)
		{
		 	if(ni.debug_set)
			{
		 		alert("Process Signpost Request");
			 	alert("status: "+theRes.status);
				alert("responseText: "+theRes.responseText);
			}
			if(theRes.status==200)
			{
			 	var signpost_info = ni.JSON.parse(theRes.responseText);
			 	var signpost_cached = signpost_cache.get(signpost_info.signpost.ID);
			 	if(!signpost_cached)
			 	{
					signpost_cache.add(signpost_info.signpost.ID,theRes.responseText);
				}
				if(at_tour_start)
				{
					if(cur_tour_group_ID!=signpost_info.signpost.GroupID)
					{
						
					 	tour_start_panel_title_label.value = "Tour Entry";				
					 	tour_start_panel_comment_textbox.value = "Click 'Start' below to begin this tour!";
					 	tour_start_panel_start_button.hidden=false;
						tour_start_panel_start_button.removeAttribute("oncommand");
						tour_start_panel_start_button.setAttribute("oncommand","NovaInitia.Toolbar.redirect_to('"+signpost_info.signpost.Url+"',"+false+","+false+","+signpost_info.signpost.ID+","+signpost_info.signpost.GroupID+")");
						NovaInitia.Toolbar.show_panel(tour_start_panel);
					}
				}
				else
				{
				 	tour_panel_title_label.value = ni.urldecode(signpost_info.signpost.Title);
				 	tour_panel_comment_textbox.value = ni.urldecode(signpost_info.signpost.Comment);
				 	if(signpost_info.signpost.ANextID!="0")
				 	{
				 	 	if(signpost_info.signpost.BNextID=="0"&&signpost_info.signpost.CNextID=="0"&&signpost_info.signpost.DNextID=="0")
				 	 		tour_panel_A_button.label = "Next";
				 	 	else
				 	 		tour_panel_A_button.label = "A";
						tour_panel_A_button.setAttribute("onmouseover","document.getElementById('nova_initia_tour_panel_comment_textbox').value = '"+ni.urldecode(signpost_info.signpost.ANextTitle)+"'");
						tour_panel_A_button.setAttribute("onmouseout","document.getElementById('nova_initia_tour_panel_comment_textbox').value = '"+ni.urldecode(signpost_info.signpost.Comment)+"'");
					 	tour_panel_A_button.removeAttribute("oncommand");
						tour_panel_A_button.setAttribute("oncommand","NovaInitia.Toolbar.redirect_to('',"+false+","+false+","+signpost_info.signpost.ANextID+")");
						tour_panel_A_button.hidden=false;
					}
					else
					{
					 	tour_panel_A_label.hidden=true;
						tour_panel_A_button.hidden=true;
					}
				 	if(signpost_info.signpost.BNextID!="0")
				 	{
						tour_panel_B_button.setAttribute("onmouseover","document.getElementById('nova_initia_tour_panel_comment_textbox').value = '"+ni.urldecode(signpost_info.signpost.BNextTitle)+"'");
						tour_panel_B_button.setAttribute("onmouseout","document.getElementById('nova_initia_tour_panel_comment_textbox').value = '"+ni.urldecode(signpost_info.signpost.Comment)+"'");
					 	tour_panel_B_button.removeAttribute("oncommand");
						tour_panel_B_button.setAttribute("oncommand","NovaInitia.Toolbar.redirect_to('',"+false+","+false+","+signpost_info.signpost.BNextID+")");
						tour_panel_B_button.hidden=false;
					}
					else
					{
					 	tour_panel_B_label.hidden=true;
						tour_panel_B_button.hidden=true;
					}
				 	if(signpost_info.signpost.CNextID!="0")
				 	{
						tour_panel_C_button.setAttribute("onmouseover","document.getElementById('nova_initia_tour_panel_comment_textbox').value = '"+ni.urldecode(signpost_info.signpost.CNextTitle)+"'");
						tour_panel_C_button.setAttribute("onmouseout","document.getElementById('nova_initia_tour_panel_comment_textbox').value = '"+ni.urldecode(signpost_info.signpost.Comment)+"'");
						tour_panel_C_button.removeAttribute("oncommand");
						tour_panel_C_button.setAttribute("oncommand","NovaInitia.Toolbar.redirect_to('',"+false+","+false+","+signpost_info.signpost.CNextID+")");
						tour_panel_C_button.hidden=false;
					}
					else
					{
					 	tour_panel_C_label.hidden=true;
						tour_panel_C_button.hidden=true;
					}
				 	if(signpost_info.signpost.DNextID!="0")
				 	{
						tour_panel_D_button.setAttribute("onmouseover","document.getElementById('nova_initia_tour_panel_comment_textbox').value = '"+ni.urldecode(signpost_info.signpost.DNextTitle)+"'");
						tour_panel_D_button.setAttribute("onmouseout","document.getElementById('nova_initia_tour_panel_comment_textbox').value = '"+ni.urldecode(signpost_info.signpost.Comment)+"'");
						tour_panel_D_button.removeAttribute("oncommand");
						tour_panel_D_button.setAttribute("oncommand","NovaInitia.Toolbar.redirect_to('',"+false+","+false+","+signpost_info.signpost.DNextID+")");
						tour_panel_D_button.hidden=false;
					}
					else
					{
					 	tour_panel_D_label.hidden=true;
						tour_panel_D_button.hidden=true;
					}
					/*
					if(prev_signpost_ID)
					{
				 		tour_panel_back_button.removeAttribute("oncommand");
				 		tour_panel_back_button.setAttribute("oncommand","NovaInitia.Toolbar.tour_go_back()");
						//tour_panel_back_button.setAttribute("oncommand","NovaInitia.Toolbar.redirect_to('',"+false+","+false+","+prev_signpost_ID+")");
					}
					else
					{
						tour_panel_back_button.removeAttribute("oncommand");
						var tmpURL = "NovaInitia.Toolbar.redirect_to('http://www."+server_url+"/rf/remog/group/"+signpost_info.signpost.ID+"')";
						tour_panel_back_button.setAttribute("oncommand",tmpURL);
					}
					*/
					if(signpost_info.signpost.ANextID=="0"&&signpost_info.signpost.BNextID=="0"&&signpost_info.signpost.CNextID=="0"&&signpost_info.signpost.DNextID=="0")
					{
						tour_panel_complete_button.removeAttribute("oncommand");
						var tmpURL = "NovaInitia.Toolbar.complete_tour('"+signpost_info.signpost.GroupID+"','"+cur_url_hash+"','"+cur_domain_hash+"');NovaInitia.Toolbar.redirect_to('http://www."+server_url+"/rf/remog/group/"+signpost_info.signpost.GroupID+"?LASTKEY="+current_key+"')";
						tour_panel_complete_button.setAttribute("oncommand",tmpURL);
						tour_panel_complete_button.hidden=false;
						tour_panel_complete_label.hidden=false;
					}
					else
					{
						tour_panel_complete_button.removeAttribute("oncommand");
						tour_panel_complete_button.hidden=true;
						tour_panel_complete_label.hidden=true;
					}
					NovaInitia.Toolbar.show_panel(tour_panel);
				}
			}
			else
			{
				this.send_notification("Signpost received a bad response!","PRIORITY_INFO_HIGH");
			}
		};
		
		this.tour_go_back = function()
		{
			tour_path_info.pop();
			var tmpLen = tour_path_info.length-1;
			//alert("len:"+tmpLen+" | "+tour_path_info[tmpLen][0]);
		 	var tmpURL = tour_path_info[tmpLen][1];
		 	var tmpID = tour_path_info[tmpLen][0]
			if(tmpID==0)
			{
				cur_tour_group_ID = "";
			 	tour_path_info = new Array();
				NovaInitia.Toolbar.redirect_to(tmpURL,false,false,false);
			}
			else
			{
			 	tour_path_info.pop();
				NovaInitia.Toolbar.redirect_to(tmpURL,false,false,tmpID);
			}
		};
		
		this.complete_tour = function(theGroupID,theUHash,theDHash)
		{
			var theParams = { "u" : theUHash, "d" : theDHash };
			//alert("http://"+url_prefix+server_url+"/rf/remog/group/"+theGroupID+"/complete | params: "+theParams);
			NovaInitia.Toolbar.send_request("http://"+url_prefix+server_url+"/rf/remog/group/"+theGroupID+"/complete","POST",theParams,true,NovaInitia.Toolbar.process_complete_tour,false,null);
		};
		
		this.process_complete_tour = function(theRes)
		{
			if(ni.debug_set)
			{
		 		alert("Process Complete Tour");
			 	alert("status: "+theRes.status);
				alert("responseText: "+theRes.responseText);
			}
			if(theRes.status==200)
			{
				var tour_complete_info = ni.JSON.parse(theRes.responseText);
				if(tour_complete_info.groupComplete)
				{
					sg_tool_amount = Number(sg_tool_amount) + Number(tour_complete_info.Sg);
					NovaInitia.Toolbar.set_user_tool_amounts();
				}
				if(tour_complete_info.error)
					this.send_notification("Tour Completion received this error:"+theRes.error,"PRIORITY_INFO_HIGH");
			}
			else
			{
				this.send_notification("Tour Completion Failed!","PRIORITY_INFO_HIGH");
			}
		};
		
		this.process_tour = function(tmpID)
		{
			if(!at_tour_start)
				cur_tour_info = new Array(tmpID,cur_url);
		 	var signpost_cached = signpost_cache.get(tmpID);
		 	if(signpost_cached)
		 	{
				//doorway was cached doorway_cached[theDoorwayID] is the JSON
				var tmpRes = new Object();
				tmpRes.status="200";
				tmpRes.responseText=signpost_cached[tmpID];
				NovaInitia.Toolbar.process_signpost_request(tmpRes);
			}
			else
			{
				var tmpURL = "http://"+url_prefix+server_url+"/rf/remog/signpost/"+tmpID+".json?LASTKEY="+current_key;
				NovaInitia.Toolbar.send_request(tmpURL,"GET",null,true,NovaInitia.Toolbar.process_signpost_request,false,null);
			}
		};
		
		this.sync_user = function()
		{
			function sync_request_finished(tmp_user_res)
			{
				if(tmp_user_res.status==200)
				{
					if(ni.debug_set)
					{
						alert(tmp_user_res.responseText);
					}
					var tmp_info = ni.JSON.parse(tmp_user_res.responseText);
					if(tmp_info['error'])
						NovaInitia.Toolbar.process_page_error(tmp_info['error']);
					else
					{
						if(ni.debug_set)
							alert("user data sync'd");
						user_JSON = tmp_info;
						NovaInitia.Toolbar.set_user_info();
					}
				}
			}
			if(typeof(arguments[0]) !== 'undefined')
			{
				alert(arguments[0].status);
				sync_request_finished(arguments[0]);
			}
			else
				NovaInitia.Toolbar.send_request("http://"+url_prefix+server_url+"/rf/remog/user/"+user_JSON.user.ID+".json","GET",null,true,sync_request_finished,false,null);
		};
		
		this.clear_logins = function()
		{
			ni.prefManager.setBoolPref("extensions.nova-initia.login_saved",false);
			ni.prefManager.setCharPref("extensions.nova-initia.saved_username","");
			ni.prefManager.setCharPref("extensions.nova-initia.saved_password_hash","");
			var count = new Object();
			var logins = ni.prefManager.getChildList("extensions.nova-initia.saved_users",count);
			for(var i=0;i<count.value;i++)
			{
				//alert(logins[i]);
				NovaInitia.Toolbar.remove_user_menuitem(ni.prefManager.getCharPref(logins[i]));
				ni.prefManager.deleteBranch(logins[i]);
			}
			count = new Object();
			var passes = ni.prefManager.getChildList("extensions.nova-initia.saved_passes",count);
			for(var i=0;i<count.value;i++)
			{
				//alert(passes[i]);
				ni.prefManager.deleteBranch(passes[i]);
			}
		};
	
		/* Gather and process the login information */
		this.process_login = function(what,newLogin,theUser,logoutFirst)
		{
			//if(what.id=='nova_initia_login_toolbar_login_button'||what.id=='nova_initia_tools_menuitem_login'||what.id='nova_initia_tools_menu_user_submenu_new')
			//{
				login_saved = ni.prefManager.getBoolPref("extensions.nova-initia.login_saved");
				if(newLogin)
					login_saved = false;
				loginbar_throbber.collapsed=false;
				var prompts = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].getService(Components.interfaces.nsIPromptService);
				ni.username = {value:""};
				ni.password = {value:""};
				ni.stay_logged_in = {value:false};
				var okorcancel = false;
				if(theUser)
				{
					var tmpUser = ni.prefManager.getCharPref("extensions.nova-initia.saved_users."+theUser);
					var tmpPass = ni.prefManager.getCharPref("extensions.nova-initia.saved_passes."+theUser);
					if(ni.debug_set)
						alert("switching user to: "+tmpUser);
					if(tmpUser)
					{
						if(tmpPass)
						{
							ni.username = {value:tmpUser};
							ni.password = {value:tmpPass};
							if(login_saved)
								ni.stay_logged_in = {value:true};
							else
								ni.stay_logged_in = {value:false};
							okorcancel = true;
						}
						else
						{
							ni.username = {value:"username"};
							ni.password = {value:"password"};
							ni.stay_logged_in = {value:false};
							okorcancel = prompts.promptUsernameAndPassword(window, 'Login', 'Enter your login info', ni.username, ni.password, 'Stay Logged In?',ni.stay_logged_in);
						}
					}
					else
					{
						ni.username = {value:"username"};
						ni.password = {value:"password"};
						ni.stay_logged_in = {value:false};
						okorcancel = prompts.promptUsernameAndPassword(window, 'Login', 'Enter your login info', ni.username, ni.password, 'Stay Logged In?',ni.stay_logged_in);
					}
				}
				else
				{
					if(login_saved)
					{
							ni.username = {value:ni.prefManager.getCharPref("extensions.nova-initia.saved_username")};
							ni.password = {value:ni.prefManager.getCharPref("extensions.nova-initia.saved_password_hash")};
							ni.stay_logged_in = {value:true};
							okorcancel = true;
					}
					else
					{
						ni.username = {value:"username"};
						ni.password = {value:"password"};
						ni.stay_logged_in = {value:false};
						okorcancel = prompts.promptUsernameAndPassword(window, 'Login', 'Enter your login info', ni.username, ni.password, 'Stay Logged In?',ni.stay_logged_in);
					}
				}
				//if they hit ok enter the if, if they hit cancel skip the if */
				if(okorcancel)
				{
					var params = "login=1&uname="+ni.username.value;
				 	if(ni.debug_set)
						alert('testing login! '+this+' params: '+params);
						
					function user_request_finished(userReq)
					{
						if(userReq.status==200)
						{
							if(userReq.responseText.substring(0,6)=='Error:')
							{
								this.send_notification(userReq.responseText,"PRIORITY_CRITICAL_HIGH");
								if(ni.debug_set)
									alert(userReq.responseText);
							}
							else
							{
								ni.pass = ni.password.value;
								NovaInitia.Toolbar.setKey(userReq.responseText);
								window.document.addEventListener("ene"+NovaInitia.Toolbar.getKey(),NovaInitia.Toolbar.server_sync,true,true);
								if(ni.debug_set)
									alert('key: '+userReq.responseText);
								//if the login was previously saved it would already have been hashed so don't hash again
								if(!login_saved)
									ni.pass = ni.sha256(ni.pass);
								ni.hashed_pass = ni.pass;
								if(ni.debug_set)
									alert('db hash: '+ni.pass);
								ni.pass = ni.pass+userReq.responseText;
								if(ni.debug_set)
									alert('with key: '+ni.pass);
								ni.pass = ni.sha256(ni.pass);
								if(ni.debug_set)
									alert('match hash: '+ni.pass);
								var loginParams = "login=1&pwd="+ni.pass+"&uname="+ni.username.value+"&LastKey="+userReq.responseText;
								ni.cookieSvc.setCookieString(ni.cookieUri, null, "LastKey="+userReq.responseText+";", null);
								if(ni.debug_set)
									alert("login params:"+loginParams);
								function login_request_finished(loginReq)
								{
									//alert(loginReq.status+" | "+loginReq.responseText);
									if(loginReq.status==200&&loginReq.responseText.charAt(0)=="{")
									{
										var tmp_login_info = ni.JSON.parse(loginReq.responseText);
										user_JSON = tmp_login_info;
										if(tmp_login_info.user&&tmp_login_info.user.ID)
										{
											if(ni.debug_set)
												alert(loginReq.responseText);
											if(logoutFirst)
												NovaInitia.Toolbar.logout();
											if(ni.stay_logged_in.value)
											{
												ni.prefManager.setCharPref("extensions.nova-initia.saved_username",ni.username.value);
												ni.prefManager.setCharPref("extensions.nova-initia.saved_users."+ni.username.value,ni.username.value);
												ni.prefManager.setCharPref("extensions.nova-initia.saved_password_hash",ni.hashed_pass);
												ni.prefManager.setCharPref("extensions.nova-initia.saved_passes."+ni.username.value,ni.hashed_pass);
												ni.prefManager.setBoolPref("extensions.nova-initia.login_saved", true);
												NovaInitia.Toolbar.setup_user_menuitem(ni.username.value);
											}
											else
											{
												ni.prefManager.setCharPref("extensions.nova-initia.saved_username","");
												ni.prefManager.setCharPref("extensions.nova-initia.saved_password_hash","");
												ni.prefManager.setBoolPref("extensions.nova-initia.login_saved", false);
											}
											NovaInitia.Toolbar.set_toolbutton_orient(ni.prefManager.getBoolPref("extensions.nova-initia.toolbar_text_orientation_vertical"));
											login_toolbar.hidden=true;
											login_toolbar.collapsed=true;
											toolbar.hidden=false;
											toolbar.collapsed=false;
											//unhide user menu
											login_menuitem.hidden=true;
											logout_menuitem.hidden=false;
											user_menu.hidden=false;
											logged_in = true;
											ni.page_listener_functions.initialize();
											//ni.page_listener_functions.process_new_URL(window.top.getBrowser().selectedBrowser.contentWindow.location.href);
											NovaInitia.Toolbar.send_request("http://"+url_prefix+server_url+"/rf/remog/tool.json","GET",null,true,NovaInitia.Toolbar.initialize_tools,false,null);
											NovaInitia.Toolbar.process_page(window.top.getBrowser().selectedBrowser.contentWindow.location.href);
										}
										else
										{
											this.send_notification(loginReq.responseText,"PRIORITY_CRITICAL_HIGH");
											if(ni.debug_set)
												alert(loginReq.responseText);
										}
									}
									else
									{
										if(loginReq.responseText.substring(0,6)=='Error:')
											this.send_notification(loginReq.responseText,"PRIORITY_CRITICAL_HIGH");
										else
											this.send_notification("Bad Response, server may be unreachable!!!","PRIORITY_CRITICAL_HIGH");
										if(ni.debug_set)
											alert('Bad/No Response from server');
									}
								}
								NovaInitia.Toolbar.send_request("http://"+url_prefix+server_url+"/login2.php","POST",loginParams,true,login_request_finished,false,null);
								
							}
						}
						else
						{
							this.send_notification("Bad Response, server may be unreachable!!!","PRIORITY_CRITICAL_HIGH");
							if(ni.debug_set)
								alert('Bad/No Response from server');
						}
					}
					
					NovaInitia.Toolbar.SharedKey.Sync();
					NovaInitia.Toolbar.send_request("http://"+url_prefix+server_url+"/getKey.php","POST",params,true,user_request_finished,true,null);
				}
			//}
			loginbar_throbber.collapsed=true;
		};
		
		
		function DiffieHellman(size) {
			this.bitStrength = size;
			this.secret = ni.bigInt.randBigInt(this.bitStrength,0);
			this.base = ni.bigInt.int2bigInt(3,0,0);
		}

		DiffieHellman.prototype.Package = function() {
			this.resultbase = arguments[0] || 10;

			function Pack(Key) {
				this.g = ni.bigInt.bigInt2str(Key.base,Key.resultbase);
				this.p = ni.bigInt.bigInt2str(Key.prime,Key.resultbase);
				this.A = ni.bigInt.bigInt2str(Key.result,Key.resultbase);
			}

			if(!this.result)
			{
				while(!this.result || ni.bigInt.GCD(this.base,this.prime)!=1)
				{
					this.prime = ni.bigInt.randTruePrime(this.bitStrength);
					this.result = ni.bigInt.powMod(this.base,this.secret,this.prime);
				}
						
				this.sharedSet = new Pack(this);
			}
				
			return this.sharedSet;
		};
		
		DiffieHellman.prototype.FindKey = function(chal) {
			this.bigIntKey = ni.bigInt.powMod(ni.bigInt.str2bigInt(chal,10,0,0), this.secret, this.prime);
			this.secretKey = ni.bigInt.bigInt2str(this.bigIntKey,10);
			return this.secretKey;
		};

		DiffieHellman.prototype.Sync = function() {
			NovaInitia.Toolbar.send_request("http://www.nova-initia.com/key.php","POST",this.Package(),true,
				function(resp) {
					NovaInitia.Toolbar.SharedKey.challenge = resp.responseText;
					NovaInitia.Toolbar.SharedKey.FindKey(NovaInitia.Toolbar.SharedKey.challenge);
					NovaInitia.Toolbar.SharedKey.secretKeyHex = ni.bigInt.bigInt2str(NovaInitia.Toolbar.SharedKey.bigIntKey,16);
				},true,null);
		};
		
		this.SharedKey = new DiffieHellman(128);
		
		/* Check to see if the tool was successfully set and perform related tasks
		*  theResponse is the response from the tool set request
		*  theToolID is the ID of the tool trying to be set
		*/
		this.check_tool_set = function(theResponse,theToolID)
		{
		 	//alert(theResponse.responseText+" | "+theToolID);
		 	var tmp_info = ni.JSON.parse(theResponse.responseText);
		 	if(tmp_info.fail)
		 	{
			 	if(tmp_info.fail==true)
			 	{
					NovaInitia.Toolbar.show_panel(fail_panel);
	
			 	 	if(theToolID == trap_tool_id)
			 	 	{
						fail_panel_image.src = "chrome://nova-initia_toolbar/skin/images/overlays/trap_failed.jpg";
						fail_panel_label.value = "Trap failed";
				 		//this.send_notification("Trap Failed!","PRIORITY_INFO_LOW");
				 		trap_tool_amount -= 1;
				 		NovaInitia.Toolbar.set_user_tool_amounts();
				 	}
				 	if(theToolID == barrel_tool_id)
				 	{
						fail_panel_image.src = "chrome://nova-initia_toolbar/skin/images/overlays/barrel_failed.jpg";
						fail_panel_label.value = "Barrel failed";
				 		//this.send_notification("Barrel Failed!","PRIORITY_INFO_LOW");
					 	barrel_tool_amount -= 1;
					 	NovaInitia.Toolbar.set_user_tool_amounts();
				 	}
				 	if(theToolID == spider_tool_id)
				 	{
						fail_panel_image.src = "chrome://nova-initia_toolbar/skin/images/overlays/spider_failed.jpg";
						fail_panel_label.value = "Spider failed";
				 		//this.send_notification("Spider Failed!","PRIORITY_INFO_LOW");
				 		spider_tool_amount -= 1;
				 		NovaInitia.Toolbar.set_user_tool_amounts();
					}
				 	if(theToolID == shield_tool_id)
				 	{
						fail_panel_image.src = "chrome://nova-initia_toolbar/skin/images/overlays/shield_failed.jpg";
						fail_panel_label.value = "Shield failed";
				 		//this.send_notification("Spider Failed!","PRIORITY_INFO_LOW");
				 		shield_tool_amount -= 1;
				 		NovaInitia.Toolbar.set_user_tool_amounts();
					}
					if(theToolID == doorway_tool_id)
					{
						fail_panel_image.src = "chrome://nova-initia_toolbar/skin/images/overlays/doorway_failed.jpg";
						fail_panel_label.value = "Doorway failed";
				 		//this.send_notification("Doorway Failed!","PRIORITY_INFO_LOW");
				 		doorway_tool_amount -= 1;
				 		NovaInitia.Toolbar.set_user_tool_amounts();
					}
					if(theToolID == signpost_tool_id)
					{
						fail_panel_image.src = "chrome://nova-initia_toolbar/skin/images/overlays/signpost_failed.jpg";
						fail_panel_label.value = "Signpost failed";
				 		//this.send_notification("Signpost Failed!","PRIORITY_INFO_LOW");
				 		signpost_tool_amount -= 1;
				 		NovaInitia.Toolbar.set_user_tool_amounts();
					}
					
					failTimeout = this.autoClose(failTimeout,"nova_initia_fail_panel", 3000);
				}
			}
			
			if(tmp_info.pageSet)
		 	{
			 	if(tmp_info.pageSet.ID)
			 	{
			 	 	if(theToolID == trap_tool_id)
			 	 	{
						NovaInitia.Toolbar.show_panel(trap_panel);
						trap_panel_image.src = "chrome://nova-initia_toolbar/skin/images/overlays/trap_set.jpg";
						trap_panel_label.value = "";
						trap_panel_description.value = "";
						parent.document.querySelector("#nova_initia_trap_panel_buttons>button").setAttribute("noshow","true");
						trapTimeout = this.autoClose(trapTimeout,"nova_initia_trap_panel", 3000);
				 		//this.send_notification("Trap Set!","PRIORITY_INFO_LOW");
				 		trap_tool_amount -= 1;
				 		NovaInitia.Toolbar.set_user_tool_amounts();
				 	}
				 	if(theToolID == barrel_tool_id)
				 	{
						
						NovaInitia.Toolbar.show_panel(barrel_panel);
						barrel_panel_image.src = "chrome://nova-initia_toolbar/skin/images/overlays/barrel_set.jpg";
						barrel_panel_label.value = "";
						barrel_panel_title_0.value = "";
						barrel_panel_title_1.value = "";
						barrel_panel_title_2.value = "";
						parent.document.querySelector("#nova_initia_barrel_panel_buttons>button").setAttribute("noshow","true");
						barrelTimeout = this.autoClose(barrelTimeout,"nova_initia_barrel_panel", 3000);
	
						//this.send_notification("Barrel Stashed!","PRIORITY_INFO_LOW");
				 		sg_tool_amount -= Number(stash_barrel_sg_textbox.value);
					 	trap_tool_amount -= Number(stash_barrel_traps_textbox.value);
					 	barrel_tool_amount -= Number(stash_barrel_barrels_textbox.value)+1;
					 	spider_tool_amount -= Number(stash_barrel_spiders_textbox.value);
					 	shield_tool_amount -= Number(stash_barrel_shields_textbox.value);
					 	doorway_tool_amount -= Number(stash_barrel_doorways_textbox.value);
					 	signpost_tool_amount -= Number(stash_barrel_signposts_textbox.value);
					 	NovaInitia.Toolbar.set_user_tool_amounts();
				 	}
				 	if(theToolID == spider_tool_id)
				 	{
						NovaInitia.Toolbar.show_panel(spider_panel);
						spider_panel_image.src = "chrome://nova-initia_toolbar/skin/images/overlays/spider_set.jpg";
						spider_panel_label.value = "";
						spider_panel_description.value = "";
						parent.document.querySelector("#nova_initia_spider_panel_buttons>button").setAttribute("noshow","true");
						spiderTimeout = this.autoClose(spiderTimeout,"nova_initia_spider_panel", 3000);
				 		//this.send_notification("Spider Released!","PRIORITY_INFO_LOW");
				 		spider_tool_amount -= 1;
				 		NovaInitia.Toolbar.set_user_tool_amounts();
					}
					if(theToolID == doorway_tool_id)
					{
						NovaInitia.Toolbar.show_panel(doorway_panel);
						doorway_panel_image.src = "chrome://nova-initia_toolbar/skin/images/overlays/doorway_set.png";
						doorway_panel_label.value = "";
						//doorway_panel_description.value = "";
						doorwayTimeout = this.autoClose(doorwayTimeout,"nova_initia_doorway_panel", 3000);
						//this.send_notification("Doorway Opened!","PRIORITY_INFO_LOW");
				 		doorway_tool_amount -= 1;
				 		NovaInitia.Toolbar.set_user_tool_amounts();
					}
					if(theToolID == signpost_tool_id)
					{
						NovaInitia.Toolbar.show_panel(signpost_panel);
						signpost_panel_image.src = "chrome://nova-initia_toolbar/skin/images/overlays/signpost_set.jpg";
						signpost_panel_label.value = "";
						parent.document.querySelector("#nova_initia_signpost_panel_buttons>button").setAttribute("noshow","true");
						//signpost_panel_description.value = "";x
						signpostTimeout = this.autoClose(signpostTimeout,"nova_initia_signpost_panel", 3000);
				 		//this.send_notification("Signpost Placed!","PRIORITY_INFO_LOW");
				 		signpost_tool_amount -= 1;
				 		NovaInitia.Toolbar.set_user_tool_amounts();
					}
			 	}
			}
			
			if(tmp_info.result)
			{
				if (tmp_info.result=="Page Full")
				{
					this.send_notification("Page full, please try again later","PRIORITY_INFO_LOW");
				} else {
					if(theToolID == trap_tool_id&&tmp_info.result=="Trap Blocked!")
					{
						//this.send_notification("Your Trap Exploded In Your Face!","PRIORITY_INFO_LOW");
						spider_panel_label.value = tmp_info.username+"'s";
						spider_panel_description.value = "spider caused the trap to explode in your face!";
						spider_panel_image.src = "chrome://nova-initia_toolbar/skin/images/overlays/spider_triggered.png";
						NovaInitia.Toolbar.show_panel(spider_panel);
						//NovaInitia.Toolbar.window_resized();
						trap_tool_amount -= 1;
						sg_tool_amount -= tmp_info.Sg===undefined?0:tmp_info.Sg;
						NovaInitia.Toolbar.shield_hit(false,true);
						NovaInitia.Toolbar.set_user_tool_amounts();
						spiderTimeout = this.autoClose(spiderTimeout,spider_panel.id,3000);
					}
					
					if(theToolID == spider_tool_id&&tmp_info.result=="Spider triggered!")
					{
						//this.send_notification("Your Trap Exploded In Your Face!","PRIORITY_INFO_LOW");
						spider_panel_label.value = tmp_info.username+"'s";
						spider_panel_description.value = "trap drove your spider into a rage!";
						spider_panel_image.src = "chrome://nova-initia_toolbar/skin/images/overlays/spider_triggered.png";
						NovaInitia.Toolbar.show_panel(spider_panel);
						//NovaInitia.Toolbar.window_resized();
						spider_tool_amount -= 1;
						sg_tool_amount -= tmp_info.Sg===undefined?0:tmp_info.Sg;
						NovaInitia.Toolbar.shield_hit(false,true);
						NovaInitia.Toolbar.set_user_tool_amounts();
						spiderTimeout = this.autoClose(spiderTimeout,spider_panel.id, 3000);
					}
					
					if(theToolID == signpost_tool_id&&tmp_info.result=="Signpost Blocked!")
					{
						spider_panel_label.value = tmp_info.username+"'s";
						spider_panel_description.value = "spider blocked your signpost!";
						spider_panel_image.src = "chrome://nova-initia_toolbar/skin/images/overlays/signpost_blocked.jpg";
						NovaInitia.Toolbar.show_panel(spider_panel);
						//NovaInitia.Toolbar.window_resized();
						signpost_tool_amount -= 1;
						NovaInitia.Toolbar.set_user_tool_amounts();
						spiderTimeout = this.autoClose(spiderTimeout,spider_panel.id, 3000);
					}
					
				}
			}
			
			if(tmp_info.error)
			{
				this.send_notification(tmp_info.error,"PRIORITY_INFO_LOW");
			}
			
			if(ni.debug_set)
			{
				alert("tool response: "+theResponse.responseText);
				alert("tool laid ID: "+tmp_info.pageSet.ID);
			}
		};
		
		this.autoClose = function(obj,id,timeout)
		{
			clearTimeout(obj);
			return setTimeout("NovaInitia.Toolbar.dismiss_panel('"+id+"');",timeout);
		};
		
		/*	Called when a toolbar button is pressed
			what is the XUL object it's called from
		*/
		this.process_toolbutton = function(what, url)
		{
			if(url != null)
			{
				NovaInitia.Toolbar.process_page(url);
			}
		 	if(ni.debug_set)
		 		alert('ni.process_toolbutton: '+this);
		 	if(logged_in == true)
		 	{
		 	 	switch(what.id)
		 	 	{
					case 'nova_initia_tool_trap':
						if(at_a_page == true)
						{
						 	if(trap_tool_amount>0)
						 	{
						 	 	if(toolbar_throbber)
						 			toolbar_throbber.hidden=false;
								var tmp_tool_res = NovaInitia.Toolbar.send_request("http://"+url_prefix+server_url+"/rf/remog/page/"+cur_url_hash+"/"+cur_domain_hash+"/"+trap_tool_id+".json","POST",null,false,null,false,null);
								if(ni.debug_set)
								{
									alert("http://"+url_prefix+server_url+"/rf/remog/page/"+cur_url_hash+"/"+cur_domain_hash+"/"+trap_tool_id+".json");
									alert("tmp_tool_res status: "+tmp_tool_res.status);
								}
								if(tmp_tool_res.status==201||tmp_tool_res.status==200)
								{
									NovaInitia.Toolbar.check_tool_set(tmp_tool_res,trap_tool_id);
								}
								else
									this.send_notification("Bad Response, Trap Failed!","PRIORITY_INFO_LOW");
							}
							else
								this.send_notification("Out of Traps!","PRIORITY_INFO_LOW");
						}
						break;
	
					case 'nova_initia_tool_spider':
						if(at_a_page == true)
						{
						 	if(spider_tool_amount>0)
						 	{
						 	 	if(toolbar_throbber)
						 			toolbar_throbber.hidden=false;
								var tmp_tool_res = NovaInitia.Toolbar.send_request("http://"+url_prefix+server_url+"/rf/remog/page/"+cur_url_hash+"/"+cur_domain_hash+"/"+spider_tool_id+".json","POST",null,false,null,false);
								if(ni.debug_set)
								{
									alert("http://"+url_prefix+server_url+"/rf/remog/page/"+cur_url_hash+"/"+cur_domain_hash+"/"+spider_tool_id+".json");
									alert("tmp_tool_res status: "+tmp_tool_res.status);
								}
								if(tmp_tool_res.status==201 || tmp_tool_res.status==200)
								{
									NovaInitia.Toolbar.check_tool_set(tmp_tool_res,spider_tool_id);
								}
								else
									this.send_notification("Bad Response, Spider Failed!","PRIORITY_INFO_LOW");
							}
							else
								this.send_notification("Out of Spiders!","PRIORITY_INFO_LOW");
						}
						break;
						
					case 'nova_initia_tool_shield':
						if(shield_tool_amount>0)
						{
					 	 	if(toolbar_throbber)
					 			toolbar_throbber.hidden=false;
							//var tmp_tool_res = NovaInitia.Toolbar.send_request("http://"+url_prefix+server_url+"/rf/remog/page/"+cur_url_hash+"/"+cur_domain_hash+"/"+shield_tool_id+".json","POST",null,false,null,false,null);
							var tmp_tool_res = NovaInitia.Toolbar.send_request("http://"+url_prefix+server_url+"/rf/remog/user/shield.json","POST",null,false,null,false,null);
							if(ni.debug_set)
							{
								alert("http://"+url_prefix+server_url+"/rf/remog/user/shield");
								alert("tmp_tool_res status: "+tmp_tool_res.status);
								alert("tool response: "+tmp_tool_res.responseText);
							}
							if(tmp_tool_res.status==200)
							{
							 	var tmp_info = ni.JSON.parse(tmp_tool_res.responseText);
							 	if(tmp_info.user.ID)
							 	{
							 	 	user_JSON = tmp_info;
							 	 	NovaInitia.Toolbar.set_user_info();
							 		NovaInitia.Toolbar.set_user_shield(tmp_info.user.isShielded);
							 	}
							}
							else
							{
								ni.fail_panel_image.src = "chrome://nova-initia_toolbar/skin/images/overlays/shield_failed.jpg";
								NovaInitia.Toolbar.show_panel(fail_panel);
								//this.send_notification("Shield Use Failed!","PRIORITY_INFO_LOW");
						 	 	if(toolbar_throbber)
						 			toolbar_throbber.hidden=true;
							}
						}
						else
							this.send_notification("Out of Shields!","PRIORITY_INFO_LOW");
						break;
					case 'nova_initia_mail_send_button':
						var data = { "message" : { "ToID" : document.getElementById("nova_initia_mail_receiver").value, "Subject" : document.getElementById("nova_initia_mail_receiver").value, "Contents" : document.getElementById("nova_initia_mail_body").value}};
						//var data = "ID=&message%5BToID%5D="+document.getElementById("nova_initia_mail_receiver").value+"&message%5BSubject%5D="+document.getElementById("nova_initia_mail_receiver").value+"&message%5BContents%5D="+document.getElementById("nova_initia_mail_body").value;
						var send_mail = NovaInitia.Toolbar.send_request("http://"+url_prefix+server_url+"/rf/remog/mail.json","POST",JSON.stringify(data),true,function(){document.getElementById('nova_initia_mail_panel_popup').hidePopup();},false,null);
						break;
					case 'nova_initia_mail':
					case 'nova_initia_mail_read':
						this.openTab("http://www."+server_url+"/remog/mail?LASTKEY="+NovaInitia.Toolbar.getKey());
						break;
					case 'nova_initia_profile':
						this.openTab("http://www."+server_url+"/remog/user/"+ni.username.value+"?LASTKEY="+NovaInitia.Toolbar.getKey());  
						break;
					case 'nova_initia_events':
						this.openTab("http://www."+server_url+"/remog/events?LASTKEY="+NovaInitia.Toolbar.getKey());  
						break;
					case 'nova_initia_tool_sg':
						this.openTab("http://www."+server_url+"/remog/trade?LASTKEY="+NovaInitia.Toolbar.getKey());  
						break;
					/*
					case 'nova_initia_tool_signpost':
						if(signpost_tool_amount>0)
						{
							if(at_a_page)
							{
								var theParams = "Url="+ni.urlencode(cur_url);
								//alert("http://"+url_prefix+server_url+"/rf/remog/page/"+cur_url_hash+"/"+cur_domain_hash+"/"+signpost_tool_id+".json"+" Param: "+theParams);
								NovaInitia.Toolbar.send_request("http://"+url_prefix+server_url+"/rf/remog/page/"+cur_url_hash+"/"+cur_domain_hash+"/"+signpost_tool_id+".json","POST",theParams,true,NovaInitia.Toolbar.process_signpost_place,false,null);
							}
							else
								this.send_notification("Not At A Valid Page!","PRIORITY_INFO_LOW");
						}
						else
							this.send_notification("Out of Signposts!","PRIORITY_INFO_LOW");
						break;
					*/
				}
		 	 	//this.send_notification(what.id,"PRIORITY_INFO_LOW");
				if(url != null)
				{
					reTmpArray = ni.UrlToHash(the_URL,true);
					NovaInitia.Toolbar.set_url_hashes(reTmpArray,window.top.getBrowser().selectedBrowser.contentWindow.location.href);
				}
				//this.window_resized();
			}
			else
				alert('Please Login First');
			if(toolbar_throbber)
				toolbar_throbber.hidden=true;
		};
		
		/* Initiates the Firefox yellow notification bar */
		this.send_notification = function(notif,style)
		{
	 	 	gBrowser.getNotificationBox().removeAllNotifications(true);
			gBrowser.getNotificationBox().appendNotification(notif,"","",style,Array());
			//if(notification_timeout)
			//	clearTimeout(notification_timeout);
			
			var removeNotifications = function() {
				gBrowser.getNotificationBox().removeAllNotifications(false);
			}
			notifyTimeout = this.autoClose(notifyTimeout,removeNotifications,3000);
		};
		
		/* set the hashes for the page to the vars so they can be used later */
		this.set_url_hashes = function(theHashes,theCurUrl)
		{
			if(theCurUrl)
			{
				if(theCurUrl!=prev_url)
					prev_url = cur_url;
				cur_url = theCurUrl;
			}
			if(theHashes['url'])
				cur_url_hash = theHashes['url'];
			if(theHashes['domain'])
				cur_domain_hash = theHashes['domain'];
			if(ni.debug_set)
				alert("cur url hash: "+cur_url_hash+" cur domain hash: "+cur_domain_hash);
		};
		
		this.get_cur_url = function()
		{
			return cur_url;
		};
		
		/* logout of current user and return toolbar to initial state */
		this.logout = function(sendNotice)
		{
		 	if(ni.debug_set)
		 		alert("logout");
			this.dismiss_all_panels();
			ni.page_listener_functions.shutdown();
			user_cache.flush_all();
			location_cache.flush_all();
			doorway_cache.flush_all();
			toolbar.hidden=true;
			toolbar.collapsed=true;
			user_menu.hidden=true;
			if(ni.show_login_bar)
			{
				login_toolbar.hidden=false;
				login_toolbar.collapsed=false;
			}
			logged_in = false;
			logout_menuitem.hidden=true;
			login_menuitem.hidden=false;
		 	ni.prefManager.setCharPref("extensions.nova-initia.cur_username","");
		 	ni.prefManager.setCharPref("extensions.nova-initia.cur_ava_url","");
		 	ni.prefManager.setCharPref("extensions.nova-initia.cur_tagline","");
		 	ni.prefManager.setCharPref("extensions.nova-initia.cur_email","");
		 	ni.prefManager.setCharPref("extensions.nova-initia.cur_location","");
		 	ni.prefManager.setCharPref("extensions.nova-initia.cur_class","");
		 	ni.prefManager.setCharPref("extensions.nova-initia.cur_id","");
		 	ni.prefManager.setCharPref("extensions.nova-initia.cur_hash","");
			ni.cookieManager.remove("nova-initia.com","LastKey","/",false);
			if(sendNotice)
				this.send_notification("Logged out of Nova Initia","PRIORITY_INFO_LOW");
		};
		
		/* returns true is a user currently logged in */
		this.isLoggedIn = function()
		{
			return logged_in;
		};
		
		/* gets the current key */
		this.getKey = function()
		{
			if(ni.debug_set)
			 	alert("getKey: "+current_key);
			return current_key;
		};
		
		/* sets the current key */
		this.setKey = function(curKey)
		{
			if(ni.debug_set)
				alert("setKey: "+curKey);
			current_key = curKey;
		};
		
		/* function to check if an object is an array */
		this.isArray = function(obj)
		{
	    	return obj.constructor == Array;
		};
		
		/* show the toolbar throbber */
		this.showThrobber = function()
		{
		 	if(toolbar_throbber)
				toolbar_throbber.hidden=false;
		};
		
		/* hide the toolbar throbber */
		this.hideThrobber = function()
		{
		 	if(toolbar_throbber)
				toolbar_throbber.hidden=true;
		};
		
		/* set the at_a_page variable */
		this.setAtAPage = function(atAPage)
		{
			at_a_page=atAPage;
		};
		
		/* resets the current page number to 0 */
		this.reset_cur_page_num = function()
		{
			cur_page_num=0;
		};
		
		this.check_at_tour_start = function()
		{
			return at_tour_start;
		};
	
		this.set_at_tour_start = function(atTourStart)
		{
			at_tour_start = atTourStart;
		};
		
		this.get_in_a_tour = function()
		{
			return in_a_tour;
		};
	
		this.set_in_a_tour = function(inATour)
		{
			in_a_tour = inATour;
			if(inATour)
			{
				cur_tour_url=cur_url;
			}
		};
	
		this.get_cur_signpost_ID = function()
		{
			return cur_signpost_ID;
		};
	
		this.set_cur_signpost_ID = function(theID)
		{
			//prev_signpost_ID = cur_signpost_ID;
			cur_signpost_ID = theID;
			if(theID=="")
				cur_tour_group_ID = "";
		};
		
		this.get_cur_tour_info = function()
		{
			return cur_tour_info;
		};
		
		this.set_last_barrel_ID = function(theID)
		{
			last_barrel_ID = theID;
		};
		
		this.set_last_tour_ID = function(theID)
		{
			last_tour_ID = theID;
		};

		
		/* Functions that listen for page/tab/location changes and fires process_new_URL */
		ni.page_change_listener = 
		{
			alreadyChecked: false,
			QueryInterface: function (aIID)
			{
				if (aIID.equals(Components.interfaces.nsIWebProgressListener) || aIID.equals(Components.interfaces.nsISupportsWeakReference) || aIID.equals(Components.interfaces.nsISupports))
				{
					return this;
				}
				throw Components.results.NS_NOINTERFACE;
			},
			// gets called when the page changes (tabs included)
			onLocationChange: function (aProgress, aRequest, aURI)
			{
				function thread_process_new_URL()
				{
					ni.page_listener_functions.process_new_URL(aURI);
				}
				if (aURI)
				{
					if(NovaInitia.Toolbar.isLoggedIn())
						setTimeout(thread_process_new_URL, 100);		
				}
				this.alreadyChecked = false;
			},
			onStateChange: function (aWebProgress, aRequest, aFlag, aStatus)
			{
				if (aFlag & Components.interfaces.nsIWebProgressListener.STATE_STOP)
				{
				 	if(ni.debug_set)
						alert("STATE_STOP");
					this.alreadyChecked = true;
				}
			},
			onProgressChange: function () {},
			onStatusChange: function () {},
			onSecurityChange: function () {},
			onLinkIconAvailable: function () {}
		};
				
		/* Functions that get called when page/tab/location changes occur
		   initialize adds the progressListener to the page
		   shutdown disables the listener on page close
		   process_new_URL gets called when the page/tab/location is changed
		*/
		ni.page_listener_functions = 
		{
			initialize: function ()
			{
			 	if(ni.debug_set)
			 		alert('adding page progress listener');
				if(!ni.Toolbar.AutoSyncEnabled)
				{
					document.addEventListener("NovaInitiaSync"+ni.Toolbar.getKey(), function(e) { NovaInitia.Toolbar.sync_user(); }, false, true);
					NovaInitia.Toolbar.AutoSyncEnabled = true;
				}
				gBrowser.addProgressListener(ni.page_change_listener, Components.interfaces.nsIWebProgress.NOTIFY_STATE_DOCUMENT);
			},
			shutdown: function ()
			{
			 	if(ni.debug_set)
			 		alert('removing page progress listener')
				gBrowser.removeProgressListener(ni.page_change_listener);
				
				NovaInitia.Toolbar.setAtAPage(false);
			},
			process_new_URL: function (new_URI) 
			{
				NovaInitia.Toolbar.process_page(new_URI);
			}
		};
	
		/* adds tool found on a page to the theArray (usually tool_array) for processing */
		this.add_tool_to_found_array = function(theArray,theObj,theToolID)
		{
			//alert("theArray:"+theArray+" | theUser:"+theUser+" | theToolID:"+theToolID+" | theItemID:"+theItemID+" | theToolData"+theToolData);
			//alert("calling get_username for add_tool");
			var theUsername = NovaInitia.Toolbar.get_username(theObj.USERID);
			var tmp_tools_found_array = new Array(theToolID,theUsername,theObj.ID, theObj.Sg===undefined?null:theObj.Sg);
			if(theObj.toolData)
				tmp_tools_found_array[3]=theObj.toolData;
			theArray.push(tmp_tools_found_array);
			return theArray;
		};
		
		/* get a username from a user's ID */
		this.get_username = function(theUser)
		{
			var user_is_cached = user_cache.get(theUser);
			if(user_is_cached)
			{
			 	if(ni.debug_set)
				 	alert("cached user: "+user_is_cached[theUser]);
				return(user_is_cached[theUser]);
			}
			else
			{
				var tmp_user_res = NovaInitia.Toolbar.send_request("http://"+url_prefix+server_url+"/rf/remog/user/"+theUser+".json","GET",null,false,null,false,null);
				if(tmp_user_res.status==200)
				{
					//alert(theUser+" | "+tmp_user_res.responseText);
					var tmp_info = ni.JSON.parse(tmp_user_res.responseText);
					if(tmp_info['error'])
						NovaInitia.Toolbar.process_page_error(tmp_info['error']);
					else
					{
						if(tmp_info.user)
						{
							user_cache.add(theUser,tmp_info.user.UserName);
							return(tmp_info.user.UserName);
						}
					}
				}
			}
		};
	
		/* process the event results for the page */
		this.process_page = function(new_URI)
		{
			
		 	if(NovaInitia.Toolbar.isLoggedIn())
		 	{
			 	var the_URL = false;
			 	if(new_URI.spec)
			 		the_URL = new_URI.spec;
			 	else
			 		the_URL = new_URI;
				if(the_URL)
				{
			 	 	NovaInitia.Toolbar.dismiss_all_panels();
			 	 	NovaInitia.Toolbar.reset_cur_page_num();
			 	 	last_barrel_ID = "";
					last_tour_ID = "";
				 	if(acceptable_URL_starters.indexOf(the_URL.substring(0,5))>=0)
				 	{
				 		NovaInitia.Toolbar.showThrobber();
				 		NovaInitia.Toolbar.setAtAPage(true);
						var same_url = false;
				 	 	var standardized_url = ni.UrlToHash(the_URL,false);
				 	 	
				 	 	if(NovaInitia.Toolbar.get_cur_url()!=standardized_url)
				 	 		same_url = true;
						
						var location_cached = location_cache.get(standardized_url);
						var tmpArray = {};
						if(location_cached)
						{
						 	if(ni.debug_set)
						 		alert("url was cached");
							tmpArray['url'] = location_cached[standardized_url][0];
							tmpArray['domain'] = location_cached[standardized_url][1];
						}
						else
						{
					 		tmpArray = ni.UrlToHash(the_URL,true);
					 		var location_array = new Array(tmpArray['url'],tmpArray['domain']);
					 		location_cache.add(standardized_url,location_array);
						}
						NovaInitia.Toolbar.set_url_hashes(tmpArray,standardized_url);
				 	 	//alert("prevURL: "+NovaInitia.Toolbar.get_cur_url()+" | curURL: "+standardized_url+" | at_tour_start: "+NovaInitia.Toolbar.check_at_tour_start()+" | in_a_tour: "+NovaInitia.Toolbar.get_in_a_tour()+" | curSignpost: "+NovaInitia.Toolbar.get_cur_signpost_ID());
				 	 	var tmpCurTourInfo = NovaInitia.Toolbar.get_cur_tour_info();
						if(tmpCurTourInfo[1]&&tmpCurTourInfo[1]==standardized_url)
						{
							NovaInitia.Toolbar.set_in_a_tour(false);
							NovaInitia.Toolbar.process_tour(tmpCurTourInfo[0]);								
						}
						else
						{
					 	 	if(same_url)
					 	 	{
					 	 		
						 	 	NovaInitia.Toolbar.set_at_tour_start(false);
						 	 	if(NovaInitia.Toolbar.get_in_a_tour())
						 	 	{
									NovaInitia.Toolbar.set_in_a_tour(false);
									NovaInitia.Toolbar.process_tour(NovaInitia.Toolbar.get_cur_signpost_ID());
								}
								else
								{
									NovaInitia.Toolbar.set_cur_signpost_ID(null);
								}
						 	}
						 	else
						 	{
						 		//NovaInitia.Toolbar.set_in_a_tour(false);
								if(NovaInitia.Toolbar.get_cur_signpost_ID())
								{
									NovaInitia.Toolbar.process_tour(NovaInitia.Toolbar.get_cur_signpost_ID());
								}
							}
						}
	
				 	 	//alert(/^http:\/\/www.nova-initia.com\/rf\/remog\/group\/[0-9]+\.json$/.exec(standardized_url));
				 	 	var regexResult = /^http:\/\/www.nova-initia.com\/rf\/remog\/group\/[0-9]+$/.test(standardized_url);
				 	 	if(regexResult)
				 	 	{
				 	 		//alert("redirecting to: "+standardized_url+"?LASTKEY="+current_key);
							//NovaInitia.Toolbar.set_at_tour_start(standardized_url.match(/[0-9]+/));
							NovaInitia.Toolbar.redirect_to(standardized_url+"?LASTKEY="+current_key);
						}
						else
						{
							var regObj = new RegExp('^http:\\/\\/www.nova-initia.com\\/rf\\/remog\\/group\\/[0-9]+\\?LASTKEY='+current_key+'$');
							var regObj2 = new RegExp('^http:\\/\\/www.nova-initia.com\\/rf\\/remog\\/group\\/[0-9]+\\?LASTKEY='+current_key.toLowerCase()+'$');
							regexResult = regObj.test(the_URL);
							var regexResult2 = regObj2.test(the_URL);
							if(regexResult||regexResult2)
							{
								//alert("at a tour start page");
								//We're at the launch page, show the popup
								var tmpTourID = standardized_url.match(/[0-9]+/);
								if(tmpTourID&&!NovaInitia.Toolbar.get_in_a_tour())
								{
									NovaInitia.Toolbar.set_at_tour_start(tmpTourID);
									NovaInitia.Toolbar.process_tour(tmpTourID);
								}
							}
							if(NovaInitia.Toolbar.just_took_doorway())
							{
								NovaInitia.Toolbar.stepped_through_doorway();
								took_doorway = true;
							}
							else
								NovaInitia.Toolbar.set_last_doorwayID(null);
	
						 	var end = "."+url_prefix+server_url+"/rf/remog/page.json";
						 	var len = tmpArray['domain'].length;
						 	var domainStr = tmpArray['domain'].substring(0,len-1)+".x"+tmpArray['domain'].substring(len-1);
						 	var trackURL = "http://"+url_prefix+server_url+"/rf/remog/page/"+tmpArray['url']+"/"+tmpArray['domain']+".json";
						 	//var trackURL = "http://x"+tmpArray['url']+".x"+domainStr+end;
							//alert("resp: "+pageRes.responseText);
							function page_request_finished(pageRes)
							{
								if(ni.debug_set)
								{
									alert("Process: "+the_URL);
									alert("url hash: "+tmpArray['url']+" | domain hash: "+tmpArray['domain']+" | url: "+trackURL);
									alert("status: "+pageRes.status);
									alert("resp: "+pageRes.responseText);
								}
								if(pageRes.status==200)
								{
									doorway_carousel_array = new Array();
									var tmp_page_res = ni.JSON.parse(pageRes.responseText);
									if(tmp_page_res['error'])
										NovaInitia.Toolbar.process_page_error(tmp_page_res['error']);
									else
									{
										if(tmp_page_res.dns)
										{
											var splitUrl = /^[a-z]+:\/\/([a-z0-9][-a-z0-9]+(\.[a-z0-9][-a-z0-9]+)+)($|\/|\?)?[^#]*/.exec(cur_url);
											var domain = splitUrl[1];
											var add_dns_params = "&Hash="+cur_domain_hash+"&Url="+domain;
											var add_dns_req = NovaInitia.Toolbar.send_request("http://"+url_prefix+server_url+"/rf/remog/domain","POST",add_dns_params,true,function(){},false,null);
										}

										if(tmp_page_res.pageSet)
										{
											var tmp_tools_found_array = new Array();
											for(var i=0;i<=6;i++)
											{
												//alert(tmp_page_res.pageSet[i].ID);
												if(tmp_page_res.pageSet[i])
												{
													if(NovaInitia.Toolbar.isArray(tmp_page_res.pageSet[i]))
													{
														var tmp_page_array = tmp_page_res.pageSet[i];
														if(tmp_page_array)
														{
															var j=0;
															while(tmp_page_array[j])
															{
																if(tmp_page_array[j].ID)
																	tmp_tools_found_array = NovaInitia.Toolbar.add_tool_to_found_array(tmp_tools_found_array,tmp_page_array[j],i);
																j++;
															}
														}
													}
													else
													{
														if(tmp_page_res.pageSet[i].ID)
														{
															if(tmp_page_res.pageSet[i].toolData)
																tmp_tools_found_array = NovaInitia.Toolbar.add_tool_to_found_array(tmp_tools_found_array,tmp_page_res.pageSet[i],i);
															else
															{
																if(i!=3)
																	tmp_tools_found_array = NovaInitia.Toolbar.add_tool_to_found_array(tmp_tools_found_array,tmp_page_res.pageSet[i],i);
																else
																{
																	if(tmp_page_res.fail==true)
																		NovaInitia.Toolbar.shield_hit(true,true);
																}
															}
														} else if (typeof(tmp_page_res.pageSet[i].count) != "undefined") {
															if(i==6)
															{
																var count = tmp_page_res.pageSet[i].count;
																parent.document.getElementById("nova_initia_mail").label = count;
															}
														}
													}
												}
											}
											//salert(tmp_tools_found_array);
											if(tmp_tools_found_array.length>0)
												NovaInitia.Toolbar.found_tools(tmp_tools_found_array);
												
										}
									}
								}
								else
								{
									this.send_notification("Unable To Track!","PRIORITY_CRITICAL_HIGH");
								}
								NovaInitia.Toolbar.hideThrobber();
							}
							
							NovaInitia.Toolbar.send_request(trackURL,"GET",null,true,page_request_finished,false,null);
						}
					}
					else
					{
						if(ni.debug_set)
							alert("URL not trackable");
						NovaInitia.Toolbar.setAtAPage(false);
					}
				}
			}
		};
	
		/* process an error response from the server */
		this.process_page_error = function(theError)
		{
			switch(theError)
			{
				case 'Please sign in.':
					this.send_notification("Your session has expired, please login again.","PRIORITY_CRITICAL_HIGH");
					NovaInitia.Toolbar.logout(false);
					break;
			}
		};
	
		/* process the tools found */
		this.found_tools = function(theArray)
		{
		 	if(logged_in)
		 	{
				var i=0;
				var j=0;
				var panel_array = new Array();
				doorway_carousel_array = new Array();
				while(theArray[i])
				{
				 	if(tool_array[Number(theArray[i][0])])
				 	{
				 	 	if(Number(theArray[i][0])==trap_tool_id)
				 	 	{						
			 	 	 		trap_panel_label.value = theArray[i][1]+"'s";
							trap_panel_image.src = "chrome://nova-initia_toolbar/skin/images/overlays/trap_triggered.png";
							trap_panel_description.value = "trap was sprung!";
				 	 	 	if(ni.debug_set)
								alert("Trap Sprung");
							sg_tool_amount -= theArray[i][3] * 1;
							if (sg_tool_amount < 0) sg_tool_amount = 0;
							NovaInitia.Toolbar.shield_hit(true,false);
							NovaInitia.Toolbar.set_user_tool_amounts();
						}
				 	 	if(Number(theArray[i][0])==barrel_tool_id)
				 	 	{
				 	 		last_barrel_ID = theArray[i][2];
				 	 		barrel_panel_button.setAttribute("oncommand","NovaInitia.Toolbar.set_last_barrel_ID('');NovaInitia.Toolbar.open_barrel('"+theArray[i][2]+"','"+theArray[i][1]+"');");
				 	 		barrel_panel_label.value = theArray[i][1];
							barrel_panel_profile_button.label = "<< "+theArray[i][1]+"'s Profile";
							barrel_panel_profile_button.removeAttribute("oncommand");
							barrel_panel_profile_button.setAttribute("oncommand","gBrowser.selectedTab = gBrowser.addTab('http://www.nova-initia.com/remog/user/"+theArray[i][1]+"');");
							barrel_panel_image.src = "chrome://nova-initia_toolbar/skin/images/overlays/barrel_found.jpg";
							if(theArray[i][3])
							{
								barrel_panel_title_0.value = theArray[i][3].Title.substring(0,38);
								barrel_panel_title_1.value = theArray[i][3].Title.substring(38,76);
								barrel_panel_title_2.value = theArray[i][3].Title.substring(76,114);
							} else {
								barrel_panel_title_1.value = "hid a barrel here!";
							}
				 	 	}
				 	 	if(Number(theArray[i][0])==doorway_tool_id)
				 	 	{
				 	 		var tmp_carousel_array = new Array(theArray[i][2],theArray[i][1],theArray[i][3]);
				 	 		doorway_carousel_array.push(tmp_carousel_array);
				 	 	}
						if(Number(theArray[i][0])==signpost_tool_id)
				 	 	{
							last_tour_ID = theArray[i][2];
				 	 		signpost_panel_user_label.value = "by "+theArray[i][1];
				 	 		signpost_panel_title_label.value = ni.urldecode(theArray[i][3].Title);
							signpost_panel_goto_button.removeAttribute("oncommand");
							var tmpURL = "NovaInitia.Toolbar.redirect_to('http://www."+server_url+"/rf/remog/group/"+theArray[i][2]+"?LASTKEY="+current_key+"')";
							signpost_panel_goto_button.setAttribute("oncommand",tmpURL);
				 	 	}
					 	//tool_array[Number(theArray[i][0])][1].value = theArray[i][1];
						if(ni.debug_set)
						 	alert("opening panel with tool id: "+Number(theArray[i][0]));
						if(Number(theArray[i][0])!=spider_tool_id&&Number(theArray[i][0])!=doorway_tool_id)
						{
							if(!cur_signpost_ID)
							{
								if(Number(theArray[i][0])==signpost_tool_id)
								{
									if(cur_tour_group_ID!=theArray[i][2])
									{
										panel_array[j] = tool_array[Number(theArray[i][0])][0];
										j++;
									}
								}
								else
								{
						 			panel_array[j] = tool_array[Number(theArray[i][0])][0];
						 			j++;
						 		}
					 		}
					 	}
					}
					i++;
				}
				NovaInitia.Toolbar.setup_doorways(0);
				NovaInitia.Toolbar.show_panel(panel_array);
				//NovaInitia.Toolbar.window_resized();
			}
		};
		
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
			if(!noHeader)
			{
				if(theURL.indexOf("LASTKEY="+NovaInitia.Toolbar.getKey())==-1)
				{
					if(theURL.indexOf("?")==-1)
						theURL += "?";
					theURL += "&LASTKEY="+NovaInitia.Toolbar.getKey();
				}	
			}
			
			var filter_NSFW = ni.prefManager.getBoolPref("extensions.nova-initia.filter_nsfw_all");
			
			if(NovaInitia.Toolbar.just_took_doorway())
			{
				var doorway_cached = doorway_cache.get(last_doorwayID);
				var tmpDoorwayInfo = ni.JSON.parse(doorway_cached[last_doorwayID]);
				theGroupID = tmpDoorwayInfo.doorway.GroupID;
			}
			
			var theReq = new XMLHttpRequest();
			
			theReq.overrideMimeType("application/json");
			if(nonBlock)
			{
				theReq.onreadystatechange=function()
				{
					if(theReq.readyState==4)
					{
						if(typeof(callback)=="function")
							callback(theReq);
					}
				}
			}
			
			/*var isPost = (typeof(theParams) === "string")
			
			ni.jQuery.post({
				url: theUrl,
				type: theMethod,
				data: isPost ? theParams : ni.JSON.stringify(theParams),
				dataType : isPost ? null : "JSON"
			})*/
			theReq.open(theMethod,theURL,nonBlock);
			if(typeof(theParams) === "string")
			{
				theReq.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
			} else {
				theReq.setRequestHeader("Content-type", "application/json");
				theParams = ni.JSON.stringify(theParams);
			}
			if(!noHeader)
				theReq.setRequestHeader("X-NOVA-INITIA-LASTKEY", NovaInitia.Toolbar.getKey());
			if(theGroupID)
				theReq.setRequestHeader("X-NOVA-INITIA-GROUPID",theGroupID);
			if(filter_NSFW==true)
				theReq.setRequestHeader("X-NOVA-INITIA-FILTER-NSFW", filter_NSFW);
			if(theParams)
				theReq.send(theParams);
			else
				theReq.send(null);
			if(!nonBlock)
				return theReq;
		};

		this.createThumbnail = function()
		{
			var canvasW = 320;
			var canvasH = 240;

			var w = content.document.body.clientWidth + content.scrollMaxX;
			var cw = content.document.documentElement.clientWidth + content.scrollMaxX;
			var offsetW = (cw - w) / 2;
			if (w > 10000) w = 10000;
			
			var scale = canvasW/w;
			var ratio = canvasH/canvasW;
			var maxY = Math.round(w*ratio);
			
			var h = content.document.documentElement.clientHeight + content.scrollMaxY;
			if (h > 10000) h = 10000;
			if (h > maxY) h = maxY;
			
			var canvas = content.document.createElement("canvas");
			canvas.style.width = canvasW+"px";
			canvas.style.height = canvasH+"px";
			canvas.id = "c"+Math.random().toString().substring(2);
			canvas.width = canvasW;
			canvas.height = canvasH;
			canvas.style.position="absolute";
			canvas.style.top="0px";
			canvas.style.left="0px";
			//var newcanvas = content.document.getElementById(canvas.id);
			var ctx = canvas.getContext("2d");
			ctx.clearRect(0, 0, canvasW, canvasH);
			
			ctx.save();
			ctx.scale(scale, scale);
			ctx.drawWindow(content, offsetW, 0, w, h, "rgb(0,0,0)");
			
			ctx.restore();
			content.document.body.appendChild(canvas);
		};

	
		this.toggleTextAndButtons = function(panel)
		{
			var buttons = document.getElementById(panel.id+"_buttons");
			var text = document.getElementById(panel.id+"_text");
			if(!text)
			{
				text = document.getElementById(panel.id+"_title_label");
			}
			
			var count = document.getElementById(panel.id+"_count");
	
			if(buttons)
			{
				buttons.style.display = "none";
				if(text)
					text.style.display = "-moz-box";
				if(count)
					count.style.display = "-moz-box";
		
				panel.onmouseover = function(){
					if(text)
						text.style.display = "none";
					if(count)
						count.style.display = "none";
					buttons.style.display = "";
					var disabled = buttons.querySelectorAll("button[noshow]");
					if(disabled)
					{
						for(var b in disabled)
						{
							if(disabled[b].style)
								disabled[b].style.visibility="hidden";
						}
					}
				};
			
				panel.onmouseout = function(){
					if(text)
						text.style.display = "-moz-box";
					if(count)
						count.style.display = "-moz-box";
					buttons.style.display = "none";
					var disabled = buttons.querySelectorAll("button[noshow]");
					if(disabled)
					{
						for(var b in disabled)
						{
							if(disabled[b].style)
								disabled[b].style.visibility="visible";
						}
					}

				};
			}
		};
		
	};

	ni.panels_open = false;
	window.addEventListener('load',ni.initialize_toolbar,false);

})(NovaInitia);

window.document.addEventListener('resize',NovaInitia.Toolbar.window_resized,false);
window.document.addEventListener('keydown',NovaInitia.Toolbar.capture_key,false);