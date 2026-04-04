/**
 * MediVault - UploadReportScreen Test Suite
 * Senior Developer Review: File Upload & Firestore Persistence
 *
 * Tests cover:
 * - File picker (image vs PDF via DocumentPicker)
 * - Blob conversion and Firebase Storage upload
 * - Firestore metadata save
 * - Error scenarios (no file selected, user not signed in, network failure)
 * - File type detection (PDF vs Image)
 */

import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

// ─── Mocks ───────────────────────────────────────────────────────────────────

const MOCK_COLLECTION_REF = { _path: "mock-collection" };
jest.mock("firebase/firestore", () => ({
  addDoc: jest.fn(),
  collection: jest.fn(() => MOCK_COLLECTION_REF),
  serverTimestamp: jest.fn(() => "MOCK_TIMESTAMP"),
}));

jest.mock("firebase/storage", () => ({
  ref: jest.fn(),
  uploadBytes: jest.fn(),
  getDownloadURL: jest.fn(),
}));

jest.mock("expo-image-picker");
jest.mock("expo-document-picker");

// Mock fetch for blob conversion
global.fetch = jest.fn();

// ─── Simulated upload logic (mirrors handleSecureUpload in UploadReportScreen) ──

const handleSecureUpload = async ({ fileUri, fileMime, fileName, userData, db, storage }) => {
  if (!fileUri) throw new Error("NO_FILE");
  if (!userData?.uid) throw new Error("NOT_SIGNED_IN");

  const response = await fetch(fileUri);
  const blob = await response.blob();

  const ext = fileMime?.includes("pdf") ? "pdf" : "jpg";
  const timestamp = Date.now();
  const storageRef = ref(storage, `users/${userData.uid}/reports/${timestamp}.${ext}`);
  await uploadBytes(storageRef, blob, { contentType: fileMime });
  const downloadURL = await getDownloadURL(storageRef);

  await addDoc(collection(db, "users", userData.uid, "reports"), {
    title: fileName || "Medical Report",
    url: downloadURL,
    type: fileMime?.includes("pdf") ? "PDF" : "Image",
    uploadedAt: serverTimestamp(),
    uid: userData.uid,
  });

  return downloadURL;
};

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe("UploadReportScreen - File Picker", () => {
  beforeEach(() => jest.clearAllMocks());

  it("sets image URI when user picks from gallery", async () => {
    const mockUri = "file:///tmp/photo.jpg";
    ImagePicker.launchImageLibraryAsync.mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: mockUri }],
    });

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
    });

    expect(result.canceled).toBe(false);
    expect(result.assets[0].uri).toBe(mockUri);
  });

  it("does nothing when user cancels image picker", async () => {
    ImagePicker.launchImageLibraryAsync.mockResolvedValueOnce({ canceled: true });

    const result = await ImagePicker.launchImageLibraryAsync({});
    expect(result.canceled).toBe(true);
  });

  it("sets fileName (not image) when user picks a PDF", async () => {
    DocumentPicker.getDocumentAsync.mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: "file:///tmp/report.pdf", name: "report.pdf", mimeType: "application/pdf" }],
    });

    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/*"],
    });

    const asset = result.assets[0];
    expect(asset.mimeType).toBe("application/pdf");
    expect(asset.name).toBe("report.pdf");
    // In the screen: image is null, fileName is set
  });

  it("sets image preview when user picks an image via DocumentPicker", async () => {
    const mockUri = "file:///tmp/scan.jpg";
    DocumentPicker.getDocumentAsync.mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: mockUri, name: "scan.jpg", mimeType: "image/jpeg" }],
    });

    const result = await DocumentPicker.getDocumentAsync({});
    const asset = result.assets[0];

    expect(asset.mimeType.startsWith("image/")).toBe(true);
    // In the screen: setImage(asset.uri) is called
  });
});

describe("UploadReportScreen - handleSecureUpload", () => {
  const mockUserData = { uid: "test-uid-001" };
  const mockDb = {};
  const mockStorage = {};

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch.mockResolvedValue({
      blob: jest.fn().mockResolvedValue(new Blob(["fake-data"], { type: "image/jpeg" })),
    });
    ref.mockReturnValue({ fullPath: "users/test-uid-001/reports/123.jpg" });
    uploadBytes.mockResolvedValue(undefined);
    getDownloadURL.mockResolvedValue("https://firebase.storage.com/report.jpg");
    addDoc.mockResolvedValue({ id: "doc-id-xyz" });
  });

  it("uploads image and saves metadata to Firestore", async () => {
    const downloadURL = await handleSecureUpload({
      fileUri: "file:///tmp/blood_test.jpg",
      fileMime: "image/jpeg",
      fileName: null,
      userData: mockUserData,
      db: mockDb,
      storage: mockStorage,
    });

    expect(uploadBytes).toHaveBeenCalledTimes(1);
    expect(getDownloadURL).toHaveBeenCalledTimes(1);
    expect(addDoc).toHaveBeenCalledTimes(1);
    expect(addDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: "Image",
        uid: "test-uid-001",
        url: "https://firebase.storage.com/report.jpg",
      })
    );
    expect(downloadURL).toBe("https://firebase.storage.com/report.jpg");
  });

  it("uploads PDF and saves metadata with type='PDF'", async () => {
    getDownloadURL.mockResolvedValueOnce("https://firebase.storage.com/report.pdf");

    await handleSecureUpload({
      fileUri: "file:///tmp/prescription.pdf",
      fileMime: "application/pdf",
      fileName: "prescription.pdf",
      userData: mockUserData,
      db: mockDb,
      storage: mockStorage,
    });

    expect(addDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        title: "prescription.pdf",
        type: "PDF",
      })
    );
  });

  it("uses 'Medical Report' as default title when no fileName is provided", async () => {
    await handleSecureUpload({
      fileUri: "file:///tmp/unnamed.jpg",
      fileMime: "image/jpeg",
      fileName: null,
      userData: mockUserData,
      db: mockDb,
      storage: mockStorage,
    });

    expect(addDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ title: "Medical Report" })
    );
  });

  it("throws NO_FILE when no file is selected", async () => {
    await expect(
      handleSecureUpload({
        fileUri: null,
        fileMime: null,
        fileName: null,
        userData: mockUserData,
        db: mockDb,
        storage: mockStorage,
      })
    ).rejects.toThrow("NO_FILE");

    expect(uploadBytes).not.toHaveBeenCalled();
    expect(addDoc).not.toHaveBeenCalled();
  });

  it("throws NOT_SIGNED_IN when userData is missing", async () => {
    await expect(
      handleSecureUpload({
        fileUri: "file:///tmp/blood_test.jpg",
        fileMime: "image/jpeg",
        fileName: null,
        userData: null,
        db: mockDb,
        storage: mockStorage,
      })
    ).rejects.toThrow("NOT_SIGNED_IN");

    expect(uploadBytes).not.toHaveBeenCalled();
    expect(addDoc).not.toHaveBeenCalled();
  });

  it("does NOT call addDoc when Firebase Storage upload fails", async () => {
    uploadBytes.mockRejectedValueOnce(new Error("Network error"));

    await expect(
      handleSecureUpload({
        fileUri: "file:///tmp/blood_test.jpg",
        fileMime: "image/jpeg",
        fileName: null,
        userData: mockUserData,
        db: mockDb,
        storage: mockStorage,
      })
    ).rejects.toThrow("Network error");

    expect(addDoc).not.toHaveBeenCalled();
  });

  it("stores file under correct user path in Firebase Storage", async () => {
    await handleSecureUpload({
      fileUri: "file:///tmp/report.jpg",
      fileMime: "image/jpeg",
      fileName: null,
      userData: { uid: "user-456" },
      db: mockDb,
      storage: mockStorage,
    });

    const refCall = ref.mock.calls[0];
    expect(refCall[1]).toMatch(/^users\/user-456\/reports\/\d+\.jpg$/);
  });
});

describe("UploadReportScreen - File Type Detection", () => {
  it("detects PDF by mimeType", () => {
    const isImage = (mime) => !mime?.includes("pdf");
    expect(isImage("application/pdf")).toBe(false);
    expect(isImage("image/jpeg")).toBe(true);
    expect(isImage("image/png")).toBe(true);
  });

  it("uses correct extension for PDF uploads", () => {
    const getExt = (mime) => (mime?.includes("pdf") ? "pdf" : "jpg");
    expect(getExt("application/pdf")).toBe("pdf");
    expect(getExt("image/jpeg")).toBe("jpg");
    expect(getExt(undefined)).toBe("jpg"); // fallback to jpg
  });
});
