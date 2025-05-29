import jwt from 'jsonwebtoken';
import { getConfig } from './config.js';
import VerifiedUser, { IVerifiedUser } from '../models/VerifiedUser.js';
import { Request, } from "express";

const config = getConfig();

export function getVerifiedPhoneFromRequest(req: Request): string | null {
    // Get the verification token from the request
    const verificationToken = 
        req.cookies?.phone_verification || 
        req.headers['x-phone-verification'] as string;

    if (!verificationToken) {
      return null;
    }

    const decoded = verifyPhoneVerificationToken(verificationToken);
    if (!decoded) {
      return null;
    }

    return decoded.phone;
}

// Token types for phone verification - enhanced with user info
export type PhoneVerificationTokenPayload = {
    type: 'phone_verification';
    phone: string;
    name?: string;
    email?: string;
    iat: number;
    exp: number;
};

/**
 * Generate a JWT token for phone verification
 * This token will be stored in a cookie and used to authenticate verified phone numbers
 * Now includes optional user name and email
 */
export function generatePhoneVerificationToken(
    phone: string,
    name?: string,
    email?: string
): string {
    // Use JWT secret from config or generate a random one
    const jwtSecret = config.jwt?.secret || 'gathio-verification-secret';
    
    // Create payload with the verified phone number and optional user info
    const payload: Omit<PhoneVerificationTokenPayload, 'iat' | 'exp'> = {
        type: 'phone_verification',
        phone,
        name,
        email
    };
    
    // Generate token with 7-day expiration
    return jwt.sign(
        payload,
        jwtSecret,
        { expiresIn: '7d' }
    );
}

/**
 * Verify a phone verification token
 * Returns the decoded token payload if valid, null otherwise
 * The jwt.verify function already checks that the token has not expired
 */
export function verifyPhoneVerificationToken(token: string): PhoneVerificationTokenPayload | null {
    const jwtSecret = config.jwt?.secret || 'gathio-verification-secret';
    
    try {
        const decoded = jwt.verify(token, jwtSecret) as PhoneVerificationTokenPayload;
        
        // Ensure the token is a phone verification token
        if (decoded.type !== 'phone_verification') {
            return null;
        }
        
        return decoded;
    } catch (error) {
        console.error('Error verifying token:', error);
        return null;
    }
}

/**
 * Extract the verified phone number from a token
 * Returns the phone number if valid, null otherwise
 */
export function getVerifiedPhoneFromToken(token: string): string | null {
    const decoded = verifyPhoneVerificationToken(token);
    
    if (!decoded) {
        return null;
    }
    
    return decoded.phone;
}

/**
 * Store verified user information in the database
 * This creates or updates a VerifiedUser record
 */
export async function storeVerifiedUser(
    phone: string,
    name: string,
    email?: string
): Promise<IVerifiedUser> {
    try {
        // Try to find an existing user first
        const existingUser = await VerifiedUser.findOne({ phone });
        
        if (existingUser) {
            // Update existing user
            existingUser.name = name;
            if (email) existingUser.email = email;
            existingUser.lastVerified = new Date();
            
            return await existingUser.save();
        } else {
            // Create a new user
            const newUser = new VerifiedUser({
                phone,
                name,
                email,
                lastVerified: new Date()
            });
            
            return await newUser.save();
        }
    } catch (error) {
        console.error('Error storing verified user:', error);
        throw error;
    }
}

/**
 * Get verified user information from the database
 * Returns the user if found, null otherwise
 */
export async function getVerifiedUser(phone: string): Promise<IVerifiedUser | null> {
    try {
        return await VerifiedUser.findOne({ phone });
    } catch (error) {
        console.error('Error retrieving verified user:', error);
        return null;
    }
}

/**
 * Get verified user information from a token
 * This combines verifying the token and retrieving the user from the database
 */
export async function getUserFromToken(token: string): Promise<IVerifiedUser | null> {
    const decoded = verifyPhoneVerificationToken(token);
    
    if (!decoded) {
        return null;
    }
    
    return await getVerifiedUser(decoded.phone);
}
