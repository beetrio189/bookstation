import { v2 as cloudinary } from 'cloudinary';
import { env } from '../../config';

cloudinary.config({
  cloud_name: env.cloudinaryCloudName,
  api_key: env.cloudinaryApiKey,
  api_secret: env.cloudinaryApiSecret,
  secure: true,
});

const ALLOWED_FORMATS = 'jpg,png,webp';
const INCOMING_TRANSFORMATION = 'c_limit,w_1200,h_1800';

export interface CoverUploadSignature {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  publicId: string;
  allowedFormats: string;
  transformation: string;
}

/** FE gửi đúng y các tham số này cùng file lên Cloudinary; đổi một tham số là sai chữ ký */
export const signCoverUpload = (publicId: string): CoverUploadSignature => {
  const timestamp = Math.round(Date.now() / 1000);
  const signature = cloudinary.utils.api_sign_request(
    {
      public_id: publicId,
      timestamp,
      allowed_formats: ALLOWED_FORMATS,
      transformation: INCOMING_TRANSFORMATION,
    },
    env.cloudinaryApiSecret,
  );

  return {
    cloudName: env.cloudinaryCloudName,
    apiKey: env.cloudinaryApiKey,
    timestamp,
    signature,
    publicId,
    allowedFormats: ALLOWED_FORMATS,
    transformation: INCOMING_TRANSFORMATION,
  };
};

/** Ảnh không còn (đã xóa, chưa từng upload) Cloudinary trả "not found": coi như xong */
export const destroyCover = async (publicId: string): Promise<void> => {
  const result = (await cloudinary.uploader.destroy(publicId, {
    invalidate: true,
  })) as { result?: string };

  if (result.result !== 'ok' && result.result !== 'not found') {
    throw new Error(`Cloudinary destroy ${publicId}: ${result.result}`);
  }
};
