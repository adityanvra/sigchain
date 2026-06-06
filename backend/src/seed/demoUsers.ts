import { User } from "../models/User";

export const demoUsers = [
  {
    nama: "Administrator UAD",
    email: "admin@uad.ac.id",
    password: "password123",
    role: "admin" as const,
  },
  {
    nama: "Staff Akademik UAD",
    email: "akademik@uad.ac.id",
    password: "password123",
    role: "staff_akademik" as const,
  },
  {
    nama: "Staff Administrasi UAD",
    email: "administrasi@uad.ac.id",
    password: "password123",
    role: "staff_administrasi" as const,
  },
];

/** Creates the 3 demo accounts if they do not already exist. Returns count created. */
export async function ensureDemoUsers(log = true): Promise<number> {
  let created = 0;
  for (const u of demoUsers) {
    const exists = await User.findOne({ email: u.email });
    if (exists) continue;
    await User.create(u);
    created += 1;
    if (log) console.log(`[seed] created ${u.role}: ${u.email} (password: password123)`);
  }
  return created;
}
