/**
 * Geolocation utility functions
 */

/**
 * Calculate distance between two points using the Haversine formula
 * @param {Array} coords1 - [longitude, latitude] of first point
 * @param {Array} coords2 - [longitude, latitude] of second point
 * @returns {Number} Distance in kilometers
 */
exports.calculateDistance = (coords1, coords2) => {
    const [lng1, lat1] = coords1;
    const [lng2, lat2] = coords2;
    
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lng2 - lng1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    const distance = R * c; // Distance in km
    
    return Math.round(distance * 10) / 10; // Round to 1 decimal place
};

/**
 * Get approximate address (city/area) from full address
 * @param {String} address - Full address
 * @returns {String} Approximate address (city/area)
 */
exports.getApproximateAddress = (address) => {
    if (!address) return 'Unknown';
    
    const addressParts = address.split(',');
    
    if (addressParts.length > 1) {
        return addressParts.slice(1).join(',').trim();
    }
    
    return address;
};

/**
 * Check if coordinates are valid
 * @param {Array} coordinates - [longitude, latitude] coordinates
 * @returns {Boolean} True if coordinates are valid
 */
exports.isValidCoordinates = (coordinates) => {
    if (!Array.isArray(coordinates) || coordinates.length !== 2) {
        return false;
    }
    
    const [lng, lat] = coordinates;
    
    // Check if coordinates are within valid ranges
    if (isNaN(lng) || isNaN(lat)) {
        return false;
    }
    
    if (lng < -180 || lng > 180) {
        return false;
    }
    
    if (lat < -90 || lat > 90) {
        return false;
    }
    
    // Check for default/empty values
    if (lng === 0 && lat === 0) {
        return false;
    }
    
    return true;
};
