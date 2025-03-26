/**
 * Location utility functions to standardize location operations
 */

/**
 * Validates coordinates and ensures they're in the correct format
 * @param {number|string} latitude - Latitude coordinate
 * @param {number|string} longitude - Longitude coordinate
 * @returns {Object} - Validated location object or null
 */
const validateCoordinates = (latitude, longitude) => {
    // Convert to numbers
    let lat = parseFloat(latitude);
    let lng = parseFloat(longitude);
    
    // Check if valid numbers
    if (isNaN(lat) || isNaN(lng)) {
        console.error(`Invalid coordinates: lat=${latitude}, lng=${longitude}`);
        return null;
    }
    
    // Check coordinate ranges
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        console.error(`Coordinates out of range: lat=${lat}, lng=${lng}`);
        return null;
    }
    
    // Return in GeoJSON format [longitude, latitude] with type Point
    return {
        type: 'Point',
        coordinates: [lng, lat]  // GeoJSON uses [longitude, latitude] order
    };
};

/**
 * Calculates distance between two points using Haversine formula
 * @param {Array} coords1 - [longitude, latitude]
 * @param {Array} coords2 - [longitude, latitude]
 * @returns {number} - Distance in kilometers
 */
const calculateDistance = (coords1, coords2) => {
    if (!coords1 || !coords2 || coords1.length < 2 || coords2.length < 2) {
        return -1;
    }
    
    // Extract coordinates - expecting [lng, lat] format
    const lng1 = coords1[0];
    const lat1 = coords1[1];
    const lng2 = coords2[0];
    const lat2 = coords2[1];
    
    // Haversine formula
    const R = 6371; // Earth's radius in km
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
        Math.sin(dLng/2) * Math.sin(dLng/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return Math.round((R * c) * 10) / 10; // Distance in km, rounded to 1 decimal
};

/**
 * Convert degrees to radians
 */
const toRad = (value) => (value * Math.PI) / 180;

/**
 * Logs location information for debugging
 */
const logLocationInfo = (message, location) => {
    if (!location || !location.coordinates) {
        console.log(`${message}: Invalid location`);
        return;
    }
    
    const [lng, lat] = location.coordinates;
    console.log(`${message}: [lng=${lng}, lat=${lat}]`);
};

module.exports = {
    validateCoordinates,
    calculateDistance,
    logLocationInfo
};
