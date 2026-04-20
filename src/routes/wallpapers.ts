import { Router, Request, Response } from 'express';
import multer from 'multer';
import { Readable } from 'stream';
import cloudinary from '../config/cloudinary.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

const FOLDER = 'partizan/wallpapers';

router.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await cloudinary.search
      .expression(`folder:${FOLDER}`)
      .with_field('context')
      .max_results(50)
      .execute();

    const wallpapers = result.resources.map((r: { public_id: string; secure_url: string }) => ({
      publicId: r.public_id,
      url: r.secure_url,
    }));

    res.json(wallpapers);
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: 'Failed to fetch wallpapers from Cloudinary' });
  }
});

router.post('/upload', upload.single('image'), async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'No image file provided' });
    return;
  }

  try {
    const result = await new Promise<{ public_id: string; secure_url: string }>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: FOLDER, resource_type: 'image' },
        (err, result) => {
          if (err || !result) return reject(err);
          resolve(result);
        }
      );
      Readable.from(req.file!.buffer).pipe(uploadStream);
    });

    res.json({ publicId: result.public_id, url: result.secure_url });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: 'Failed to upload image to Cloudinary' });
  }
});

router.delete('/:publicId', async (req: Request, res: Response) => {
  const publicId = decodeURIComponent(req.params.publicId);

  try {
    await cloudinary.uploader.destroy(publicId);
    res.json({ deleted: publicId });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: 'Failed to delete image from Cloudinary' });
  }
});

export default router;
