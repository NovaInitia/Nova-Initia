function trapDamage(trapAge) {
    if (hasShield()) {    		//Not sure how to check for user with shield up
	return Shield.strength --;
    }
    else {
	switch(trapAge) {
	case trapAge <= 7: 			//trapAge in days per normal calendar
	    sg = sg - 10;
	    break;
	case trapAge <= 28:
	    sg = sg - 15;
	    break;
	case trapAge <= 91:
	    sg = sg - 20;
	    break;
	case trapAge <= 182:
	    sg = sg - 25;
	    break;
	default:
	    sg = sg - 50;
	}
	return sg;
    }
}