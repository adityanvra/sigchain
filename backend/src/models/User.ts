import mongoose, { Document as MongoDoc, Schema } from "mongoose";
import bcrypt from "bcryptjs";

export type UserRole = "admin" | "staff_akademik" | "staff_administrasi";

export interface IUser extends MongoDoc {
  nama: string;
  email: string;
  password: string;
  role: UserRole;
  walletAddress?: string;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidate: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    nama: { type: String, required: true, trim: true, maxlength: 120 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ["admin", "staff_akademik", "staff_administrasi"],
      required: true,
      default: "staff_administrasi",
    },
    walletAddress: {
      type: String,
      lowercase: true,
      trim: true,
      default: null,
    },
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = function (candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.password);
};

userSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete (ret as { password?: string }).password;
    return ret;
  },
});

export const User = mongoose.model<IUser>("User", userSchema);
