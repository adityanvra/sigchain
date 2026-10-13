import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { once } from "node:events";
import { test } from "node:test";
import { ethers } from "ethers";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { PDFDocument, PDFName, PDFDict } from "pdf-lib";
import nodemailer from "nodemailer";

test("server recording: API, PDF, identity, chain proof and retry", { timeout: 120_000 }, async () => {
  // All credentials are isolated test credentials. Never load the user's wallet.
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = "isolated-server-signing-test-secret";
  process.env.SEPOLIA_RPC_URL = "";
  process.env.CONTRACT_ADDRESS = "";
  process.env.BLOCKCHAIN_PRIVATE_KEY = "";
  process.env.MONGODB_URI = "";
  process.env.SMTP_HOST = "";
  process.env.SMTP_FROM = "";
  const rpc = process.env.TEST_CHAIN_RPC_URL;
  let provider: ethers.JsonRpcProvider | undefined;
  let recorderAddress = "0x1111111111111111111111111111111111111111";
  if (rpc) {
    provider = new ethers.JsonRpcProvider(rpc);
    const recorder = ethers.Wallet.createRandom().connect(provider);
    const funding = await (await provider.getSigner(0)).sendTransaction({ to: recorder.address, value: ethers.parseEther("1") });
    await funding.wait();
    const artifact = JSON.parse(readFileSync(path.resolve("../smart_contract/artifacts/contracts/DocumentSignatureRegistry.sol/DocumentSignatureRegistry.json"), "utf8"));
    const contract = await new ethers.ContractFactory(artifact.abi, artifact.bytecode, recorder).deploy();
    await contract.waitForDeployment();
    process.env.SEPOLIA_RPC_URL = rpc;
    process.env.CHAIN_ID = String((await provider.getNetwork()).chainId);
    process.env.CONTRACT_ADDRESS = await contract.getAddress();
    process.env.BLOCKCHAIN_PRIVATE_KEY = recorder.privateKey;
    recorderAddress = recorder.address.toLowerCase();
  }
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  const { createApp } = await import("../src/app");
  const { ensureDemoUsers } = await import("../src/seed/demoUsers");
  const { User } = await import("../src/models/User");
  const { DocumentModel } = await import("../src/models/Document");
  const { Signature } = await import("../src/models/Signature");
  const { blockchain } = await import("../src/services/blockchainService");
  const { env } = await import("../src/config/env");
  await ensureDemoUsers(false);
  await User.create({ nama: "Other approver", email: "other@test.invalid", password: "password123", role: "staff_akademik" });
  const server = createApp().listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as { port: number };
  const base = `http://127.0.0.1:${address.port}/api`;
  async function request(route: string, token?: string, body?: unknown, method?: string) {
    const response = await fetch(base + route, {
      method: method || (body === undefined ? "GET" : "POST"),
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body instanceof FormData || body === undefined ? {} : { "Content-Type": "application/json" }) },
      body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, json: await response.json() as any };
  }
  let checks = 0;
  const check = (name: string) => { checks++; console.log(`PASS ${checks}: ${name}`); };
  try {
    const login = await request("/auth/login", undefined, { email: "akademik@uad.ac.id", password: "password123" });
    assert.equal(login.status, 200);
    const token = login.json.token;
    const approverId = login.json.user._id;
    for (const credentials of [
      { email: "akademik@uad.ac.id", password: "wrong-password" },
      { email: "missing@test.invalid", password: "password123" },
      { email: "missing@test.invalid", password: "wrong-password" },
    ]) {
      const rejected = await request("/auth/login", undefined, credentials);
      assert.equal(rejected.status, 401);
      assert.equal(rejected.json.message, "Email atau password salah");
    }
    const other = await request("/auth/login", undefined, { email: "other@test.invalid", password: "password123" });
    const image = new FormData();
    image.append("image", new Blob([Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF9sAAAAASUVORK5CYII=", "base64")], { type: "image/png" }), "signature.png");
    assert.equal((await request("/academic-signatures", token, image)).status, 201);
    async function preparedDocument(label: string) {
      const pdf = await PDFDocument.create();
      pdf.addPage().drawText(label);
      const form = new FormData();
      form.append("file", new Blob([await pdf.save()], { type: "application/pdf" }), `${label}.pdf`);
      const upload = await request("/documents", token, form);
      assert.equal(upload.status, 201);
      assert.equal(upload.json.document.hashDokumen, "");
      const id = upload.json.document._id;
      assert.equal((await request(`/documents/${id}/sign/confirm`, token, {})).status, 400);
      const applied = await request(`/documents/${id}/apply-signature`, token, { page: 0, x: 30, y: 30, width: 80, height: 30 });
      assert.equal(applied.status, 200);
      assert.equal(applied.json.document.status, "PENDING_BLOCKCHAIN");
      assert.equal(applied.json.hash.length, 64);
      return { id, hash: applied.json.hash };
    }
    const doc = await preparedDocument("server signing");
    check("four login combinations; all failures use the same generic message");
    check("upload -> visual signature -> final PDF/hash; draft cannot be anchored");
    assert.equal((await request(`/documents/${doc.id}/sign/confirm`, undefined, {})).status, 401);
    assert.equal((await request(`/documents/${doc.id}/sign/confirm`, other.json.token, {})).status, 403);
    check("unauthenticated and unrelated users cannot spend server wallet");
    assert.equal((await request(`/documents/${doc.id}/sign/confirm`, token, { walletAddress: recorderAddress, signature: "forged", transactionHash: "0x" + "f".repeat(64) })).status, 400);
    check("client-supplied wallet/signature/transaction rejected");
    const results = await Promise.all([request(`/documents/${doc.id}/sign/confirm`, token, {}), request(`/documents/${doc.id}/sign/confirm`, token, {})]);
    assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
    const signed = results.find(r => r.status === 200)!.json;
    assert.equal(signed.document.status, "SIGNED");
    assert.equal(signed.signature.signer, approverId);
    assert.equal(signed.document.walletAddress, recorderAddress);
    assert.equal(signed.signature.recordingMethod, "server_wallet");
    assert.equal(await Signature.countDocuments({ documentId: doc.id }), 1);
    assert.equal(signed.mock, !rpc);
    if (rpc) {
      assert.equal(ethers.verifyMessage(signed.signature.approvalMessage, signed.signature.signature).toLowerCase(), recorderAddress);
      assert.equal(JSON.parse(signed.signature.approvalMessage).approvedBy, approverId);
      assert.equal(signed.explorer, `${env.BLOCK_EXPLORER}/tx/${signed.document.transactionHash}`);
    } else assert.equal(signed.explorer, null);
    check("single server recording on double click; approver and recorder identities distinct");
    const health = await request("/health");
    assert.equal(JSON.stringify(health.json).includes("PRIVATE_KEY"), false);
    assert.equal(JSON.stringify(health.json).includes(process.env.BLOCKCHAIN_PRIVATE_KEY || "unused-key-marker"), false);
    check("public configuration does not expose server private key");
    const downloaded = await fetch(`${base}/documents/${doc.id}/file`, { headers: { Authorization: `Bearer ${token}` } });
    const finalBytes = Buffer.from(await downloaded.arrayBuffer());
    const verification = new FormData();
    verification.append("file", new Blob([finalBytes], { type: "application/pdf" }), "renamed.pdf");
    const valid = await request("/verify", undefined, verification);
    assert.equal(valid.json.valid, true);
    assert.equal(valid.json.hash, doc.hash);
    assert.equal(valid.json.document.recordingMethod, "server_wallet");
    if (!rpc) assert.equal(valid.json.onChain.explorer, null);
    check("downloaded final PDF verifies; filename changes do not affect hash");
    const modified = new FormData();
    modified.append("file", new Blob([Buffer.concat([finalBytes, Buffer.from("\n% changed")])], { type: "application/pdf" }), "modified.pdf");
    assert.equal((await request("/verify", undefined, modified)).json.valid, false);
    assert.equal((await request(`/documents/${doc.id}/sign/confirm`, token, {})).status, 409);
    assert.equal((await request(`/documents/${doc.id}/apply-signature`, token, { page: 0, x: 1, y: 1, width: 20, height: 10 })).status, 409);
    check("modified bytes fail verification; finalized document cannot be signed again");
    // Complete academic request: student -> TU -> three personal approvers -> result.
    const admin = (await request("/auth/login", undefined, { email: "admin@uad.ac.id", password: "password123" })).json.token;
    const student = (await request("/auth/login", undefined, { email: "mahasiswa@uad.ac.id", password: "password123" })).json;
    const tu = (await request("/auth/login", undefined, { email: "administrasi@uad.ac.id", password: "password123" })).json;
    const created = await request("/users", admin, { nama: "Dekan Uji", email: "dekan@test.invalid", password: "password123", role: "staff_akademik", jabatan: ["Dekan", "Kaprodi"], unit: "FTI" });
    assert.equal(created.status, 201);
    assert.deepEqual(created.json.user.jabatan, ["Dekan", "Kaprodi"]);
    const dean = (await request("/auth/login", undefined, { email: "dekan@test.invalid", password: "password123" })).json;
    const studentB = await request("/users", admin, { nama: "Mahasiswa Kedua", email: "student-b@test.invalid", password: "password123", role: "mahasiswa", nim: "2200TEST", unit: "FTI" });
    assert.equal(studentB.status, 201);
    const studentBToken = (await request("/auth/login", undefined, { email: "student-b@test.invalid", password: "password123" })).json.token;
    assert.equal((await request("/documents/not-an-id", student.token)).status, 400);
    const invalidPdf = new FormData();
    invalidPdf.append("file", new Blob(["invalid PDF"], { type: "application/pdf" }), "fake.pdf");
    assert.equal((await request("/documents", student.token, invalidPdf)).status, 400);
    const invalidImage = new FormData();
    invalidImage.append("image", new Blob(["invalid PNG"], { type: "image/png" }), "fake.png");
    assert.equal((await request("/academic-signatures", token, invalidImage)).status, 400);
    assert.ok((await request("/academic-signatures/my", token)).json.signature);
    const webp = new FormData();
    webp.append("image", new Blob(["webp"], { type: "image/webp" }), "signature.webp");
    assert.equal((await request("/academic-signatures", token, webp)).status, 400);
    check("invalid IDs, unreadable PDF/images and unsupported signature formats fail with 400; active signature retained");
    assert.equal((await request("/users", student.token)).status, 403);
    check("admin creates student/dean accounts; multiple positions belong to one person");
    async function uploadForStudent(label: string) {
      const pdf = await PDFDocument.create(); pdf.addPage().drawText(label);
      const form = new FormData(); form.append("file", new Blob([await pdf.save()], { type: "application/pdf" }), `${label}.pdf`);
      const uploaded = await request("/documents", student.token, form);
      assert.equal(uploaded.status, 201);
      return uploaded.json.document;
    }
    const application = await uploadForStudent("multi-sign approval");
    const originalRequest = await fetch(`${base}/documents/${application._id}/file`, { headers: { Authorization: `Bearer ${student.token}` } });
    const originalRequestBytes = Buffer.from(await originalRequest.arrayBuffer());
    const workflow = { documentType: "Lembar Pengesahan Uji", reviewerId: tu.user._id, steps: [
      { signerId: approverId, capacity: "Dosen Pembimbing" },
      { signerId: other.json.user._id, capacity: "Penguji 1" },
      { signerId: dean.user._id, capacity: "Dekan" },
    ] };
    assert.equal((await request(`/documents/${application._id}/workflow`, student.token, workflow, "PUT")).status, 200);
    assert.equal((await request(`/documents/${application._id}/submit`, student.token, {})).status, 200);
    const listB = await request("/documents", studentBToken);
    assert.equal(listB.json.documents.length, 0);
    for (const route of [`/documents/${application._id}`, `/documents/${application._id}/qrcode`]) assert.equal((await request(route, studentBToken)).status, 403);
    const deniedDownload = await fetch(`${base}/documents/${application._id}/file`, { headers: { Authorization: `Bearer ${studentBToken}` } });
    assert.equal(deniedDownload.status, 403);
    const studentDash = await request("/dashboard/stats", studentBToken);
    assert.equal(studentDash.json.stats.total, 0);
    check("student isolation covers lists, dashboard, detail, QR and direct PDF URL");
    assert.equal((await request(`/documents/${application._id}/review`, student.token, { decision: "approve" })).status, 403);
    const notices = await request("/notifications", tu.token);
    assert.ok(notices.json.notifications.some((n: any) => n.documentId === application._id));
    const tuLetter = new FormData();
    const letterPdf = await PDFDocument.create(); letterPdf.addPage().drawText("TU issued letter");
    tuLetter.append("file", new Blob([await letterPdf.save()], { type: "application/pdf" }), "letter.pdf");
    assert.equal((await request(`/documents/${application._id}/prepare-letter`, tu.token, tuLetter)).status, 200);
    assert.equal((await request(`/documents/${application._id}`, student.token)).json.document.hasRequestFile, true);
    const requestFile = await fetch(`${base}/documents/${application._id}/file?type=request&download=1`, { headers: { Authorization: `Bearer ${student.token}` } });
    assert.equal(requestFile.status, 200);
    assert.match(requestFile.headers.get("content-disposition")!, /attachment/);
    assert.match(requestFile.headers.get("cache-control")!, /no-store/);
    assert.deepEqual(Buffer.from(await requestFile.arrayBuffer()), originalRequestBytes);
    assert.equal((await fetch(`${base}/documents/${application._id}/file?type=request`, { headers: { Authorization: `Bearer ${studentBToken}` } })).status, 403);
    check("original request remains downloadable separately from TU output with owner access and no caching");
    assert.equal((await request(`/documents/${application._id}/review`, tu.token, { decision: "approve" })).status, 200);
    check("TU notified; only named reviewer can prepare and approve output letter");
    const signingAccounts = [login.json, other.json, dean];
    const { AcademicSignature } = await import("../src/models/AcademicSignature");
    for (const person of signingAccounts.slice(1)) await AcademicSignature.create({ academicId: person.user._id, mimeType: "image/png", fileName: "test.png", active: true,
      imageData: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF9sAAAAASUVORK5CYII=", "base64") });
    assert.equal((await request(`/documents/${application._id}/apply-signature`, dean.token, { page: 0, x: 240, y: 60, width: 80, height: 30 })).status, 403);
    let finalWorkflowHash = "";
    for (let i = 0; i < signingAccounts.length; i++) {
      const person = signingAccounts[i];
      if (i > 0) assert.equal((await request(`/documents/${application._id}/apply-signature`, person.token, { page: 0, x: 40, y: 60, width: 80, height: 30 })).status, 400);
      const applied = await request(`/documents/${application._id}/apply-signature`, person.token, { page: 0, x: 40 + i * 120, y: 60, width: 80, height: 30 });
      assert.equal(applied.status, 200);
      finalWorkflowHash = applied.json.hash;
      const approved = await request(`/documents/${application._id}/sign/confirm`, person.token, {});
      assert.equal(approved.status, 200);
      if (i < 2) {
        assert.equal(approved.json.intermediate, true);
        assert.equal(approved.json.document.status, "PARTIALLY_SIGNED");
        assert.equal((await blockchain.getRecord(finalWorkflowHash)).exists, false);
        assert.equal((await request(`/verify/document/${application._id}`)).json.outcome, "PENDING");
      } else assert.equal(approved.json.document.status, "SIGNED");
    }
    const finalRecord = await request(`/documents/${application._id}`, student.token);
    assert.equal(finalRecord.json.signatures.length, 3);
    assert.ok(finalRecord.json.document.signingSteps.every((s: any) => s.status === "APPROVED"));
    const finalFile = await fetch(`${base}/documents/${application._id}/file`, { headers: { Authorization: `Bearer ${student.token}` } });
    const multiBytes = Buffer.from(await finalFile.arrayBuffer());
    const multiPdf = await PDFDocument.load(multiBytes);
    const xobjects = multiPdf.getPage(0).node.Resources()!.lookup(PDFName.of("XObject"), PDFDict);
    assert.equal(xobjects.keys().length, 3);
    assert.equal(multiPdf.getPageCount(), 2);
    assert.ok(multiPdf.getPage(1).node.Resources()!.lookup(PDFName.of("XObject"), PDFDict).keys().length > 0);
    check("three personal signers in order; previous signatures preserved; only final PDF anchored");
    const verifyModified = new FormData(); verifyModified.append("file", new Blob([Buffer.concat([multiBytes, Buffer.from("\n% edit")])], { type: "application/pdf" }), "changed.pdf"); verifyModified.append("documentId", application._id);
    const mismatch = await request("/verify", undefined, verifyModified);
    assert.equal(mismatch.json.outcome, "DIFFERENT"); assert.equal(mismatch.json.referenceHash, finalWorkflowHash);
    assert.notEqual(mismatch.json.hash, mismatch.json.referenceHash);
    const unknown = await request(`/verify/${"f".repeat(64)}`);
    assert.equal(unknown.json.outcome, "NOT_REGISTERED");
    const savedGetRecord = blockchain.getRecord;
    blockchain.getRecord = async () => { throw new Error("isolated network failure"); };
    try { assert.equal((await request(`/verify/document/${application._id}`)).json.outcome, "NETWORK_ERROR"); }
    finally { blockchain.getRecord = savedGetRecord; }
    check("verification distinguishes mismatch, unregistered hash, pending and network error");
    const newVersion = new FormData(); newVersion.append("file", new Blob([multiBytes], { type: "application/pdf" }), "correction.pdf");
    const successor = await request(`/documents/${application._id}/revise`, student.token, newVersion);
    assert.equal(successor.status, 201); assert.equal(successor.json.document.version, 2);
    assert.equal(successor.json.document.previousVersionId, application._id);
    assert.equal((await DocumentModel.findById(application._id))!.hashDokumen, finalWorkflowHash);
    assert.equal((await request(`/verify/document/${application._id}`)).json.valid, true);
    assert.equal((await request(`/documents/${application._id}`, admin, undefined, "DELETE")).status, 409);
    assert.equal((await request(`/documents/${successor.json.document._id}`, student.token, undefined, "DELETE")).status, 409);
    assert.equal((await request(`/documents/${doc.id}`, admin, undefined, "DELETE")).status, 409);
    check("corrected version is a new document; final bytes/hash and history retained");
    const returned = await uploadForStudent("return for correction");
    assert.equal((await request(`/documents/${returned._id}/workflow`, student.token, workflow, "PUT")).status, 200);
    assert.equal((await request(`/documents/${returned._id}/submit`, student.token, {})).status, 200);
    assert.equal((await request(`/documents/${returned._id}/review`, tu.token, { decision: "revise", reason: "" })).status, 400);
    const needsRevision = await request(`/documents/${returned._id}/review`, tu.token, { decision: "revise", reason: "Lampiran belum lengkap" });
    assert.equal(needsRevision.json.document.status, "NEEDS_REVISION");
    assert.equal(needsRevision.json.document.reviewReason, "Lampiran belum lengkap");
    const revisedForm = new FormData(); revisedForm.append("file", new Blob([multiBytes], { type: "application/pdf" }), "complete.pdf");
    const resubmitted = await request(`/documents/${returned._id}/revise`, student.token, revisedForm);
    assert.equal(resubmitted.status, 201);
    assert.equal((await request(`/documents/${resubmitted.json.document._id}/submit`, student.token, {})).status, 200);
    const rejected = await request(`/documents/${resubmitted.json.document._id}/review`, tu.token, { decision: "reject", reason: "Permohonan tidak sesuai" });
    assert.equal(rejected.json.document.status, "REJECTED");
    assert.equal(rejected.json.document.reviewReason, "Permohonan tidak sesuai");
    assert.equal((await request(`/documents/${resubmitted.json.document._id}/apply-signature`, token, { page: 0, x: 30, y: 30, width: 80, height: 30 })).status, 409);
    check("rejection/revision require reason; student can upload successor and re-submit");
    const multipleCapacities = await uploadForStudent("same person distinct capacities");
    const capacityWorkflow = { ...workflow, steps: [{ signerId: dean.user._id, capacity: "Kaprodi" }, { signerId: dean.user._id, capacity: "Dekan" }] };
    assert.equal((await request(`/documents/${multipleCapacities._id}/workflow`, student.token, capacityWorkflow, "PUT")).status, 200);
    assert.equal((await request(`/documents/${multipleCapacities._id}/workflow`, student.token, { ...capacityWorkflow, steps: [capacityWorkflow.steps[0], capacityWorkflow.steps[0]] }, "PUT")).status, 400);
    check("one personal account can hold distinct capacities; duplicate person/capacity is rejected");
    const notified = await request("/notifications", student.token);
    assert.ok(notified.json.notifications.some((n: any) => n.message.includes("selesai disahkan")));
    if (notified.json.notifications.length) assert.equal((await request(`/notifications/${notified.json.notifications[0]._id}/read`, studentBToken, {}, "PUT")).status, 404);
    check("completion notification delivered to owner; other students cannot mark it read");
    const { sendNotificationEmail } = await import("../src/services/notificationEmail");
    assert.equal(await sendNotificationEmail("test@example.invalid", "Isolated notification", application._id), false);
    assert.equal(await sendNotificationEmail("test@example.invalid", "Isolated notification", application._id, nodemailer.createTransport({ jsonTransport: true })), true);
    check("email is optional; message renders with local JSON transport and no external delivery");
    if (rpc) {
      await assert.rejects(() => blockchain.confirmTransaction(signed.document.transactionHash, "f".repeat(64), recorderAddress));
      check("receipt with wrong document hash rejected");
      const retry = await preparedDocument("retry after timeout");
      const savedKey = env.BLOCKCHAIN_PRIVATE_KEY;
      env.BLOCKCHAIN_PRIVATE_KEY = "";
      const missing = await request(`/documents/${retry.id}/sign/confirm`, token, {});
      assert.equal(missing.status, 503);
      assert.equal((await DocumentModel.findById(retry.id))!.status, "PENDING_BLOCKCHAIN");
      env.BLOCKCHAIN_PRIVATE_KEY = savedKey;
      check("missing server key fails explicitly; never substitutes fake chain proof");
      const originalConfirm = blockchain.confirmTransaction;
      blockchain.confirmTransaction = async () => { throw new Error("test timeout after submission"); };
      try { assert.equal((await request(`/documents/${retry.id}/sign/confirm`, token, {})).status, 503); }
      finally { blockchain.confirmTransaction = originalConfirm; }
      const pending = await DocumentModel.findById(retry.id);
      const pendingHash = pending!.transactionHash;
      assert.ok(pendingHash);
      const resumed = await request(`/documents/${retry.id}/sign/confirm`, token, {});
      assert.equal(resumed.status, 200);
      assert.equal(resumed.json.document.transactionHash, pendingHash);
      assert.equal(await Signature.countDocuments({ documentId: retry.id }), 1);
      check("timeout keeps pending tx and retry confirms same transaction");
      const first = await preparedDocument("parallel first");
      const second = await preparedDocument("parallel second");
      const parallel = await Promise.all([
        request(`/documents/${first.id}/sign/confirm`, token, {}),
        request(`/documents/${second.id}/sign/confirm`, token, {}),
      ]);
      assert.deepEqual(parallel.map(r => r.status), [200, 200]);
      assert.notEqual(parallel[0].json.document.transactionHash, parallel[1].json.document.transactionHash);
      check("concurrent documents share server wallet without nonce collision");
    }
    console.log(`${checks} checks passed (${rpc ? "real local RPC; no public transaction" : "explicit mock"}).`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await mongoose.disconnect();
    await mongod.stop();
    provider?.destroy();
  }
});
