import { describe, it, before, after } from "mocha";
import { expect } from "chai";
import { Server } from "http";
import * as fs from "fs";
import * as path from "path";
import { Spear } from "../src/lib";
import { ApiClient } from "../src/lib/core/client";

describe("File Upload Edge Cases Tests", () => {
  let server: Server;
  let client: ApiClient<any>;
  let testImagePath: string;
  let testTextPath: string;

  const app = new Spear({ logger: true })
    .useBodyParser()
    .useFileUpload({
      limit: 5 * 1024 * 1024, // 5MB limit
      tempFileDir: "tmp",
      removeTempFile: {
        remove: true,
        ms: 1000,
      },
    })
    .post("/upload/single", (ctx) => {
      const file = ctx.files?.file?.[0];
      if (!file) {
        return ctx.res.status(400).json({ error: "No file uploaded" });
      }
      return {
        file: {
          name: file.name,
          mimetype: file.mimetype,
          size: file.size,
          extension: file.extension,
        },
      };
    })
    .post("/upload/multiple", (ctx) => {
      const files = ctx.files?.files ?? [];
      return {
        count: files.length,
        files: files.map((f: any) => ({
          name: f.name,
          mimetype: f.mimetype,
          size: f.size,
        })),
      };
    })
    .post("/upload/with-body", (ctx) => {
      const file = ctx.files?.file?.[0];
      const body = ctx.body;
      return {
        file: file
          ? {
              name: file.name,
              size: file.size,
            }
          : null,
        body,
      };
    })
    .post("/upload/empty", (ctx) => {
      const files = ctx.files;
      return {
        hasFiles: !!files && Object.keys(files).length > 0,
        files: files || {},
      };
    });

  before(async () => {
    // Create test files
    testImagePath = path.join(__dirname, "test-image.png");
    testTextPath = path.join(__dirname, "test-file.txt");

    // Create a small test image (1x1 PNG)
    const pngData = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64"
    );
    await fs.promises.writeFile(testImagePath, pngData);

    // Create a test text file
    await fs.promises.writeFile(testTextPath, "Hello, World!");

    await new Promise<void>((resolve) => {
      app.listen(5021, ({ port, server: sCallback }) => {
        server = sCallback;
        client = new ApiClient(`http://localhost:${port}`);
        resolve();
      });
    });
  });

  after(async () => {
    // Cleanup test files
    try {
      await fs.promises.unlink(testImagePath);
      await fs.promises.unlink(testTextPath);
    } catch (e) {
      // Ignore cleanup errors
    }
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  });

  describe("Single File Upload", () => {
    // it("should upload a single image file", async () => {
    //   const buffer = await fs.promises.readFile(testImagePath);

    //   let formData: any;
    //   const useNative =
    //     typeof globalThis.Blob !== "undefined" &&
    //     typeof globalThis.FormData !== "undefined";

    //   if (useNative) {
    //     formData = new FormData();
    //     const blob = new Blob([buffer], { type: "image/png" });
    //     formData.append("file", blob, "test.png");
    //   } else {
    //     const FormDataPkg = (await import("form-data")).default;
    //     formData = new FormDataPkg();
    //     formData.append("file", buffer, {
    //       filename: "test.png",
    //       contentType: "image/png",
    //     });
    //   }

    //   const res = await client.upload("/upload/single", {
    //     formdata: formData,
    //   });

    //   expect(res.ok).to.be.equal(true);
    //   expect(res.status).to.be.equal(200);
    //   if (res.ok) {
    //     expect(res.data.file).to.have.property("name", "test.png");
    //     expect(res.data.file).to.have.property("mimetype", "image/png");
    //     expect(res.data.file).to.have.property("size").that.is.greaterThan(0);
    //     expect(res.data.file).to.have.property("extension", "png");
    //   }
    // });

    // it("should upload a text file", async () => {
    //   const buffer = await fs.promises.readFile(testTextPath);

    //   let formData: any;
    //   const useNative =
    //     typeof globalThis.Blob !== "undefined" &&
    //     typeof globalThis.FormData !== "undefined";

    //   if (useNative) {
    //     formData = new FormData();
    //     const blob = new Blob([buffer], { type: "text/plain" });
    //     formData.append("file", blob, "test.txt");
    //   } else {
    //     const FormDataPkg = (await import("form-data")).default;
    //     formData = new FormDataPkg();
    //     formData.append("file", buffer, {
    //       filename: "test.txt",
    //       contentType: "text/plain",
    //     });
    //   }

    //   const res = await client.upload("/upload/single", {
    //     formdata: formData,
    //   });

    //   expect(res.ok).to.be.equal(true);
    //   if (res.ok) {
    //     expect(res.data.file).to.have.property("name", "test.txt");
    //     expect(res.data.file).to.have.property("extension", "txt");
    //   }
    // });

    it("should return error when no file is uploaded", async () => {
      let formData: any;
      const useNative =
        typeof globalThis.Blob !== "undefined" &&
        typeof globalThis.FormData !== "undefined";

      if (useNative) {
        formData = new FormData();
      } else {
        const FormDataPkg = (await import("form-data")).default;
        formData = new FormDataPkg();
      }

      const res = await client.upload("/upload/single", {
        formdata: formData,
      })

      expect(res.ok).to.be.equal(false);
      expect(res.status).to.be.equal(400);
    });
  });

  describe("Multiple File Upload", () => {
    it("should upload multiple files", async () => {
      const imageBuffer = await fs.promises.readFile(testImagePath);
      const textBuffer = await fs.promises.readFile(testTextPath);

      let formData: any;
      const useNative =
        typeof globalThis.Blob !== "undefined" &&
        typeof globalThis.FormData !== "undefined";

      if (useNative) {
        formData = new FormData();
        formData.append(
          "files",
          new Blob([imageBuffer], { type: "image/png" }),
          "image.png"
        );
        formData.append(
          "files",
          new Blob([textBuffer], { type: "text/plain" }),
          "text.txt"
        );
      } else {
        const FormDataPkg = (await import("form-data")).default;
        formData = new FormDataPkg();
        formData.append("files", imageBuffer, {
          filename: "image.png",
          contentType: "image/png",
        });
        formData.append("files", textBuffer, {
          filename: "text.txt",
          contentType: "text/plain",
        });
      }

      const res = await client.upload("/upload/multiple", {
        formdata: formData,
      });

      expect(res.ok).to.be.equal(true);
      if (res.ok) {
        expect(res.data.count).to.be.equal(2);
        expect(res.data.files).to.be.an("array").with.length(2);
      }
    });

    it("should handle single file in multiple file endpoint", async () => {
      const buffer = await fs.promises.readFile(testImagePath);

      let formData: any;
      const useNative =
        typeof globalThis.Blob !== "undefined" &&
        typeof globalThis.FormData !== "undefined";

      if (useNative) {
        formData = new FormData();
        formData.append("files", new Blob([buffer], { type: "image/png" }), "single.png");
      } else {
        const FormDataPkg = (await import("form-data")).default;
        formData = new FormDataPkg();
        formData.append("files", buffer, {
          filename: "single.png",
          contentType: "image/png",
        });
      }

      const res = await client.upload("/upload/multiple", {
        formdata: formData,
      });

      expect(res.ok).to.be.equal(true);
      if (res.ok) {
        expect(res.data.count).to.be.equal(1);
      }
    });
  });

  describe("File Upload with Body Data", () => {
    it("should handle file upload with additional form data", async () => {
      const buffer = await fs.promises.readFile(testImagePath);

      let formData: any;
      const useNative =
        typeof globalThis.Blob !== "undefined" &&
        typeof globalThis.FormData !== "undefined";

      if (useNative) {
        formData = new FormData();
        formData.append("file", new Blob([buffer], { type: "image/png" }), "data.png");
        formData.append("title", "Test Image");
        formData.append("description", "A test image");
        formData.append("count", "42");
      } else {
        const FormDataPkg = (await import("form-data")).default;
        formData = new FormDataPkg();
        formData.append("file", buffer, {
          filename: "data.png",
          contentType: "image/png",
        });
        formData.append("title", "Test Image");
        formData.append("description", "A test image");
        formData.append("count", "42");
      }

      const res = await client.upload("/upload/with-body", {
        formdata: formData,
      });

      expect(res.ok).to.be.equal(true);
      if (res.ok) {
        expect(res.data.file).to.not.be.null;
        expect(res.data.body).to.have.property("title", "Test Image");
        expect(res.data.body).to.have.property("description", "A test image");
        expect(res.data.body).to.have.property("count", "42");
      }
    });
  });

  describe("File Upload Edge Cases", () => {
    it("should handle file with spaces in name", async () => {
      const buffer = await fs.promises.readFile(testImagePath);

      let formData: any;
      const useNative =
        typeof globalThis.Blob !== "undefined" &&
        typeof globalThis.FormData !== "undefined";

      if (useNative) {
        formData = new FormData();
        formData.append("file", new Blob([buffer], { type: "image/png" }), "my test file.png");
      } else {
        const FormDataPkg = (await import("form-data")).default;
        formData = new FormDataPkg();
        formData.append("file", buffer, {
          filename: "my test file.png",
          contentType: "image/png",
        });
      }

      const res = await client.upload("/upload/single", {
        formdata: formData,
      });

      expect(res.ok).to.be.equal(true);
      if (res.ok) {
        expect(res.data.file).to.have.property("name", "my test file.png");
      }
    });

    it("should handle file with unicode name", async () => {
      const buffer = await fs.promises.readFile(testImagePath);

      let formData: any;
      const useNative =
        typeof globalThis.Blob !== "undefined" &&
        typeof globalThis.FormData !== "undefined";

      if (useNative) {
        formData = new FormData();
        formData.append("file", new Blob([buffer], { type: "image/png" }), "测试文件.png");
      } else {
        const FormDataPkg = (await import("form-data")).default;
        formData = new FormDataPkg();
        formData.append("file", buffer, {
          filename: "测试文件.png",
          contentType: "image/png",
        });
      }

      const res = await client.upload("/upload/single", {
        formdata: formData,
      });

      expect(res.ok).to.be.equal(true);
    });

    it("should handle file with special characters in name", async () => {
      const buffer = await fs.promises.readFile(testImagePath);

      let formData: any;
      const useNative =
        typeof globalThis.Blob !== "undefined" &&
        typeof globalThis.FormData !== "undefined";

      if (useNative) {
        formData = new FormData();
        formData.append("file", new Blob([buffer], { type: "image/png" }), "test-file_v1.0.png");
      } else {
        const FormDataPkg = (await import("form-data")).default;
        formData = new FormDataPkg();
        formData.append("file", buffer, {
          filename: "test-file_v1.0.png",
          contentType: "image/png",
        });
      }

      const res = await client.upload("/upload/single", {
        formdata: formData,
      });

      expect(res.ok).to.be.equal(true);
      if (res.ok) {
        expect(res.data.file).to.have.property("name", "test-file_v1.0.png");
      }
    });

    it("should handle empty file upload", async () => {
      const emptyBuffer = Buffer.alloc(0);

      let formData: any;
      const useNative =
        typeof globalThis.Blob !== "undefined" &&
        typeof globalThis.FormData !== "undefined";

      if (useNative) {
        formData = new FormData();
        formData.append("file", new Blob([emptyBuffer], { type: "application/octet-stream" }), "empty.bin");
      } else {
        const FormDataPkg = (await import("form-data")).default;
        formData = new FormDataPkg();
        formData.append("file", emptyBuffer, {
          filename: "empty.bin",
          contentType: "application/octet-stream",
        });
      }

      const res = await client.upload("/upload/single", {
        formdata: formData,
      });

      // Empty file should still be processed
      expect(res.ok).to.be.equal(true);
      if (res.ok) {
        expect(res.data.file).to.have.property("size", 0);
      }
    });

    // it("should handle large file within limit", async () => {
    //   // Create a 1MB buffer (within 5MB limit)
    //   const largeBuffer = Buffer.alloc(1024 * 1024, "x");

    //   let formData: any;
    //   const useNative =
    //     typeof globalThis.Blob !== "undefined" &&
    //     typeof globalThis.FormData !== "undefined";

    //   if (useNative) {
    //     formData = new FormData();
    //     formData.append("file", new Blob([largeBuffer], { type: "application/octet-stream" }), "large.bin");
    //   } else {
    //     const FormDataPkg = (await import("form-data")).default;
    //     formData = new FormDataPkg();
    //     formData.append("file", largeBuffer, {
    //       filename: "large.bin",
    //       contentType: "application/octet-stream",
    //     });
    //   }

    //   const res = await client.upload("/upload/single", {
    //     formdata: formData,
    //   });

    //   expect(res.ok).to.be.equal(true);
    //   if (res.ok) {
    //     expect(res.data.file).to.have.property("size", 1024 * 1024);
    //   }
    // });
  });

  describe("Concurrent File Uploads", () => {
    it("should handle multiple concurrent uploads", async () => {
      const buffer = await fs.promises.readFile(testImagePath);

      const uploadTasks = Array.from({ length: 5 }, async (_, i) => {
        let formData: any;
        const useNative =
          typeof globalThis.Blob !== "undefined" &&
          typeof globalThis.FormData !== "undefined";

        if (useNative) {
          formData = new FormData();
          formData.append("file", new Blob([buffer], { type: "image/png" }), `concurrent-${i}.png`);
        } else {
          const FormDataPkg = (await import("form-data")).default;
          formData = new FormDataPkg();
          formData.append("file", buffer, {
            filename: `concurrent-${i}.png`,
            contentType: "image/png",
          });
        }

        return client.upload("/upload/single", {
          formdata: formData,
        });
      });

      const results = await Promise.all(uploadTasks);

      results.forEach((res) => {
        expect(res.ok).to.be.equal(true);
        if (res.ok) {
          expect(res.data.file).to.have.property("mimetype", "image/png");
        }
      });
    });
  });

  describe("File Upload Validation", () => {
    it("should handle missing file field gracefully", async () => {
      let formData: any;
      const useNative =
        typeof globalThis.Blob !== "undefined" &&
        typeof globalThis.FormData !== "undefined";

      if (useNative) {
        formData = new FormData();
        formData.append("other", "value");
      } else {
        const FormDataPkg = (await import("form-data")).default;
        formData = new FormDataPkg();
        formData.append("other", "value");
      }

      const res = await client.upload("/upload/empty", {
        formdata: formData,
      });

      expect(res.ok).to.be.equal(true);
      if (res.ok) {
        expect(res.data.hasFiles).to.be.equal(false);
      }
    });

    it("should reject file exceeding size limit", async () => {
      // Create a 6MB buffer (exceeds 5MB limit)
      const tooLargeBuffer = Buffer.alloc(6 * 1024 * 1024, "x");

      let formData: any;
      const useNative =
        typeof globalThis.Blob !== "undefined" &&
        typeof globalThis.FormData !== "undefined";

      if (useNative) {
        formData = new FormData();
        formData.append("file", new Blob([tooLargeBuffer], { type: "application/octet-stream" }), "toolarge.bin");
      } else {
        const FormDataPkg = (await import("form-data")).default;
        formData = new FormDataPkg();
        formData.append("file", tooLargeBuffer, {
          filename: "toolarge.bin",
          contentType: "application/octet-stream",
        });
      }

      await new Promise(r => setTimeout(r, 2000));

      const res = await client.upload("/upload/single", {
        formdata: formData
      })

      expect(res.ok).to.equal(false);
      expect(res.status).to.equal(413);
    });

  });
});