import { dialog } from 'electron';
import fs from 'fs/promises';
import path from 'path';

export class FileService {
  async selectFolder(): Promise<string | null> {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select Vault Location',
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  }

  async createDirectory(dirPath: string): Promise<void> {
    await fs.mkdir(dirPath, { recursive: true });
  }

  async directoryExists(dirPath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(dirPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  async fileExists(filePath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(filePath);
      return stats.isFile();
    } catch {
      return false;
    }
  }

  async readFile(filePath: string, encoding: BufferEncoding = 'utf-8'): Promise<string> {
    return fs.readFile(filePath, encoding);
  }

  async writeFile(filePath: string, content: string, encoding: BufferEncoding = 'utf-8'): Promise<void> {
    const dir = path.dirname(filePath);
    await this.createDirectory(dir);
    await fs.writeFile(filePath, content, encoding);
  }

  async readDir(dirPath: string): Promise<string[]> {
    return fs.readdir(dirPath);
  }

  async deleteFile(filePath: string): Promise<void> {
    await fs.unlink(filePath);
  }

  async deleteDirectory(dirPath: string): Promise<void> {
    await fs.rm(dirPath, { recursive: true, force: true });
  }

  async copyFile(src: string, dest: string): Promise<void> {
    const destDir = path.dirname(dest);
    await this.createDirectory(destDir);
    await fs.copyFile(src, dest);
  }

  async moveFile(src: string, dest: string): Promise<void> {
    const destDir = path.dirname(dest);
    await this.createDirectory(destDir);
    await fs.rename(src, dest);
  }

  getFileName(filePath: string): string {
    return path.basename(filePath);
  }

  getFileNameWithoutExt(filePath: string): string {
    return path.basename(filePath, path.extname(filePath));
  }

  getFileExtension(filePath: string): string {
    return path.extname(filePath);
  }

  joinPath(...paths: string[]): string {
    return path.join(...paths);
  }

  resolvePath(...paths: string[]): string {
    return path.resolve(...paths);
  }

  getDirName(filePath: string): string {
    return path.dirname(filePath);
  }

  normalizePath(filePath: string): string {
    return path.normalize(filePath);
  }
}

export const fileService = new FileService();
