function placeTrap() {
    if (hasSpider()) {
    trapDamage();
    }	
    else if (trapLimit()) {
	document.write ("Trap limit reached");
    }
    else {
			// Trap Placed ??
    }	

    if (isGiver()) {		//May not belong here
	xp = xp + 5;
    }
}