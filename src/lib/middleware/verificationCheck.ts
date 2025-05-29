import { Request, Response, NextFunction } from 'express';
import twilioService from '../twilio.js';
import { getVerifiedPhoneFromToken } from '../tokenService.js';
import Event from '../../models/Event.js';

/**
 * Middleware to ensure that phone verification is required and enforced
 * when enabled in the config. 
 * 
 * This simplified approach just checks if the user has a valid phone verification token,
 * and then checks if that phone number matches the appropriate phone for the action.
 */
export const requirePhoneVerification = async (req: Request, res: Response, next: NextFunction) => {
    // Skip if phone verification is not required in config
    if (!twilioService.isVerificationRequired()) {
        return next();
    }
    
    try {
        const eventID = req.params.eventID;
        
        if (!eventID) {
            return next(); // No event ID, not a route that needs verification
        }
        
        // Get the verification token from the cookie or header
        const verificationToken = 
            req.cookies?.phone_verification || 
            req.headers['x-phone-verification'] as string;
        
        // Get the verified phone number from the token
        const verifiedPhone = verificationToken ? getVerifiedPhoneFromToken(verificationToken) : null;
        
        // No verified phone number
        if (!verifiedPhone) {
            return res.status(403).json({
                error: "Phone verification required",
                requiresVerification: true
            });
        }
        
        // Determine if this is a creator action
        const isCreatorAction = !!req.body.editToken || req.query.e;
        const attendeeID = req.params.attendeeID;
        
        // Find the event
        const event = await Event.findOne({ id: eventID });
        if (!event) {
            return res.status(404).json({ error: "Event not found" });
        }
        
        if (isCreatorAction) {
            // Check if the verified phone matches the creator's phone
            if (!event.creatorPhone || event.creatorPhone !== verifiedPhone) {
                return res.status(403).json({
                    error: "Creator phone verification required",
                    requiresVerification: true
                });
            }
        } else if (attendeeID) {
            // Attendee action - find the attendee
            const attendee = event.attendees?.find(a => a._id.toString() === attendeeID);
            if (!attendee) {
                return res.status(404).json({ error: "Attendee not found" });
            }
            
            // Check if the verified phone matches the attendee's phone
            if (!attendee.phoneNumber || attendee.phoneNumber !== verifiedPhone) {
                return res.status(403).json({
                    error: "Attendee phone verification required",
                    requiresVerification: true
                });
            }
        }
        
        // Verification passed, proceed to the next middleware
        next();
    } catch (error) {
        console.error('Error in phone verification middleware:', error);
        res.status(500).json({ error: "Server error checking verification status" });
    }
};