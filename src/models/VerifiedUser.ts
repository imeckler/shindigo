import mongoose from "mongoose";

export interface IVerifiedUser extends mongoose.Document {
    phone: string;
    name: string;
    email?: string;
    lastVerified: Date;
    verificationCode?: string;
    verificationCodeExpires?: Date;
}

const VerifiedUserSchema = new mongoose.Schema({
    phone: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    name: {
        type: String,
        required: false,
        trim: true
    },
    email: {
        type: String,
        trim: true
    },
    lastVerified: {
        type: Date,
        default: Date.now
    },
    verificationCode: {
        type: String,
        trim: true
    },
    verificationCodeExpires: {
        type: Date
    }
});

export default mongoose.model<IVerifiedUser>("VerifiedUser", VerifiedUserSchema);
