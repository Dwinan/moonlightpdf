declare module 'mammoth' {
  const mammoth: any;
  export default mammoth;
}
declare module 'pagedjs' {
  export class Previewer {
    preview(content: string | HTMLElement, options?: any): Promise<void>;
  }
}
