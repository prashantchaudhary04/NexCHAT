/**
 * Utility to process, scale, and compress profile pictures uploaded from a device.
 * Scales down large camera photos (e.g. 5-15MB) into a crisp, lightweight square/aspect-ratio
 * avatar (under 50KB) suitable for real-time web, mobile, and persistent storage.
 */
export async function processDeviceProfileImage(
  file: File,
  maxDimension = 400,
  quality = 0.85
): Promise<string> {
  if (!file) {
    throw new Error('No file selected');
  }

  if (!file.type.startsWith('image/')) {
    throw new Error('Please select an image file (JPEG, PNG, WEBP, etc.)');
  }

  // Enforce reasonable raw file size cap before processing (e.g. 25MB)
  if (file.size > 25 * 1024 * 1024) {
    throw new Error('Image file is too large. Please select a photo under 25MB.');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Square center crop for pristine profile avatars
          const minDim = Math.min(width, height);
          const startX = (width - minDim) / 2;
          const startY = (height - minDim) / 2;

          const targetDim = Math.min(minDim, maxDimension);
          canvas.width = targetDim;
          canvas.height = targetDim;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(event.target?.result as string);
            return;
          }

          // Draw center square crop with high quality smoothing
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(
            img,
            startX,
            startY,
            minDim,
            minDim,
            0,
            0,
            targetDim,
            targetDim
          );

          // Export as JPEG with optimal compression
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
        } catch (err) {
          // Fallback to raw data URL
          resolve(event.target?.result as string);
        }
      };

      img.onerror = () => {
        reject(new Error('Failed to decode image file. Please try another image.'));
      };

      img.src = event.target?.result as string;
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file from your device.'));
    };

    reader.readAsDataURL(file);
  });
}
