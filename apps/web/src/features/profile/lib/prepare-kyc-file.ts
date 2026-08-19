const MAX_IMAGE_BYTES = 3.5 * 1024 * 1024;
const MAX_PDF_BYTES = 10 * 1024 * 1024;
const MAX_EDGE = 1600;

function isPdf(file: File) {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

function isLikelyImage(file: File) {
  const type = file.type.toLowerCase();
  if (type.startsWith('image/')) return true;
  return /\.(jpe?g|png|webp|heic|heif|gif)$/i.test(file.name);
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read that photo. Save the ID as JPEG or PNG and try again.'));
    };
    img.src = url;
  });
}

function canvasToJpeg(img: HTMLImageElement, quality: number): Promise<Blob> {
  const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not process that photo on this device.');
  }
  ctx.drawImage(img, 0, 0, width, height);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Could not compress that photo. Try a smaller JPEG.'));
          return;
        }
        resolve(blob);
      },
      'image/jpeg',
      quality,
    );
  });
}

async function compressImageToJpeg(file: File): Promise<File> {
  const img = await loadImage(file);
  let quality = 0.82;
  let blob = await canvasToJpeg(img, quality);
  while (blob.size > MAX_IMAGE_BYTES && quality > 0.45) {
    quality -= 0.12;
    blob = await canvasToJpeg(img, quality);
  }
  if (blob.size > MAX_IMAGE_BYTES) {
    throw new Error('That ID photo is still too large. Try a closer, clearer JPEG under 4MB.');
  }
  const base = file.name.replace(/\.[^.]+$/, '') || 'national-id';
  return new File([blob], `${base}.jpg`, { type: 'image/jpeg' });
}

/** Resize/convert phone photos so KYC upload does not crash the page. */
export async function prepareKycUploadFile(file: File): Promise<File> {
  if (file.size === 0) {
    throw new Error('Choose a file to upload.');
  }
  if (isPdf(file)) {
    if (file.size > MAX_PDF_BYTES) {
      throw new Error('PDF must be 10MB or smaller.');
    }
    return file;
  }
  if (!isLikelyImage(file)) {
    throw new Error('Upload a photo of your ID (JPEG, PNG, WebP) or a PDF.');
  }
  return compressImageToJpeg(file);
}
