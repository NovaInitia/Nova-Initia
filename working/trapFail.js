function isFailure(level) {
    return parseInt(Math.random()*100) < (6 - (level/5));
}