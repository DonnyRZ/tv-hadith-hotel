export interface MediaObjectRecord {
  id: string;
  objectKey: string;
  contentType: string;
  fileName: string;
  byteSize: number;
  createdAt: string;
}

export interface UploadedMediaFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}
