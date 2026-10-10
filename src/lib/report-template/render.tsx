import { renderToBuffer } from "@react-pdf/renderer";
import { ReportDocument, type ReportDocumentData } from "./report-document";

export async function renderReportPdf(data: ReportDocumentData): Promise<Buffer> {
  return renderToBuffer(<ReportDocument data={data} />);
}
