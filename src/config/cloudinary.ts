import { v2 as cloudinary } from 'cloudinary';

cloudinary.config(true); // reads CLOUDINARY_URL from env automatically

export default cloudinary;
