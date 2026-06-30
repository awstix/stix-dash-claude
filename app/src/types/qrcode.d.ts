declare module "qrcode" {
  type QrCodeErrorCorrectionLevel = "low" | "medium" | "quartile" | "high" | "L" | "M" | "Q" | "H";

  export function toString(
    text: string,
    options?: {
      color?: {
        dark?: string;
        light?: string;
      };
      errorCorrectionLevel?: QrCodeErrorCorrectionLevel;
      margin?: number;
      type?: "svg" | "utf8" | "terminal";
      width?: number;
    },
  ): Promise<string>;

  export function toBuffer(
    text: string,
    options?: {
      color?: {
        dark?: string;
        light?: string;
      };
      errorCorrectionLevel?: QrCodeErrorCorrectionLevel;
      margin?: number;
      type?: "png";
      width?: number;
    },
  ): Promise<Buffer>;

  const QRCode: {
    toBuffer: typeof toBuffer;
    toString: typeof toString;
  };

  export default QRCode;
}
