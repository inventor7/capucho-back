import fs from "fs";
import path from "path";
import multer from "multer";
import { IFileService } from "@/types";
import { calculateSHA256, generateBundleId } from "@/utils/crypto";
import supabaseService from "./supabaseService";
import config from "@/config";
import logger from "@/utils/logger";

class FileService implements IFileService {
  private uploadDir: string;

  constructor() {
    this.uploadDir = path.join(process.cwd(), "uploads");
    this.ensureUploadDirExists();
  }

  private ensureUploadDirExists(): void {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
      logger.info("Upload directory created", { path: this.uploadDir });
    }
  }

  calculateChecksum(buffer: Buffer): string {
    return calculateSHA256(buffer);
  }

  async uploadFile(fileName: string, buffer: Buffer): Promise<string> {
    try {
      const downloadUrl = await supabaseService.uploadFile(fileName, buffer);
      logger.info("File uploaded successfully", { fileName, downloadUrl });
      return downloadUrl;
    } catch (error) {
      logger.error("File upload failed", { fileName, error });
      throw error;
    }
  }

  async validateFile(file: any): Promise<void> {
    if (!file) {
      throw new Error("No file uploaded");
    }

    if (file.size > config.upload.maxFileSize) {
      throw new Error(
        `File size exceeds limit of ${config.upload.maxFileSize} bytes`
      );
    }

    const allowedTypes = config.upload.allowedMimeTypes;
    if (!allowedTypes.includes(file.mimetype)) {
      throw new Error(
        `File type ${
          file.mimetype
        } not allowed. Allowed types: ${allowedTypes.join(", ")}`
      );
    }

    logger.info("File validation passed", {
      fileName: file.originalname,
      size: file.size,
    });
  }

  createMulterUpload() {
    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, this.uploadDir);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = generateBundleId();
        cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
      },
    });

    return multer({
      storage,
      limits: {
        fileSize: config.upload.maxFileSize,
      },
    });
  }

  cleanupLocalFile(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        logger.info("Local file cleaned up", { filePath });
      }
    } catch (error) {
      logger.warn("Failed to cleanup local file", { filePath, error });
    }
  }
}

export default new FileService();
