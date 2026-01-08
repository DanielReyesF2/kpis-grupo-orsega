declare module 'pdf-parse' {
  interface PDFData {
    numpages: number;
    numrender: number;
    info: any;
    metadata: any;
    text: string;
    version: string;
  }

  function pdfParse(buffer: Buffer, options?: any): Promise<PDFData>;
  export default pdfParse;
}
