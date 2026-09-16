import { useState, type ChangeEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getErrorMessage } from "@/shared/lib/error";
import {
  uploadTempImage,
  type UploadedTempImage,
} from "@/shared/lib/temp-image-upload";
import { useRouteWorkspaceContext } from "../use-route-workspace-context";

/**
 * Temporary diagnostic screen for exercising the browser -> S3/MinIO upload
 * path. It is deliberately not linked from navigation and must be removed once
 * a real attachment workflow owns this interaction.
 */
export function TempImageUploadTestPage() {
  const { branch, branchSlug, tenant, tenantSlug } = useRouteWorkspaceContext();
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<UploadedTempImage | null>(null);
  const [error, setError] = useState<string | null>(null);

  const context = `${tenant?.tenant.displayName ?? tenantSlug} · ${branch?.branch.name ?? branchSlug}`;

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null);
    setResult(null);
    setError(null);
  }

  async function handleUpload() {
    if (!file || isUploading) return;

    setIsUploading(true);
    setResult(null);
    setError(null);

    try {
      setResult(
        await uploadTempImage({
          tenantSlug,
          branchSlug,
          file,
        }),
      );
    } catch (uploadError) {
      setError(getErrorMessage(uploadError));
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-7">
      <div className="space-y-2">
        <p className="text-sm font-semibold text-primary">Temporary diagnostic</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Kiểm tra upload ảnh tạm
        </h1>
        <p className="text-sm leading-6 text-muted-foreground sm:text-base">
          Trang này chỉ dùng để xác nhận luồng browser upload trực tiếp đến
          S3/MinIO. Nó không gắn ảnh vào hồ sơ hay tạo dữ liệu nghiệp vụ.
        </p>
        <span className="inline-flex rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground">
          {context}
        </span>
      </div>

      <Alert className="border-amber-500/30 bg-amber-500/10 text-foreground">
        Object sẽ nằm dưới prefix <code>temp/</code> và bị lifecycle xóa sau 24
        giờ. Route này không có trong navigation và sẽ được xóa khi có UI
        attachment thực tế.
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Chọn ảnh synthetic để upload</CardTitle>
          <CardDescription>
            Chỉ nhận JPG, PNG hoặc WEBP, kích thước tối đa 2 MB.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="temp-image-upload">Ảnh kiểm thử</Label>
            <Input
              accept="image/jpeg,image/png,image/webp"
              aria-describedby="temp-image-upload-hint"
              id="temp-image-upload"
              onChange={handleFileChange}
              type="file"
            />
            <p
              className="text-sm text-muted-foreground"
              id="temp-image-upload-hint"
            >
              {file
                ? `${file.name} · ${file.type || "unknown type"} · ${file.size} bytes`
                : "Chưa chọn file."}
            </p>
          </div>
          <Button
            disabled={!file || isUploading}
            onClick={handleUpload}
            type="button"
          >
            {isUploading ? "Đang upload…" : "Upload ảnh tạm"}
          </Button>

          {error && <Alert variant="destructive">{error}</Alert>}

          {result && (
            <div
              aria-live="polite"
              className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-4"
            >
              <p className="font-semibold">Upload MinIO thành công.</p>
              <p className="text-sm text-muted-foreground">
                Object key (temporary):
              </p>
              <code
                className="block break-all text-sm"
                data-testid="upload-object-key"
              >
                {result.objectKey}
              </code>
              <p className="text-sm text-muted-foreground">
                Upload intent hết hạn: {new Date(result.expiresAt).toLocaleString()}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
