declare module "bwip-js" {
  type BarcodeOptions = {
    backgroundcolor?: string;
    bcid: string;
    includetext?: boolean;
    paddingheight?: number;
    paddingwidth?: number;
    scale?: number;
    text: string;
  };

  const bwipjs: {
    toBuffer(options: BarcodeOptions): Promise<Buffer>;
    toSVG(options: BarcodeOptions): string;
  };

  export default bwipjs;
}
