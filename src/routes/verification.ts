import { Router, Request, Response } from "express";
import twilioService from "../lib/twilio.js";
import { addToLog } from "../helpers.js";
import { generatePhoneVerificationToken } from "../lib/tokenService.js";
import VerifiedUser from '../models/VerifiedUser';
const router = Router();

// Route to clear verification cookies when a user signs out
router.post("/clear-verification", (req: Request, res: Response) => {
    // Clear the verification token cookie - be explicit about options
    res.clearCookie('phone_verification', {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
    });
    
    // Send a success response
    res.status(200).redirect('/');
});

router.post("/user-info", async (req: Request, res: Response) => {
    try {
      const { name, email } = req.body;

      // First check if there's already a valid verification token for this phone number
      const tokenService = await import('../lib/tokenService.js');

      // Get the verification token from the request
      const verificationToken = 
          req.cookies?.phone_verification || 
          req.headers['x-phone-verification'] as string;
      if (!verificationToken) {
        throw 'No verification token';
      }

      const decoded = tokenService.verifyPhoneVerificationToken(verificationToken);
      if (!decoded) {
        throw 'bad token';
      }

      const verifiedUser = await import('../models/VerifiedUser.js').then(m => m.default);
      const userRecord = await verifiedUser.findOne({ phone: decoded.phone });
      if (!userRecord) {
        throw `no user with number ${decoded.phone}`;
      }

      userRecord.name = name;
      userRecord.email = email;
      await userRecord.save();
      console.log(userRecord);
      console.log(userRecord.name);

      return res.status(200).json({ 
          success: true,
      });
    } catch (error) {
        console.error('Error setting user info:', error);
        return res.status(500).json({ 
            success: false, 
            message: `Failed to set user info: ${error}`
        });
    }
});

// Send verification code for direct sign-in
router.post("/send-verification", async (req: Request, res: Response) => {
    try {
        const { phone } = req.body;
        
        if (!phone) {
            return res.status(400).json({ success: false, message: "Phone number is required" });
        }
        
        // Send verification code to user's phone
        await twilioService.sendVerificationCode(phone);
        
        addToLog(
            "sendVerificationCode",
            "success",
            `Verification code sent to phone ${phone} for sign-in`
        );
        
        return res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error sending verification code:', error);
        return res.status(500).json({ 
            success: false, 
            message: `Failed to send verification code: ${error}`
        });
    }
});

// Verify code for direct sign-in
router.post("/verify-code", async (req: Request, res: Response) => {
    try {
        const { phone, verificationCode } = req.body;
        
        if (!phone || !verificationCode) {
            return res.status(400).json({ success: false, message: "Phone number and verification code are required" });
        }

        // Verify the code
        const isVerified = await twilioService.checkVerificationCode(
            phone,
            verificationCode,
        );

        console.log('hi', phone, isVerified);
        switch (isVerified.status) {
          case 'failed':
            console.error('Error verifying phone');
            return res.status(500).json({ 
                success: false, 
                message: "Failed to verify phone number"
            });
            return res.status(400).json({ 
                success: false,
                message: "Invalid verification code" 
            });
          case 'ok':
            addToLog(
                "verifyPhone",
                "success",
                `Phone ${phone} successfully verified for sign-in ${verificationCode}`
            );
            
            // Generate verification token and set it as a cookie
            const verificationToken = generatePhoneVerificationToken(
                phone,
            );

            // Set the token in a cookie (secure, HTTP-only)
            res.cookie('phone_verification', verificationToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
                sameSite: 'lax'
            });
            
            return res.status(200).json({ 
                success: true,
                newUser: isVerified.newUser,
                name: isVerified.record.name,
                email: isVerified.record.email,
                verificationToken 
            });
        }
    } catch (error) {
        console.error('Error verifying phone:', error);
        return res.status(500).json({ 
            success: false, 
            message: "Failed to verify phone number"
        });
    }
});

// Resend verification code for direct sign-in
router.post("/resend-verification", async (req: Request, res: Response) => {
    try {
        const { phone } = req.body;
        
        if (!phone) {
            return res.status(400).json({ success: false, message: "Phone number is required" });
        }
        
        // Send verification code to user's phone
        await twilioService.sendVerificationCode(phone);
        
        addToLog(
            "resendVerification",
            "success",
            `Verification code resent to phone ${phone} for sign-in`
        );
        
        return res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error resending verification code:', error);
        return res.status(500).json({ 
            success: false, 
            message: "Failed to resend verification code"
        });
    }
});

export default router;
