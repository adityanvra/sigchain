const bcryptHashOfPassword123 = "$2a$12$u1Q3Qr0m8b8m1m9oQ PLACEHOLDER — use `npm run seed`";

db = db.getSiblingDB("sigchain");

const now = new Date();

db.users.updateOne(
  { email: "admin@uad.ac.id" },
  {
    $setOnInsert: {
      nama: "Administrator UAD",
      email: "admin@uad.ac.id",
      password: bcryptHashOfPassword123,
      role: "admin",
      walletAddress: null,
      createdAt: now,
      updatedAt: now,
    },
  },
  { upsert: true }
);

db.users.updateOne(
  { email: "akademik@uad.ac.id" },
  {
    $setOnInsert: {
      nama: "Staff Akademik UAD",
      email: "akademik@uad.ac.id",
      password: bcryptHashOfPassword123,
      role: "staff_akademik",
      walletAddress: null,
      createdAt: now,
      updatedAt: now,
    },
  },
  { upsert: true }
);

db.users.updateOne(
  { email: "administrasi@uad.ac.id" },
  {
    $setOnInsert: {
      nama: "Staff Administrasi UAD",
      email: "administrasi@uad.ac.id",
      password: bcryptHashOfPassword123,
      role: "staff_administrasi",
      walletAddress: null,
      createdAt: now,
      updatedAt: now,
    },
  },
  { upsert: true }
);

db.users.createIndex({ email: 1 }, { unique: true });
db.documents.createIndex({ hashDokumen: 1 });
db.documents.createIndex({ uploader: 1 });
db.documents.createIndex({ status: 1 });
db.signatures.createIndex({ documentId: 1 });
db.audittrails.createIndex({ timestamp: -1 });

print("Seed complete. NOTE: replace the placeholder bcrypt hash or use `npm run seed`.");
