import { Request, Response, NextFunction } from 'express';
import { getUserFromToken } from '../tokenService.js';

/**
 * Middleware to add verified user information to the request
 * This doesn't block the request if no user is found
 */
export async function addUserToContext(req: Request, res: Response, next: NextFunction) {
    try {
        // Get the verification token from cookies or headers
        const verificationToken = 
            req.cookies?.phone_verification || 
            req.headers['x-phone-verification'] as string;
        
        if (verificationToken) {
            // Get the user information from the token
            const user = await getUserFromToken(verificationToken);
            
            if (user) {
                // Add the user to the request object
                req.verifiedUser = user;
                
                console.log('hihi', user);
                // Also add to the response locals for template rendering
                res.locals.verifiedUser = {
                    name: user.name,
                    phone: user.phone,
                    email: user.email
                };
            }
        }
        
        // Continue with the request
        next();
    } catch (error) {
        console.error('Error in user context middleware:', error);
        next();
    }
}
