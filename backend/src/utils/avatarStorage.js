const fs = require('fs/promises');
const path = require('path');
const sharp = require('sharp');

const AVATAR_UPLOAD_DIR = path.join(__dirname, '../../uploads/avatars');
const AVATAR_PUBLIC_PREFIX = '/uploads/avatars';

const ensureAvatarUploadDir = async () => {
  await fs.mkdir(AVATAR_UPLOAD_DIR, { recursive: true });
};

const sanitizeFileSegment = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'user';

const buildAvatarFilename = (user) => {
  const userId = String(user?._id || user?.id || 'user').trim();
  const nameToken = sanitizeFileSegment(`${user?.firstName || ''}-${user?.lastName || ''}`);
  return `${nameToken}-${userId}-${Date.now()}.webp`;
};

const saveCompressedAvatar = async ({ inputPath, user }) => {
  await ensureAvatarUploadDir();
  const filename = buildAvatarFilename(user);
  const outputPath = path.join(AVATAR_UPLOAD_DIR, filename);

  await sharp(inputPath)
    .rotate()
    .resize(512, 512, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({
      quality: 82,
      effort: 4,
    })
    .toFile(outputPath);

  return {
    url: `${AVATAR_PUBLIC_PREFIX}/${filename}`,
    publicId: filename,
    absolutePath: outputPath,
  };
};

const toAvatarAbsolutePath = (avatarUrl) => {
  const normalized = String(avatarUrl || '').trim();
  if (!normalized.startsWith(`${AVATAR_PUBLIC_PREFIX}/`)) return null;
  const filename = path.basename(normalized);
  return path.join(AVATAR_UPLOAD_DIR, filename);
};

const removeLocalAvatar = async (avatarUrl) => {
  const absolutePath = toAvatarAbsolutePath(avatarUrl);
  if (!absolutePath) return;

  try {
    await fs.unlink(absolutePath);
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw error;
    }
  }
};

module.exports = {
  AVATAR_UPLOAD_DIR,
  ensureAvatarUploadDir,
  saveCompressedAvatar,
  removeLocalAvatar,
};
