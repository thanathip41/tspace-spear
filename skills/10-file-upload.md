# File Upload - tspace-spear

## Basic File Upload

```typescript
import Spear, { type T } from "tspace-spear";
import path from "path";

const app = new Spear()
  .useFileUpload()  // Enable file upload
  .post('/upload', async ({ files, res }: T.Context) => {
    const file = files.file?.[0];  // Get first file from 'file' field
    
    if (!file) {
      return res.badRequest('No file uploaded');
    }

    return res.json({
      name: file.name,
      size: file.size,
      mimetype: file.mimetype,
      extension: file.extension
    });
  });

app.listen(8000);
```

## File Upload with Options

```typescript
const app = new Spear()
  .useFileUpload({
    limit: 10_000_000,        // 10MB max file size
    tempFileDir: 'tmp',       // Temporary folder
    removeTempFile: {
      remove: true,           // Auto-remove temp files
      ms: 60000               // Remove after 60 seconds
    }
  })
  .post('/upload', async ({ files, res }: T.Context) => {
    const file = files.avatar?.[0];
    
    if (!file) {
      return res.badRequest('No avatar uploaded');
    }

    // Save to permanent location
    const destPath = path.join(process.cwd(), 'uploads', file.name);
    await file.write(destPath);

    // Temp file is auto-removed based on options
    
    return res.json({
      saved: destPath,
      size: file.sizes
    });
  });
```

## File Object Properties

```typescript
.post('/info', ({ files }: T.Context) => {
  const file = files.file?.[0];
  
  if (!file) return { error: 'No file' };

  return {
    name: file.name,           // Original filename
    size: file.size,           // Size in bytes
    mimetype: file.mimetype,   // MIME type
    extension: file.extension, // File extension
    
    // Size conversions
    sizes: {
      bytes: file.sizes.bytes,
      kb: file.sizes.kb,
      mb: file.sizes.mb,
      gb: file.sizes.gb
    },
    
    // Temp file info
    tempFilePath: file.tempFilePath,
    tempFileName: file.tempFileName
  };
})
```

## Multiple File Upload

```typescript
.post('/upload-multiple', ({ files, res }: T.Context) => {
  const images = files.images;  // Array of files
  
  if (!images || images.length === 0) {
    return res.badRequest('No images uploaded');
  }

  const results = images.map(file => ({
    name: file.name,
    size: file.size,
    mimetype: file.mimetype
  }));

  return res.json({ uploaded: results });
});

// HTML: <input type="file" name="images" multiple />
```

## Multiple File Fields

```typescript
.post('/profile', ({ files, res }: T.Context) => {
  const avatar = files.avatar?.[0];    // Single file
  const resume = files.resume?.[0];    // Single file
  const photos = files.photos || [];   // Multiple files

  return res.json({
    avatar: avatar?.name,
    resume: resume?.name,
    photos: photos.map(p => p.name)
  });
});

// HTML:
// <input type="file" name="avatar" />
// <input type="file" name="resume" />
// <input type="file" name="photos" multiple />
```

## File Upload with Controller

```typescript
import { Controller, Post, Files, type T } from "tspace-spear";

@Controller('/upload')
class UploadController {
  
  @Post('/avatar')
  @Files('avatar')  // Only keep 'avatar' field
  uploadAvatar({ files }: T.Context) {
    return { file: files.avatar[0] };
  }

  @Post('/documents')
  @Files('resume', 'cover_letter')
  uploadDocuments({ files }: T.Context) {
    return {
      resume: files.resume?.[0],
      coverLetter: files.cover_letter?.[0]
    };
  }
}
```

## Save File to Disk

```typescript
import path from "path";
import fs from "fs";

.post('/save', async ({ files, res }: T.Context) => {
  const file = files.file?.[0];
  
  if (!file) {
    return res.badRequest('No file');
  }

  // Create uploads directory if not exists
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Generate unique filename
  const timestamp = Date.now();
  const ext = file.extension;
  const filename = `${timestamp}.${ext}`;
  const destPath = path.join(uploadsDir, filename);

  // Save file
  await file.write(destPath);

  return res.json({
    saved: true,
    path: destPath,
    filename: filename
  });
});
```

## Remove Temporary File

```typescript
.post('/upload-and-remove', async ({ files, res }: T.Context) => {
  const file = files.file?.[0];
  
  if (!file) {
    return res.badRequest('No file');
  }

  // Process file (e.g., read content)
  const content = await fs.promises.readFile(file.tempFilePath, 'utf-8');

  // Remove temp file manually
  await file.remove();

  return res.json({
    content: content.substring(0, 100) + '...',
    removed: true
  });
});
```

## File Upload Validation

```typescript
const ALLOWED_MIMETYPES = ['image/jpeg', 'image/png', 'image/gif'];
const MAX_SIZE = 5_000_000; // 5MB

.post('/validated', async ({ files, res }: T.Context) => {
  const file = files.file?.[0];
  
  if (!file) {
    return res.badRequest('No file uploaded');
  }

  // Validate MIME type
  if (!ALLOWED_MIMETYPES.includes(file.mimetype)) {
    await file.remove();
    return res.badRequest('Invalid file type. Only JPEG, PNG, GIF allowed');
  }

  // Validate size
  if (file.size > MAX_SIZE) {
    await file.remove();
    return res.badRequest('File too large. Max 5MB');
  }

  // Save file
  const destPath = path.join(process.cwd(), 'uploads', file.name);
  await file.write(destPath);

  return res.json({
    saved: destPath,
    mimetype: file.mimetype,
    size: file.sizes.mb.toFixed(2) + ' MB'
  });
});
```

## Image Upload with Resize

```typescript
import sharp from "sharp";  // npm install sharp

.post('/upload-image', async ({ files, res }: T.Context) => {
  const file = files.image?.[0];
  
  if (!file) {
    return res.badRequest('No image uploaded');
  }

  // Resize image
  const resizedPath = path.join(process.cwd(), 'uploads', `resized_${file.name}`);
  
  await sharp(file.tempFilePath)
    .resize(800, 600, { fit: 'inside' })
    .toFile(resizedPath);

  // Remove original temp file
  await file.remove();

  return res.json({
    resized: resizedPath,
    original: file.name
  });
});
```

## File Upload with Progress (Client-side)

```html
<!-- HTML Upload Form with Progress -->
<form id="uploadForm">
  <input type="file" name="file" id="fileInput" />
  <progress id="progress" value="0" max="100"></progress>
  <button type="submit">Upload</button>
</form>

<script>
  const form = document.getElementById('uploadForm');
  const progress = document.getElementById('progress');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const fileInput = document.getElementById('fileInput');
    const formData = new FormData();
    formData.append('file', fileInput.files[0]);

    const xhr = new XMLHttpRequest();
    
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        progress.value = (e.loaded / e.total) * 100;
      }
    });

    xhr.addEventListener('load', () => {
      console.log('Upload complete:', xhr.responseText);
    });

    xhr.open('POST', '/upload');
    xhr.send(formData);
  });
</script>
```

## Upload with ApiClient

```typescript
import { ApiClient } from "tspace-spear/client";

const client = new ApiClient('http://localhost:8000');

// Using FormData
const fileInput = document.getElementById('file') as HTMLInputElement;
const formData = new FormData();
formData.append('file', fileInput.files[0]);

const res = await client.upload('/upload', {
  method: 'POST',
  formdata: formData
});

if (res.ok) {
  console.log('Uploaded:', res.data);
}
```

## Complete File Upload Example

```typescript
import Spear, { Controller, Post, Files, Middleware, type T } from "tspace-spear";
import path from "path";
import fs from "fs";

// Auth middleware
const authMiddleware: T.ContextHandler = (ctx, next) => {
  if (!ctx.headers.authorization) {
    return ctx.res.unauthorized();
  }
  return next();
};

// File upload controller
@Files('file')
@Controller('/files')
class FileController {
  
  @Post('/upload')
  @Middleware(authMiddleware)
  async upload({ files, res }: T.Context) {
    const file = files.file?.[0];
    
    if (!file) {
      return res.badRequest('No file uploaded');
    }

    // Validate
    if (file.size > 10_000_000) {
      await file.remove();
      return res.badRequest('File too large (max 10MB)');
    }

    // Save with unique name
    const ext = file.extension;
    const filename = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
    const uploadsDir = path.join(process.cwd(), 'uploads');
    
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const destPath = path.join(uploadsDir, filename);
    await file.write(destPath);

    return res.json({
      id: filename,
      name: file.name,
      path: `/uploads/${filename}`,
      size: file.sizes.mb.toFixed(2) + ' MB'
    });
  }
}

const app = new Spear({
  controllers: [FileController],
  logger: true
})
.useFileUpload({
  limit: 10_000_000,
  tempFileDir: 'tmp',
  removeTempFile: { remove: true, ms: 60000 }
});

app.listen(8000);
```

## Download Uploaded File

```typescript
import Spear, { type T } from "tspace-spear";
import path from "path";

const app = new Spear()
  // Upload
  .post('/upload', async ({ files, res }: T.Context) => {
    const file = files.file?.[0];
    if (!file) return res.badRequest('No file');
    
    const destPath = path.join(process.cwd(), 'uploads', file.name);
    await file.write(destPath);
    
    return res.json({ saved: file.name });
  })
  
  // Download
  .get('/download/:filename', (ctx) => {
    const filename = ctx.params.filename;
    const filePath = path.join(process.cwd(), 'uploads', filename);
    
    return ctx.res.serveMedia(filePath);
  });

app.listen(8000);